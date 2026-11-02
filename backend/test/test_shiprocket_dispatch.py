import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.address import Address
from app.models.order import Order
from app.models.user import User


def _dispatch_fixture(payment_method="UPI", payment_status="paid"):
    suffix = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(
        id=f"dispatch-admin-{suffix}", email=f"dispatch-admin-{suffix}@example.test",
        full_name="Dispatch Admin", hashed_password="test", role="admin", is_active=True,
    )
    customer = User(
        id=f"dispatch-customer-{suffix}", email=f"dispatch-customer-{suffix}@example.test",
        full_name="Dispatch Customer", hashed_password="test", role="customer", is_active=True,
    )
    address = Address(
        id=f"dispatch-address-{suffix}", user_id=customer.id, label="Home",
        address_line1="1 Main Road", city="Mumbai", state="Maharashtra", pincode="400001",
    )
    order = Order(
        id=f"VX-DISPATCH-{suffix}", user_id=customer.id, address_id=address.id,
        total_amount=Decimal("1000.00"), status="packed", payment_status=payment_status,
        payment_method=payment_method, shipping_shipment_id="12345678",
        shipping_status="Awaiting courier assignment",
    )
    db.add_all([admin, customer, address, order])
    db.commit()
    result = {"order_id": order.id, "admin_token": create_access_token({"sub": admin.id})}
    db.close()
    return result


def test_admin_dispatch_assigns_awb_schedules_pickup_and_generates_manifest(monkeypatch):
    from app.api.routes import shipping

    fixture = _dispatch_fixture()
    calls = []

    def assign(shipment_id, courier_id=None):
        calls.append(("assign", shipment_id, courier_id))
        return {"status": 200, "awb_code": "AWB-123", "courier_name": "Courier One"}

    def pickup(shipment_id, pickup_date):
        calls.append(("pickup", shipment_id, pickup_date))
        return {"status": 200}

    def manifest(shipment_id):
        calls.append(("manifest", shipment_id))
        return {"status_code": 200, "manifest_url": "https://shiprocket.example/manifest.pdf"}

    monkeypatch.setattr(shipping, "assign_awb", assign)
    monkeypatch.setattr(shipping, "schedule_pickup", pickup)
    monkeypatch.setattr(shipping, "generate_manifest", manifest)

    client = TestClient(app)
    response = client.post(
        f"/api/v1/shipping/admin/orders/{fixture['order_id']}/dispatch",
        headers={"Authorization": f"Bearer {fixture['admin_token']}"},
        json={"pickup_date": (date.today() + timedelta(days=1)).isoformat()},
    )

    assert response.status_code == 200, response.text
    assert response.json()["shipping_status"] == "Manifest generated"
    assert response.json()["awb_code"] == "AWB-123"
    assert [call[0] for call in calls] == ["assign", "pickup", "manifest"]

    db = SessionLocal()
    stored = db.query(Order).filter(Order.id == fixture["order_id"]).one()
    assert stored.shipping_awb == "AWB-123"
    assert stored.shipping_courier == "Courier One"
    assert stored.shipping_status == "Manifest generated"
    db.delete(stored)
    db.commit()
    db.close()


def test_admin_dispatch_rejects_unpaid_prepaid_order(monkeypatch):
    from app.api.routes import shipping

    fixture = _dispatch_fixture(payment_method="UPI", payment_status="pending")
    monkeypatch.setattr(shipping, "assign_awb", lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("must not assign AWB")))

    client = TestClient(app)
    response = client.post(
        f"/api/v1/shipping/admin/orders/{fixture['order_id']}/dispatch",
        headers={"Authorization": f"Bearer {fixture['admin_token']}"},
        json={"pickup_date": (date.today() + timedelta(days=1)).isoformat()},
    )

    assert response.status_code == 409


def test_shiprocket_draft_uses_order_payment_method(monkeypatch):
    from types import SimpleNamespace

    from app.services import order_service

    captured = {}

    def create_shipment_order(**kwargs):
        captured.update(kwargs)
        return {"shipment_id": "12345678"}

    monkeypatch.setattr("app.services.shiprocket_service.create_shipment_order", create_shipment_order)
    order = SimpleNamespace(
        id="VX-PREPAID-1", items=[], total_amount=Decimal("1000.00"),
        payment_method="UPI", shipping_shipment_id=None, shipping_awb=None,
        shipping_courier=None, shipping_courier_id=None, shipping_status=None,
    )
    user = SimpleNamespace(full_name="Test Buyer", email="buyer@example.test", phone_number="9876543210")
    address = SimpleNamespace(address_line1="1 Main Road", city="Mumbai", state="Maharashtra", pincode="400001")

    order_service._book_shiprocket(order, user, address)

    assert captured["payment_method"] == "UPI"
    assert order.shipping_shipment_id == "12345678"
    assert order.shipping_status == "Awaiting courier assignment"

