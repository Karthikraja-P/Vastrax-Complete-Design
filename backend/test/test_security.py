import pytest
from decimal import Decimal
from types import SimpleNamespace
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.base import Base
import app.models  # noqa: F401
from app.core.security import create_refresh_token
from app.core.exceptions import UnauthorizedError
from app.models.user import User
from app.services.auth_service import AuthService

from app.core import rate_limit
from app.core.exceptions import BadGatewayError
from app.api.routes.settings import AppSettingsSchema, PUBLIC_FIELDS
from app.services import payment_service as ps


def test_rate_limit_blocks_then_resets():
    k = "t:blocks"
    rate_limit.reset(k)
    for _ in range(3):
        rate_limit.enforce(k, 3, 60)
    with pytest.raises(HTTPException) as e:
        rate_limit.enforce(k, 3, 60)
    assert e.value.status_code == 429 and "Retry-After" in e.value.headers
    rate_limit.reset(k)
    rate_limit.enforce(k, 3, 60)


def test_rate_limit_window_expires(monkeypatch):
    k = "t:window"
    rate_limit.reset(k)
    t = [1000.0]
    monkeypatch.setattr(rate_limit.time, "monotonic", lambda: t[0])
    assert rate_limit.hit(k, 1, 10) == 0
    assert rate_limit.hit(k, 1, 10) > 0
    t[0] += 11
    assert rate_limit.hit(k, 1, 10) == 0


def test_public_settings_hide_stylist_prompt():
    pub = AppSettingsSchema().model_dump(include=PUBLIC_FIELDS)
    assert "stylistSystemPrompt" not in pub and "storeName" in pub


def test_default_webhook_secret_is_rejected(monkeypatch):
    monkeypatch.setattr(ps.settings, "razorpay_webhook_secret", "MOCK_WEBHOOK_SECRET")
    assert ps._webhook_secret_is_default()
    monkeypatch.setattr(ps.settings, "razorpay_webhook_secret", "whsec_real_value")
    assert not ps._webhook_secret_is_default()


def test_production_razorpay_failure_does_not_simulate(monkeypatch):
    monkeypatch.setattr(ps.settings, "app_env", "production")
    monkeypatch.setattr(ps.PaymentService, "_mark_payment_failed", lambda self, payment: None)

    def fail_request(*args, **kwargs):
        raise ps.requests.ConnectionError("provider unavailable")

    monkeypatch.setattr(ps.requests, "post", fail_request)
    with pytest.raises(BadGatewayError, match="Razorpay could not create the payment order"):
        ps.PaymentService(db=None)._call_razorpay(SimpleNamespace(id="test-txn", status="created"), Decimal("10"))


def test_refresh_token_is_single_use_and_revoked_hash_fails_closed():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        user = User(id="refresh-user", email="refresh@example.com",
                    hashed_password="x", role="customer", is_active=True)
        token = create_refresh_token(user.id)
        user.refresh_token_hash = AuthService._token_hash(token)
        db.add(user)
        db.commit()

        rotated = AuthService(db).refresh(token)
        assert rotated["refresh_token"] != token
        with pytest.raises(UnauthorizedError, match="revoked"):
            AuthService(db).refresh(token)

        user.refresh_token_hash = None
        db.commit()
        with pytest.raises(UnauthorizedError, match="revoked"):
            AuthService(db).refresh(rotated["refresh_token"])
