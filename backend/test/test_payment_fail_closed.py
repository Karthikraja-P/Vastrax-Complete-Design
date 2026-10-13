"""Payment fail-closed tests: disposable SQLite, mocked Razorpay, no network."""

import hashlib
import hmac
import json
from decimal import Decimal

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.main  # noqa: F401  (registers every model on Base.metadata)
from app.core.exceptions import AppException, BadRequestError, ConflictError, ForbiddenError
from app.db.base import Base
from app.models.order import Order
from app.models.payment import Payment
from app.models.user import User
from app.schemas.payments import PaymentCreate, PaymentVerify
from app.services import order_service
from app.services import payment_service as ps

REAL_SECRET = "real_key_secret_value"
WEBHOOK_SECRET = "whsec_real_value"
RZP_ORDER = "order_TEST1"


@pytest.fixture()
def db(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path}/pay.db")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    yield session
    session.close()
    engine.dispose()


@pytest.fixture()
def hooks(monkeypatch):
    calls = []
    monkeypatch.setattr(order_service, "_book_shiprocket", lambda *a, **k: calls.append("ship"))
    monkeypatch.setattr(order_service, "send_order_email_notification", lambda *a, **k: calls.append("mail"))
    return calls


@pytest.fixture()
def real_cfg(monkeypatch):
    monkeypatch.setattr(ps.settings, "razorpay_key_id", "rzp_live_abc")
    monkeypatch.setattr(ps.settings, "razorpay_key_secret", REAL_SECRET)
    monkeypatch.setattr(ps.settings, "razorpay_webhook_secret", WEBHOOK_SECRET)


def _seed(db, rzp_order=RZP_ORDER):
    user = User(email="p@example.com", full_name="P", hashed_password="x", role="customer")
    db.add(user)
    db.flush()
    order = Order(id="ORD-1", user_id=user.id, address_id="addr", total_amount=Decimal("100.00"))
    db.add(order)
    pay = Payment(id="TXN-1", order_id=order.id, user_id=user.id, amount=Decimal("100.00"),
                  method="UPI", status="pending", razorpay_order_id=rzp_order)
    db.add(pay)
    db.commit()
    return user, order, pay


def _sig(secret, order_id, payment_id):
    return hmac.new(secret.encode(), f"{order_id}|{payment_id}".encode(), hashlib.sha256).hexdigest()


def _webhook(event, order_id=RZP_ORDER, secret=WEBHOOK_SECRET):
    body = json.dumps({"event": event, "payload": {"payment": {"entity": {"id": "pay_1", "order_id": order_id}}}}).encode()
    return body, hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def _unpaid(db):
    db.expire_all()
    o = db.get(Order, "ORD-1")
    p = db.get(Payment, "TXN-1")
    return o.payment_status != "paid" and o.status != "confirmed" and p.status != "success"


def test_forged_verify_signature_rejected(db, hooks, real_cfg):
    user, _, _ = _seed(db)
    bad = PaymentVerify(txn_id="TXN-1", razorpay_order_id=RZP_ORDER, razorpay_payment_id="pay_1", razorpay_signature="0" * 64)
    with pytest.raises(ForbiddenError):
        ps.PaymentService(db).verify_payment(bad, user)
    assert _unpaid(db) and hooks == []


def test_verify_with_mock_secret_in_production_cannot_mark_paid(db, hooks, monkeypatch):
    """Mock config + production: the publicly known MOCK_SECRET must not forge a paid order."""
    monkeypatch.setattr(ps.settings, "app_env", "production")
    monkeypatch.setattr(ps.settings, "razorpay_key_id", "rzp_test_MOCK")
    monkeypatch.setattr(ps.settings, "razorpay_key_secret", "MOCK_SECRET")
    user, _, _ = _seed(db)
    forged = PaymentVerify(txn_id="TXN-1", razorpay_order_id=RZP_ORDER, razorpay_payment_id="pay_x",
                           razorpay_signature=_sig("MOCK_SECRET", RZP_ORDER, "pay_x"))
    with pytest.raises((BadRequestError, ForbiddenError)):
        ps.PaymentService(db).verify_payment(forged, user)
    assert _unpaid(db) and hooks == []


