"""End-to-end API flow against the isolated SQLite DB in conftest.py."""

from unittest.mock import AsyncMock  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402
from app.core.security import create_access_token, hash_password  # noqa: E402
from app.db.database import SessionLocal  # noqa: E402
from app.models.otp import OTP, hash_otp_code  # noqa: E402
from app.models.user import User  # noqa: E402


@pytest.fixture(scope="module")
def c():
    return TestClient(app)


def H(tok, ip="10.0.0.1"):
    return {"Authorization": f"Bearer {tok}", "X-Forwarded-For": ip}


@pytest.fixture(scope="module")
def admin_tok():
    db = SessionLocal()
    u = User(email="admin@example.com", phone_number="+910000000001", full_name="Admin", hashed_password=hash_password("x" * 12), role="admin", is_active=True)
    db.add(u); db.commit(); tok = create_access_token({"sub": u.id}); db.close()
    return tok


def otp_login(c, monkeypatch, email, ip):
    monkeypatch.setattr("app.api.routes.otp.send_email", AsyncMock())
    monkeypatch.setattr("app.core.config.settings.resend_api_key", "test-resend-key")
    monkeypatch.setattr("app.api.routes.otp.generate_otp_code", lambda: "123456")
    assert c.post("/api/v1/otp/send", json={"email": email}, headers={"X-Forwarded-For": ip}).status_code == 200
    db = SessionLocal(); stored_code = db.query(OTP).filter(OTP.identifier == email, OTP.is_used == False).first().code; db.close()  # noqa: E712
    assert stored_code == hash_otp_code("123456")
    assert stored_code != "123456"
    code = "123456"
    bad = "000000" if code != "000000" else "111111"
    assert c.post("/api/v1/otp/verify", json={"email": email, "code": bad}, headers={"X-Forwarded-For": ip}).status_code == 400
    r = c.post("/api/v1/otp/verify", json={"email": email, "code": code, "first_name": "Test"}, headers={"X-Forwarded-For": ip})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_full_purchase_flow(c, monkeypatch, admin_tok):
    cust = otp_login(c, monkeypatch, "buyer@example.com", "10.1.0.1")
    other = otp_login(c, monkeypatch, "other@example.com", "10.1.0.2")

    # admin: category with persisted fields
    r = c.post("/api/v1/categories", headers=H(admin_tok), json={"name": "E2E Cat", "slug": "e2e-cat", "description": "d1", "is_active": False})
    assert r.status_code in (200, 201), r.text
    cid = r.json()["id"]
    assert c.put(f"/api/v1/categories/{cid}", headers=H(admin_tok), json={"description": "d2", "is_active": True}).status_code == 200
    got = [x for x in c.get("/api/v1/categories").json() if x["id"] == cid][0]
    assert got["description"] == "d2" and got["is_active"] is True

    # admin: product with S/M variants
    r = c.post("/api/v1/products", headers=H(admin_tok), json={"category_id": cid, "name": "E2E Dress", "price_mrp": 1500, "price_selling": 1000,
               "variants": [{"sku": "E2E-S", "size": "S", "stock_qty": 2}, {"sku": "E2E-M", "size": "M", "stock_qty": 5}]})
    assert r.status_code in (200, 201), r.text
    pid = r.json()["id"]

    # customer: address + orders
    r = c.post("/api/v1/users/me/addresses", headers=H(cust), json={"label": "Home", "address_line1": "1 Test St", "city": "Chennai", "state": "TN", "pincode": "600001", "is_default": True})
    assert r.status_code in (200, 201), r.text
    aid = r.json()["id"]

    def order(size, qty, total):
        return c.post("/api/v1/orders", headers=H(cust), json={"address_id": aid, "total_amount": total, "items": [{"product_id": pid, "size": size, "quantity": qty}]})

    assert order("XL", 1, 1000).status_code == 400       # unknown size rejected
    assert order("S", 3, 3000).status_code == 400        # over stock rejected
    r = order("M", 2, 1)  # tampered client total must be ignored
    assert r.status_code in (200, 201), r.text
    oid = r.json()["id"]
    assert float(r.json()["total_amount"]) == 2160.0  # 2 x 1000 + 8% tax, server-priced
    assert c.post("/api/v1/payments/initiate", headers=H(cust), json={"order_id": oid, "amount": 1}).status_code == 400

    # stock decremented on the right variant only
    prod = c.get(f"/api/v1/products/{pid}", headers=H(cust)).json()
    stock = {v["size"]: v["stock_qty"] for v in prod["variants"]}
    assert stock == {"S": 2, "M": 3}

    # payments: dev mock works, production mock is blocked
    r = c.post("/api/v1/payments/initiate", headers=H(cust), json={"order_id": oid, "amount": 2160})
    assert r.status_code == 200 and r.json()["mode"] == "simulation", r.text
    txn = r.json()["txn_id"]
    assert c.post("/api/v1/payments/simulate", headers=H(cust), json={"txn_id": txn, "success": True}).status_code == 200
    from app.core.config import settings
    from app.models.payment import Payment
    db = SessionLocal()
    payment_count = db.query(Payment).count()
    db.close()
    monkeypatch.setattr(settings, "app_env", "production")
    assert c.post("/api/v1/payments/initiate", headers=H(cust), json={"order_id": oid, "amount": 2160}).status_code == 400
    db = SessionLocal()
    assert db.query(Payment).count() == payment_count
    db.close()
    assert c.post("/api/v1/payments/simulate", headers=H(cust), json={"txn_id": txn, "success": True}).status_code in (400, 403)
    assert c.post("/api/v1/payments/webhook", content=b"{}", headers={"X-Razorpay-Signature": "abc"}).status_code == 400

    # authorization boundaries
    assert c.get("/api/v1/orders/admin", headers=H(cust)).status_code == 403
    assert c.get("/api/v1/settings/app/admin", headers=H(cust)).status_code == 403
    assert c.get(f"/api/v1/orders/my/{oid}", headers=H(other)).status_code in (403, 404)
    assert c.get("/api/v1/orders/admin", headers=H(admin_tok)).status_code == 200
    assert "stylistSystemPrompt" not in c.get("/api/v1/settings/app").json()


def test_login_is_rate_limited(c):
    codes = [c.post("/api/v1/auth/login", json={"email": "nobody@example.com", "password": "wrong-pass"}, headers={"X-Forwarded-For": "10.9.9.9"}).status_code for _ in range(12)]
    assert 429 in codes and codes[0] != 429


def test_email_otp_send_fails_closed_when_provider_missing(c, monkeypatch):
    from app.core.exceptions import ServiceUnavailableError
    monkeypatch.setattr("app.core.config.settings.resend_api_key", "")
    email = "missing-provider@example.com"
    response = c.post("/api/v1/otp/send", json={"email": email}, headers={"X-Forwarded-For": "10.40.0.1"})
    assert response.status_code == 503
    db = SessionLocal()
    assert db.query(OTP).filter(OTP.identifier == email).count() == 0
    db.close()


def test_registration_fails_before_creating_account_without_email_provider(c, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.resend_api_key", "")
    response = c.post("/api/v1/auth/register", json={
        "full_name": "Launch Test",
        "email": "registration-provider-missing@example.com",
        "phone_number": "+919876543210",
        "password": "safe-test-password-123",
    }, headers={"X-Forwarded-For": "10.40.0.2"})
    assert response.status_code == 503
    db = SessionLocal()
    assert db.query(User).filter(User.email == "registration-provider-missing@example.com").first() is None
    db.close()
