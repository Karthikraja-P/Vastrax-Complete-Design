"""M3 review fixes: published-only product cards and no orphan messages on MiniMax outage."""

from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

import app.models  # noqa: F401
from app.api.routes import chat as chat_routes
from app.core.exceptions import BadGatewayError, ServiceUnavailableError
from app.db.base import Base
from app.models.category import Category
from app.models.chat_message import ChatMessage
from app.models.product import Product
from app.schemas.chat import ChatRequest


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Category(id="cat", name="Sarees", slug="sarees"))
        session.flush()
        for pid, name, published in [("pub", "Public Saree", True), ("draft", "Secret Draft", False)]:
            session.add(Product(id=pid, category_id="cat", name=name, price_mrp=Decimal("200"),
                                price_selling=Decimal("150"), is_published=published))
        session.commit()
        yield session


def _req():
    return ChatRequest(messages=[{"role": "user", "content": "hi"}], session_id="ses_m3")


def test_tagged_unpublished_product_is_not_suggested(db, monkeypatch):
    monkeypatch.setattr(
        chat_routes, "vastra_chat", lambda *a, **k: ("Try [PRODUCT:pub] or [PRODUCT:draft]", [])
    )
    result = chat_routes.chat_endpoint(_req(), current_user=None, db=db)
    assert [p["id"] for p in result["suggested_products"]] == ["pub"]
    stored = db.query(ChatMessage).filter_by(sender="stylist").one()
    assert "draft" not in stored.suggested_products


@pytest.mark.parametrize("error", [ServiceUnavailableError("down"), BadGatewayError("bad")])
def test_chat_endpoint_outage_persists_nothing(db, monkeypatch, error):
    def boom(*a, **k):
        raise error

    monkeypatch.setattr(chat_routes, "vastra_chat", boom)
    with pytest.raises(type(error)):
        chat_routes.chat_endpoint(_req(), current_user=None, db=db)
    assert db.query(ChatMessage).count() == 0


@pytest.mark.parametrize("error", [ServiceUnavailableError("down"), BadGatewayError("bad")])
def test_chat_stream_endpoint_outage_persists_nothing(db, monkeypatch, error):
    def boom(*a, **k):
        raise error

    monkeypatch.setattr(chat_routes, "vastra_chat_stream", boom)
    with pytest.raises(type(error)):
        chat_routes.chat_stream_endpoint(_req(), current_user=None, db=db)
    assert db.query(ChatMessage).count() == 0


def test_chat_stream_endpoint_success_persists_user_message(db, monkeypatch):
    monkeypatch.setattr(chat_routes, "vastra_chat_stream", lambda *a, **k: iter(["data: {}\n\n"]))
    chat_routes.chat_stream_endpoint(_req(), current_user=None, db=db)
    assert [m.sender for m in db.query(ChatMessage).all()] == ["user"]