def test_verify_valid_signature_for_other_razorpay_order_rejected(db, hooks, real_cfg):
    """A genuine signature for a different (cheaper) Razorpay order must not pay this txn."""
    user, _, _ = _seed(db)
    other = "order_CHEAP"
    p = PaymentVerify(txn_id="TXN-1", razorpay_order_id=other, razorpay_payment_id="pay_9",
                      razorpay_signature=_sig(REAL_SECRET, other, "pay_9"))
    with pytest.raises((BadRequestError, ForbiddenError)):
        ps.PaymentService(db).verify_payment(p, user)
    assert _unpaid(db) and hooks == []


def test_verify_valid_signature_marks_paid_once(db, hooks, real_cfg):
    user, _, _ = _seed(db)
    p = PaymentVerify(txn_id="TXN-1", razorpay_order_id=RZP_ORDER, razorpay_payment_id="pay_1",
                      razorpay_signature=_sig(REAL_SECRET, RZP_ORDER, "pay_1"))
    svc = ps.PaymentService(db)
    svc.verify_payment(p, user)
    svc.verify_payment(p, user)
    db.expire_all()
    assert db.get(Order, "ORD-1").payment_status == "paid"
    assert hooks == ["ship", "mail"]


def test_forged_webhook_signature_rejected(db, hooks, real_cfg):
    _seed(db)
    body, _ = _webhook("payment.captured")
    for sig in (None, "", "f" * 64):
        with pytest.raises((BadRequestError, ForbiddenError)):
            ps.PaymentService(db).handle_webhook(body, sig)
    body2, sig2 = _webhook("payment.captured", secret="attacker")
    with pytest.raises(ForbiddenError):
        ps.PaymentService(db).handle_webhook(body2, sig2)
    assert _unpaid(db) and hooks == []


def test_default_webhook_secret_cannot_mark_paid(db, hooks, monkeypatch):
    monkeypatch.setattr(ps.settings, "razorpay_webhook_secret", "MOCK_WEBHOOK_SECRET")
    _seed(db)
    body, sig = _webhook("payment.captured", secret="MOCK_WEBHOOK_SECRET")
    with pytest.raises(BadRequestError):
        ps.PaymentService(db).handle_webhook(body, sig)
    assert _unpaid(db) and hooks == []


def test_duplicate_webhook_transitions_once(db, hooks, real_cfg):
    _seed(db)
    body, sig = _webhook("payment.captured")
    svc = ps.PaymentService(db)
    svc.handle_webhook(body, sig)
    svc.handle_webhook(body, sig)
    assert hooks == ["ship", "mail"]
    db.expire_all()
    assert db.get(Order, "ORD-1").payment_status == "paid"


def test_duplicate_failed_webhook_restores_once_and_never_pays(db, hooks, real_cfg):
    _seed(db)
    body, sig = _webhook("payment.failed")
    svc = ps.PaymentService(db)
    svc.handle_webhook(body, sig)
    svc.handle_webhook(body, sig)
    db.expire_all()
    assert db.get(Order, "ORD-1").status == "cancelled" and _unpaid(db) and hooks == []


def test_late_capture_after_failure_does_not_reopen_cancelled_order(db, hooks, real_cfg):
    _seed(db)
    fail, fsig = _webhook("payment.failed")
    cap, csig = _webhook("payment.captured")
    svc = ps.PaymentService(db)
    svc.handle_webhook(fail, fsig)
    try:
        svc.handle_webhook(cap, csig)
    except (BadRequestError, ForbiddenError):
        pass
    db.expire_all()
    assert db.get(Order, "ORD-1").status == "cancelled"
    assert db.get(Order, "ORD-1").payment_status != "paid"


@pytest.mark.parametrize("failure", ["timeout", "network", "http500", "bad_json"])
def test_provider_failure_in_production_creates_no_paid_state(db, hooks, real_cfg, monkeypatch, failure):
    monkeypatch.setattr(ps.settings, "app_env", "production")
    user, _, _ = _seed(db, rzp_order=None)

    class Resp:
        status_code = 500
        def json(self):
            if failure == "bad_json":
                raise ValueError("not json")
            return {"error": {"description": "boom"}}

    def fake_post(*a, **k):
        if failure == "timeout":
            raise ps.requests.Timeout("t")
        if failure == "network":
            raise ps.requests.ConnectionError("n")
        return Resp()

    monkeypatch.setattr(ps.requests, "post", fake_post)
    with pytest.raises(BadRequestError):
        ps.PaymentService(db).initiate_payment(PaymentCreate(order_id="ORD-1", amount=Decimal("100.00")), user)
    assert _unpaid(db) and hooks == []


