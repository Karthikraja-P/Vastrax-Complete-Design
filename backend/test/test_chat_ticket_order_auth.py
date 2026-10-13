"""create_support_ticket must not link tickets to orders the caller doesn't own."""

import pytest
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
import app.models  # noqa: F401  (register all tables)
from app.models.address import Address
from app.models.order import Order
from app.models.support_ticket import SupportTicket
from app.models.user import User
from app.services.chat_tools import execute_tool

ORDER_ID = "ORD-2026-5001"


@pytest.fixture()
def db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        for uid, role in [("owner", "customer"), ("other", "customer"), ("admin", "admin")]:
            session.add(User(id=uid, email=f"{uid}@example.com", hashed_password="x", role=role))
        session.add(Address(id="addr", user_id="owner", label="Home", address_line1="1 Lane",
                            city="Chennai", state="TN", pincode="600001"))
        session.flush()
        session.add(Order(id=ORDER_ID, user_id="owner", address_id="addr",
                          total_amount=Decimal("100"), status="pending"))
        session.commit()
        yield session


def _ticket(db, user_id=None, **extra):
    args = {"subject": "Help", "description": "Need help", **extra}
    return execute_tool("create_support_ticket", args, db=db, user_id=user_id)


@pytest.mark.parametrize("uid", ["owner", "admin"])
def test_owner_and_admin_can_link_order(db, uid):
    res = _ticket(db, user_id=uid, order_id=ORDER_ID)
    assert res["success"] is True
    assert db.query(SupportTicket).one().order_id == ORDER_ID


@pytest.mark.parametrize("uid", ["other", None])
def test_stranger_and_anonymous_denied_no_row(db, uid):
    res = _ticket(db, user_id=uid, order_id=ORDER_ID)
    assert res["success"] is False
    assert db.query(SupportTicket).count() == 0


def test_nonexistent_order_denied_no_row(db):
    assert _ticket(db, user_id="owner", order_id="nope")["success"] is False
    assert db.query(SupportTicket).count() == 0


def test_anonymous_ticket_without_order_allowed(db):
    res = _ticket(db)
    assert res["success"] is True
    t = db.query(SupportTicket).one()
    assert t.order_id is None and t.user_id is None
