import asyncio
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.main  # noqa: F401
from app.api.routes import products as product_routes
from app.core.exceptions import BadRequestError
from app.db.base import Base
from app.models.category import Category
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.stock_notification import StockNotification
from app.services.product_service import ProductService


def _db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/waitlist.db")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    category = Category(id="cat", name="Clothing", slug="clothing")
    product = Product(
        id="product-1", category_id="cat", name="Pink Coord",
        price_mrp=Decimal("1000"), price_selling=Decimal("1000"),
    )
    variant = ProductVariant(id="variant-s", product_id="product-1", sku="pink-s", size="S", stock_qty=0)
    notification = StockNotification(
        id="wait-1", product_id="product-1", variant_id="variant-s",
        email="customer@example.com", size="S", is_notified=False,
    )
    session.add_all([category, product, variant, notification])
    session.commit()
    return engine, session


def test_stock_change_does_not_send_until_admin_clicks_send(tmp_path, monkeypatch):
    engine, db = _db(tmp_path)
    sent = {}

    async def fake_send_email(*, to_email, subject, html_content):
        sent.update(to_email=to_email, subject=subject, html=html_content)
        return {"id": "email-test"}

    monkeypatch.setattr(product_routes, "send_email", fake_send_email)
    try:
        with pytest.raises(BadRequestError):
            asyncio.run(product_routes.send_stock_notification_email("wait-1", db=db))

        ProductService(db).update_stock("product-1", "variant-s", 3)
        saved = db.get(StockNotification, "wait-1")
        assert saved.is_notified is False
        assert sent == {}

        response = asyncio.run(product_routes.send_stock_notification_email("wait-1", db=db))
        saved = db.get(StockNotification, "wait-1")
        assert response["success"] is True
        assert sent["to_email"] == "customer@example.com"
        assert "Pink Coord" in sent["subject"]
        assert "size S" in sent["html"]
        assert saved.is_notified is True
        assert saved.notified_at is not None
    finally:
        db.close()
        engine.dispose()


def test_waitlist_folders_counts_search_and_pagination(tmp_path):
    engine, db = _db(tmp_path)
    try:
        db.add(StockNotification(
            id="wait-2", product_id="product-1", variant_id="variant-s",
            email="already-notified@example.com", size="S", is_notified=True,
        ))
        db.commit()
        result = product_routes.list_stock_notifications(
            db=db, bucket="waiting", page=1, limit=1, search="Pink"
        )
        assert result["counts"] == {"all": 2, "waiting": 1, "notified": 1}
        assert result["total"] == 1
        assert result["total_pages"] == 1
        assert len(result["items"]) == 1
        assert result["items"][0]["email"] == "customer@example.com"
        assert result["items"][0]["is_in_stock"] is False
    finally:
        db.close()
        engine.dispose()