def test_production_mock_config_blocks_initiate_and_simulate(db, hooks, monkeypatch):
    monkeypatch.setattr(ps.settings, "app_env", "production")
    monkeypatch.setattr(ps.settings, "razorpay_key_id", "rzp_test_MOCK")
    monkeypatch.setattr(ps.settings, "razorpay_key_secret", "MOCK_SECRET")
    user, _, _ = _seed(db)
    svc = ps.PaymentService(db)
    with pytest.raises(BadRequestError):
        svc.initiate_payment(PaymentCreate(order_id="ORD-1", amount=Decimal("100.00")), user)
    assert db.query(Payment).count() == 1  # no new pending row
    with pytest.raises(ForbiddenError):
        svc.simulate_payment("TXN-1", user, True)
    assert _unpaid(db) and hooks == []


# ---- refunds fail closed -------------------------------------------------

from app.core.exceptions import ConflictError  # noqa: E402


def _paid(db, provider_id="pay_1"):
    _, order, pay = _seed(db)
    pay.status = "success"
    pay.razorpay_payment_id = provider_id
    order.payment_status = "paid"
    db.commit()


def _state(db):
    db.expire_all()
    return db.get(Payment, "TXN-1").status, db.get(Order, "ORD-1").payment_status


@pytest.mark.parametrize("failure", ["timeout", "network", "http500", "bad_json", "no_id"])
def test_refund_provider_failure_does_not_mark_refunded(db, real_cfg, monkeypatch, failure):
    monkeypatch.setattr(ps.settings, "app_env", "production")
    _paid(db)

    class Resp:
        status_code = 200 if failure in ("bad_json", "no_id") else 500
        def json(self):
            if failure == "bad_json":
                raise ValueError("not json")
            return {} if failure == "no_id" else {"error": {"description": "boom"}}

    def fake_post(*a, **k):
        if failure == "timeout":
            raise ps.requests.Timeout("t")
        if failure == "network":
            raise ps.requests.ConnectionError("n")
        return Resp()

    monkeypatch.setattr(ps.requests, "post", fake_post)
    with pytest.raises(AppException):
        ps.PaymentService(db).process_refund("TXN-1", Decimal("100.00"))
    assert _state(db) == ("success", "paid")


def test_refund_missing_provider_id_real_config_fails_closed(db, real_cfg, monkeypatch):
    monkeypatch.setattr(ps.settings, "app_env", "production")
    _paid(db, provider_id=None)
    monkeypatch.setattr(ps.requests, "post", lambda *a, **k: pytest.fail("no provider call expected"))
    with pytest.raises(AppException):
        ps.PaymentService(db).process_refund("TXN-1", Decimal("100.00"))
    assert _state(db) == ("success", "paid")


def test_refund_mock_mode_in_production_fails_closed(db, monkeypatch):
    monkeypatch.setattr(ps.settings, "app_env", "production")
    monkeypatch.setattr(ps.settings, "razorpay_key_id", "rzp_test_MOCK")
    monkeypatch.setattr(ps.settings, "razorpay_key_secret", "MOCK_SECRET")
    _paid(db)
    with pytest.raises(AppException):
        ps.PaymentService(db).process_refund("TXN-1", Decimal("100.00"))
    assert _state(db) == ("success", "paid")


def test_refund_dev_mock_simulation_still_works(db, monkeypatch):
    monkeypatch.setattr(ps.settings, "app_env", "development")
    monkeypatch.setattr(ps.settings, "razorpay_key_id", "rzp_test_MOCK")
    monkeypatch.setattr(ps.settings, "razorpay_key_secret", "MOCK_SECRET")
    _paid(db, provider_id=None)
    monkeypatch.setattr(ps.requests, "post", lambda *a, **k: pytest.fail("no provider call expected"))
    assert ps.PaymentService(db).process_refund("TXN-1", Decimal("100.00"))["status"] == "refunded"
    assert _state(db) == ("refunded", "refunded")


