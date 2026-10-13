"""Chat order tools must only serve the authenticated owner (or an admin)."""

import pytest
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
import app.models  # noqa: F401  (register all tables)
from app.models.address import Address
from app.models.order import Order
from app.models.user import User
from app.services import chat_service
from app.services.chat_tools import CHAT_TOOLS, execute_tool

VICTIM_EMAIL = "victim@example.com"
ORDER_ID = "ORD-2026-7731"
ADDRESS = "12 Private Lane"


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for uid, email, role in [
            ("owner", VICTIM_EMAIL, "customer"),
            ("other", "other@example.com", "customer"),
            ("admin", "admin@example.com", "admin"),
        ]:
            session.add(User(id=uid, email=email, hashed_password="x", role=role))
        session.add(Address(id="addr", user_id="owner", label="Home", address_line1=ADDRESS,
                            city="Chennai", state="TN", pincode="600001"))
        session.flush()
        for oid in (ORDER_ID, ORDER_ID + "9"):
            session.add(Order(id=oid, user_id="owner", address_id="addr", total_amount=Decimal("100"),
                              status="pending"))
        session.commit()
        yield session


def _run(db, tool, args, user_id=None):
    return execute_tool(tool, args, db=db, user_id=user_id)


@pytest.mark.parametrize("tool", ["get_order_status", "get_order_details"])
def test_anonymous_with_victim_email_and_order_id_denied(db, tool):
    res = _run(db, tool, {"order_id": ORDER_ID, "email": VICTIM_EMAIL})
    assert res.get("authorized") is False
    assert ADDRESS not in str(res) and VICTIM_EMAIL not in str(res)


def test_anonymous_cannot_get_shipping_address(db):
    res = _run(db, "get_order_details", {"order_id": ORDER_ID, "email": VICTIM_EMAIL})
    assert "shipping_address" not in res and "items" not in res


@pytest.mark.parametrize("tool", ["get_order_status", "get_order_details"])
def test_other_signed_in_user_denied_even_with_victim_email(db, tool):
    res = _run(db, tool, {"order_id": ORDER_ID, "email": VICTIM_EMAIL}, user_id="other")
    assert res.get("authorized") is False
    assert ADDRESS not in str(res)


def test_owner_allowed(db):
    assert _run(db, "get_order_status", {"order_id": ORDER_ID}, "owner")["authorized"] is True
    res = _run(db, "get_order_details", {"order_id": ORDER_ID}, "owner")
    assert res["authorized"] is True and ADDRESS in res["shipping_address"]


def test_admin_allowed(db):
    assert _run(db, "get_order_status", {"order_id": ORDER_ID}, "admin")["authorized"] is True
    assert _run(db, "get_order_details", {"order_id": ORDER_ID}, "admin")["authorized"] is True


@pytest.mark.parametrize("fragment", ["7731", "ORD-2026", "ord-2026-773", "%"])
def test_fuzzy_order_id_does_not_resolve(db, fragment):
    assert _run(db, "get_order_status", {"order_id": fragment}, "owner")["authorized"] is False
    assert _run(db, "get_order_details", {"order_id": fragment}, "admin")["authorized"] is False


def test_fuzzy_id_cannot_cancel_wrong_order(db):
    # "ORD-2026-773" is a substring of both orders; neither may be cancelled by it.
    res = _run(db, "cancel_order", {"order_id": "ORD-2026-773"}, "owner")
    assert res["success"] is False
    assert {o.status for o in db.query(Order).all()} == {"pending"}


def test_anonymous_and_non_owner_cannot_cancel(db):
    assert _run(db, "cancel_order", {"order_id": ORDER_ID, "email": VICTIM_EMAIL})["success"] is False
    assert _run(db, "cancel_order", {"order_id": ORDER_ID}, "other")["success"] is False
    assert db.get(Order, ORDER_ID).status == "pending"
    assert _run(db, "cancel_order", {"order_id": ORDER_ID}, "owner")["success"] is True
    assert db.get(Order, ORDER_ID + "9").status == "pending"


def test_model_supplied_user_id_is_ignored(db):
    res = _run(db, "get_order_status", {"order_id": ORDER_ID, "user_id": "owner"})
    assert res.get("authorized") is False
    res = _run(db, "get_order_status", {"order_id": ORDER_ID, "user_id": "owner"}, user_id="other")
    assert res.get("authorized") is False


def test_email_removed_from_order_tool_schemas():
    for t in CHAT_TOOLS:
        fn = t["function"]
        if fn["name"] in ("get_order_status", "get_order_details"):
            assert "email" not in fn["parameters"]["properties"]


def test_mock_chat_anonymous_does_not_pick_latest_order(db):
    reply, tools = chat_service.mock_chat(
        [{"role": "user", "content": "where is my order?"}], {}, db=db, user_id=None)
    assert tools == []
    assert "sign in" in reply.lower() and "email" not in reply.lower()
    assert ORDER_ID not in reply


def test_mock_chat_signed_in_uses_own_latest_order(db):
    reply, tools = chat_service.mock_chat(
        [{"role": "user", "content": "where is my order?"}], {}, db=db, user_id="owner")
    assert tools and tools[0]["result"]["authorized"] is True


def test_mock_chat_anonymous_with_victim_order_id_denied(db):
    reply, tools = chat_service.mock_chat(
        [{"role": "user", "content": f"track {ORDER_ID} for {VICTIM_EMAIL}"}], {}, db=db, user_id=None)
    assert tools[0]["result"]["authorized"] is False
    assert "I located" not in reply
