import asyncio
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.main  # noqa: F401
from app.core.exceptions import BadRequestError, ConflictError
from app.db.base import Base
from app.models.category import Category
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.stock_notification import StockNotification
from app.services import stock_notification_service as stock_service


@pytest.fixture()
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/stock-notifications.db")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


def seed_request(db, stock_qty=2, notified=False):
    category = Category(id="cat-1", slug="women", name="Women")
    product = Product(
        id="prod-1", category_id=category.id, name="Pink Coord",
        price_mrp=Decimal("1200.00"), price_selling=Decimal("1000.00"),
    )
    variant = ProductVariant(id="variant-1", product_id=product.id, sku="PINK-S", size="S", stock_qty=stock_qty)
    request = StockNotification(
        id="wait-1", product_id=product.id, variant_id=variant.id,
        email="customer@example.com", size="S", is_notified=notified,
    )
    db.add_all([category, product, variant, request])
    db.commit()
    return request


def test_admin_send_marks_notified_only_after_email_acceptance(db, monkeypatch):
    request = seed_request(db)
    sent = []

    async def fake_send_email(**kwargs):
        sent.append(kwargs)
        return {"id": "email-test"}

    monkeypatch.setattr(stock_service, "send_email", fake_send_email)
    result = asyncio.run(stock_service.StockNotificationService(db).send_one(request.id))

    db.refresh(request)
    assert result["status"] == "sent"
    assert request.is_notified is True
    assert request.notified_at is not None
    assert len(sent) == 1
    assert sent[0]["to_email"] == "customer@example.com"
    assert sent[0]["subject"] == "Pink Coord is back in stock"
    assert "size S" in sent[0]["html_content"]


def test_manual_send_requires_available_stock(db, monkeypatch):
    request = seed_request(db, stock_qty=0)
    called = False

    async def fake_send_email(**kwargs):
        nonlocal called
        called = True
        return {"id": "email-test"}

    monkeypatch.setattr(stock_service, "send_email", fake_send_email)
    with pytest.raises(BadRequestError):
        asyncio.run(stock_service.StockNotificationService(db).send_one(request.id))

    db.refresh(request)
    assert called is False
    assert request.is_notified is False


def test_already_notified_request_cannot_be_resent(db, monkeypatch):
    request = seed_request(db, notified=True)

    async def fake_send_email(**kwargs):
        pytest.fail("a notified customer must not receive an accidental duplicate")

    monkeypatch.setattr(stock_service, "send_email", fake_send_email)
    with pytest.raises(ConflictError):
        asyncio.run(stock_service.StockNotificationService(db).send_one(request.id))


def test_admin_list_keeps_notified_records_and_current_size_stock(db):
    seed_request(db, stock_qty=3, notified=True)
    rows = stock_service.StockNotificationService(db).list_for_admin()
    assert len(rows) == 1
    assert rows[0]["email"] == "customer@example.com"
    assert rows[0]["is_notified"] is True
    assert rows[0]["current_stock"] == 3