def test_refund_real_success_marks_refunded(db, real_cfg, monkeypatch):
    monkeypatch.setattr(ps.settings, "app_env", "production")
    _paid(db)
    seen = {}

    class Resp:
        status_code = 200
        def json(self):
            return {"id": "rfnd_1", "payment_id": "pay_1", "amount": 10000, "status": "processed"}

    def fake_post(url, **k):
        seen["url"], seen["json"] = url, k["json"]
        return Resp()

    monkeypatch.setattr(ps.requests, "post", fake_post)
    out = ps.PaymentService(db).process_refund("TXN-1", Decimal("100.00"))
    assert out["gateway_refund_id"] == "rfnd_1" and seen["url"].endswith("/payments/pay_1/refund")
    assert seen["json"]["amount"] == 10000 and "vastrax_refund_id" in seen["json"]["notes"]
    assert _state(db) == ("refunded", "refunded")


# ---- verify_payment against already-resolved transactions ----------------

def _verify(db, user, payment_id):
    p = PaymentVerify(txn_id="TXN-1", razorpay_order_id=RZP_ORDER, razorpay_payment_id=payment_id,
                      razorpay_signature=_sig(REAL_SECRET, RZP_ORDER, payment_id))
    return ps.PaymentService(db).verify_payment(p, user)


def test_verify_after_failed_conflicts_without_mutation(db, hooks, real_cfg):
    user, _, pay = _seed(db)
    ps.PaymentService(db)._mark_payment_failed(pay)
    before = _state(db)
    with pytest.raises(ConflictError):
        _verify(db, user, "pay_late")
    db.expire_all()
    assert _state(db) == before and db.get(Payment, "TXN-1").razorpay_payment_id is None
    assert db.get(Order, "ORD-1").status == "cancelled" and hooks == []


def test_verify_success_with_different_payment_id_conflicts_without_mutation(db, hooks, real_cfg):
    user, _, _ = _seed(db)
    _verify(db, user, "pay_1")
    sig_before = db.get(Payment, "TXN-1").razorpay_signature
    with pytest.raises(ConflictError):
        _verify(db, user, "pay_2")
    db.expire_all()
    p = db.get(Payment, "TXN-1")
    assert p.razorpay_payment_id == "pay_1" and p.razorpay_signature == sig_before and p.status == "success"
    assert hooks == ["ship", "mail"]


# ---- refunded is terminal; refund bounds ---------------------------------

def _refunded(db):
    _paid(db)
    db.get(Payment, "TXN-1").status = "refunded"
    db.get(Order, "ORD-1").payment_status = "refunded"
    db.commit()


@pytest.mark.parametrize("event", ["payment.captured", "payment.failed"])
def test_late_webhook_after_refund_changes_nothing(db, hooks, real_cfg, event):
    _refunded(db)
    order_before = (db.get(Order, "ORD-1").status, db.get(Order, "ORD-1").payment_status)
    body, sig = _webhook(event)
    ps.PaymentService(db).handle_webhook(body, sig)
    db.expire_all()
    p, o = db.get(Payment, "TXN-1"), db.get(Order, "ORD-1")
    assert (p.status, p.razorpay_payment_id) == ("refunded", "pay_1")
    assert (o.status, o.payment_status) == order_before == (o.status, "refunded")
    assert o.status != "cancelled" and hooks == []


def test_verify_replay_after_refund_does_not_reopen(db, hooks, real_cfg):
    _refunded(db)
    user = db.get(User, db.get(Payment, "TXN-1").user_id)
    with pytest.raises(ConflictError):
        _verify(db, user, "pay_1")
    db.expire_all()
    assert _state(db) == ("refunded", "refunded") and hooks == []


@pytest.mark.parametrize("status", ["pending", "failed", "refunded"])
def test_refund_requires_successful_payment(db, real_cfg, monkeypatch, status):
    monkeypatch.setattr(ps.settings, "app_env", "production")
    _paid(db)
    db.get(Payment, "TXN-1").status = status
    db.commit()
    monkeypatch.setattr(ps.requests, "post", lambda *a, **k: pytest.fail("no provider call expected"))
    with pytest.raises(AppException):
        ps.PaymentService(db).process_refund("TXN-1", Decimal("100.00"))
    assert _state(db)[0] == status


@pytest.mark.parametrize("amount", [Decimal("0"), Decimal("-5"), Decimal("100.01")])
def test_refund_amount_bounds(db, real_cfg, monkeypatch, amount):
    monkeypatch.setattr(ps.settings, "app_env", "production")
    _paid(db)
    monkeypatch.setattr(ps.requests, "post", lambda *a, **k: pytest.fail("no provider call expected"))
    with pytest.raises(AppException):
        ps.PaymentService(db).process_refund("TXN-1", amount)
    assert _state(db) == ("success", "paid")


