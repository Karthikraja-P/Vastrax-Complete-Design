import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.address import Address
from app.models.order import Order
from app.models.user import User


def _shipment_fixture():
    suffix = uuid.uuid4().hex[:10]
    db = SessionLocal()
    user = User(
        id=f"tracking-customer-{suffix}", email=f"tracking-{suffix}@example.test",
        full_name="Tracking Customer", hashed_password="test", role="customer", is_active=True,
    )
    address = Address(
        id=f"tracking-address-{suffix}", user_id=user.id, label="Home",
        address_line1="1 Main Road", city="Mumbai", state="Maharashtra", pincode="400001",
    )
    order = Order(
        id=f"VX-TRACK-{suffix}", user_id=user.id, address_id=address.id,
        total_amount=Decimal("1000.00"), status="packed", payment_status="paid",
        shipping_shipment_id=f"{12345000 + int(suffix[:4], 16)}", shipping_awb=f"AWB-{suffix}",
    )
    db.add_all([user, address, order])
    db.commit()
    result = {
        "order_id": order.id,
        "shipment_id": order.shipping_shipment_id,
        "awb": order.shipping_awb,
        "token": create_access_token({"sub": user.id}),
    }
    db.close()
    return result


def test_shiprocket_status_callback_requires_configured_x_api_key(monkeypatch):
    data = _shipment_fixture()
    monkeypatch.setattr(settings, "shiprocket_webhook_token", "test-courier-webhook-secret")
    client = TestClient(app)

    rejected = client.post("/api/v1/shipping/status-callback", json={"awb": data["awb"], "shipment_status": "IN TRANSIT"})
    assert rejected.status_code == 401

    accepted = client.post(
        "/api/v1/shipping/status-callback",
        headers={"x-api-key": "test-courier-webhook-secret"},
        json={"awb": data["awb"], "shipment_status": "IN TRANSIT", "courier_name": "Courier Test"},
    )
    assert accepted.status_code == 200
    assert accepted.json()["shipping_status"] == "IN TRANSIT"

    orders = client.get("/api/v1/orders/my", headers={"Authorization": f"Bearer {data['token']}"})
    order = next(item for item in orders.json() if item["id"] == data["order_id"])
    assert order["status"] == "shipped"
    assert order["shipping_status"] == "IN TRANSIT"
    assert order["shipping_courier"] == "Courier Test"


def test_delivered_tracking_event_cannot_be_regressed_by_late_event(monkeypatch):
    data = _shipment_fixture()
    monkeypatch.setattr(settings, "shiprocket_webhook_token", "test-courier-webhook-secret")
    client = TestClient(app)
    headers = {"x-api-key": "test-courier-webhook-secret"}

    delivered = client.post(
        "/api/v1/shipping/status-callback", headers=headers,
        json={"awb": data["awb"], "shipment_status_id": 7},
    )
    assert delivered.status_code == 200
    assert delivered.json()["shipping_status"] == "DELIVERED"

    late = client.post(
        "/api/v1/shipping/status-callback", headers=headers,
        json={"awb": data["awb"], "shipment_status": "IN TRANSIT"},
    )
    assert late.status_code == 200
    orders = client.get("/api/v1/orders/my", headers={"Authorization": f"Bearer {data['token']}"})
    order = next(item for item in orders.json() if item["id"] == data["order_id"])
    assert order["status"] == "delivered"
    assert order["shipping_status"] == "DELIVERED"