def test_refund_non_success_blocked_in_dev_mock(db, monkeypatch):
    monkeypatch.setattr(ps.settings, "app_env", "development")
    monkeypatch.setattr(ps.settings, "razorpay_key_id", "rzp_test_MOCK")
    monkeypatch.setattr(ps.settings, "razorpay_key_secret", "MOCK_SECRET")
    _seed(db)  # pending
    with pytest.raises(AppException):
        ps.PaymentService(db).process_refund("TXN-1", Decimal("100.00"))
    assert _state(db)[0] == "pending"


@pytest.mark.parametrize("mode", ["real", "dev_mock"])
def test_partial_refund_updates_cumulative_refund_state(db, real_cfg, monkeypatch, mode):
    if mode == "real":
        monkeypatch.setattr(ps.settings, "app_env", "production")
        _paid(db)
        class Resp:
            status_code = 200
            def json(self):
                return {"id": "rfnd_partial", "payment_id": "pay_1", "amount": 4000, "status": "processed"}
        monkeypatch.setattr(ps.requests, "post", lambda *a, **k: Resp())
    else:
        monkeypatch.setattr(ps.settings, "app_env", "development")
        monkeypatch.setattr(ps.settings, "razorpay_key_id", "rzp_test_MOCK")
        monkeypatch.setattr(ps.settings, "razorpay_key_secret", "MOCK_SECRET")
        _paid(db, provider_id=None)
        monkeypatch.setattr(ps.requests, "post", lambda *a, **k: pytest.fail("no provider call expected"))
    out = ps.PaymentService(db).process_refund("TXN-1", Decimal("40.00"))
    assert out["status"] == ("processed" if mode == "real" else "partially_refunded")
    assert _state(db) == ("partially_refunded", "partially_refunded")

def test_production_readiness_requires_live_razorpay_credentials(monkeypatch):
    monkeypatch.setattr(ps.settings, "app_env", "production")
    monkeypatch.setattr(ps.settings, "razorpay_key_id", "rzp_test_example")
    monkeypatch.setattr(ps.settings, "razorpay_key_secret", "example_secret")
    monkeypatch.setattr(ps.settings, "razorpay_webhook_secret", "example_webhook")
    result = ps.PaymentService.readiness()
    assert result == {
        "razorpay_available": False,
        "simulation_available": False,
        "checkout_available": False,
    }


def test_production_readiness_accepts_live_razorpay_configuration(monkeypatch):
    monkeypatch.setattr(ps.settings, "app_env", "production")
    monkeypatch.setattr(ps.settings, "razorpay_key_id", "rzp_live_example")
    monkeypatch.setattr(ps.settings, "razorpay_key_secret", "example_secret")
    monkeypatch.setattr(ps.settings, "razorpay_webhook_secret", "example_webhook")
    result = ps.PaymentService.readiness()
    assert result == {
        "razorpay_available": True,
        "simulation_available": False,
        "checkout_available": True,
    }


def test_development_readiness_exposes_only_local_simulation(monkeypatch):
    monkeypatch.setattr(ps.settings, "app_env", "development")
    monkeypatch.setattr(ps.settings, "razorpay_key_id", "rzp_test_MOCK")
    monkeypatch.setattr(ps.settings, "razorpay_key_secret", "MOCK_SECRET")
    monkeypatch.setattr(ps.settings, "razorpay_webhook_secret", "MOCK_WEBHOOK_SECRET")
    result = ps.PaymentService.readiness()
    assert result == {
        "razorpay_available": False,
        "simulation_available": True,
        "checkout_available": True,
    }


def test_production_test_credentials_cannot_start_payment(db, hooks, monkeypatch):
    monkeypatch.setattr(ps.settings, "app_env", "production")
    monkeypatch.setattr(ps.settings, "razorpay_key_id", "rzp_test_example")
    monkeypatch.setattr(ps.settings, "razorpay_key_secret", "example_secret")
    monkeypatch.setattr(ps.settings, "razorpay_webhook_secret", "example_webhook")
    user, _, _ = _seed(db)
    with pytest.raises(BadRequestError):
        ps.PaymentService(db).initiate_payment(
            PaymentCreate(order_id="ORD-1", amount=Decimal("100.00")), user
        )
    assert _unpaid(db) and hooks == []
