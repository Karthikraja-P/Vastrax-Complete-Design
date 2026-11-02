import uuid
from datetime import date, timedelta
from decimal import Decimal

from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.config import settings
from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.address import Address
from app.models.category import Category
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.returns import SalesReturn
from app.models.user import User


def _fixture():
    suffix = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(id=f"return-admin-{suffix}", email=f"return-admin-{suffix}@example.test",
                 full_name="Return Admin", hashed_password="test", role="admin", is_active=True)
    customer = User(id=f"return-customer-{suffix}", email=f"return-customer-{suffix}@example.test",
                    full_name="Return Customer", phone_number=f"9{int(suffix[:9], 16) % 1_000_000_000:09d}", hashed_password="test",
                    role="customer", is_active=True)
    other_customer = User(id=f"other-return-customer-{suffix}", email=f"other-return-customer-{suffix}@example.test",
                          full_name="Other Customer", hashed_password="test", role="customer", is_active=True)
    address = Address(id=f"return-address-{suffix}", user_id=customer.id, label="Home",
                      address_line1="1 Main Road", city="Mumbai", state="Maharashtra", pincode="400001")
    category = Category(id=f"return-category-{suffix}", name=f"Return {suffix}", slug=f"return-{suffix}")
    product = Product(id=f"return-product-{suffix}", category_id=category.id, name="Return Dress",
                      price_mrp=100, price_selling=90)
    variant = ProductVariant(id=f"return-variant-{suffix}", product_id=product.id,
                              sku=f"return-sku-{suffix}", size="M", stock_qty=3)
    order = Order(id=f"VX-RETURN-{suffix}", user_id=customer.id, address_id=address.id,
                  total_amount=Decimal("180.00"), status="delivered", payment_status="paid",
                  shipping_status="DELIVERED")
    line = OrderItem(id=f"return-item-{suffix}", order_id=order.id, product_id=product.id,
                     variant_id=variant.id, quantity=2, unit_price=Decimal("90.00"))
    db.add_all([admin, customer, other_customer, address, category, product, variant, order, line])
    db.commit()
    result = {
        "admin": admin.id, "customer": customer.id, "order": order.id, "line": line.id,
        "admin_token": create_access_token({"sub": admin.id}),
        "customer_token": create_access_token({"sub": customer.id}),
        "other_token": create_access_token({"sub": other_customer.id}),
    }
    db.close()
    return result


def test_customer_can_request_return_for_delivered_order_and_admin_books_reverse_pickup(monkeypatch):
    from app.api.routes import returns as returns_route

    data = _fixture()
    client = TestClient(app)
    customer_headers = {"Authorization": f"Bearer {data['customer_token']}"}
    admin_headers = {"Authorization": f"Bearer {data['admin_token']}"}

    created = client.post(
        f"/api/v1/orders/my/{data['order']}/returns",
        headers=customer_headers,
        json={"reason": "size", "notes": "Please exchange/return the fit", "items": [{"order_item_id": data["line"], "quantity": 1}]},
    )
    assert created.status_code == 201, created.text
    case = created.json()
    assert case["status"] == "requested"
    assert case["request_source"] == "customer"
    assert case["items"][0]["quantity_requested"] == 1

    own_cases = client.get("/api/v1/orders/my/returns", headers=customer_headers)
    assert own_cases.status_code == 200
    assert [row["id"] for row in own_cases.json()] == [case['id']]
    other_headers = {"Authorization": f"Bearer {data['other_token']}"}
    assert client.get("/api/v1/orders/my/returns", headers=other_headers).json() == []
    assert client.get("/api/v1/orders/my/returns").status_code == 401

    calls = []
    monkeypatch.setattr(returns_route, "get_return_destination", lambda: {
        "status": 200, "data": {"name": "VastraX", "address": "Warehouse Road", "address_2": "",
        "city": "Chennai", "state": "Tamil Nadu", "country": "India", "pincode": "600001",
        "email": "returns@example.test", "phone": "9000000000", "pickup_location": "Primary"}
    })

    def create_return(order_id, payload):
        calls.append(("create", order_id, payload))
        return {"status": 201, "order_id": "987654321", "shipment_id": "12345678"}

    def assign_awb(shipment_id, courier_id=None):
        calls.append(("awb", shipment_id, courier_id))
        return {"status": 200, "awb_code": "REV-AWB-123", "courier_name": "Reverse Courier"}

    def schedule_pickup(shipment_id, pickup_date):
        calls.append(("pickup", shipment_id, pickup_date))
        return {"status": 200}

    monkeypatch.setattr(returns_route, "create_return_shipment", create_return)
    monkeypatch.setattr(returns_route, "assign_awb", assign_awb)
    monkeypatch.setattr(returns_route, "schedule_pickup", schedule_pickup)

    no_date = client.post(f"/api/v1/erp/returns/{case['id']}/review", headers=admin_headers,
                          json={"decision": "approve"})
    assert no_date.status_code == 422
    assert calls == []

    booked = client.post(
        f"/api/v1/erp/returns/{case['id']}/review",
        headers=admin_headers,
        json={"decision": "approve", "pickup_date": (date.today() + timedelta(days=1)).isoformat()},
    )
    assert booked.status_code == 200, booked.text
    assert booked.json()["status"] == "approved"
    assert booked.json()["reverse_status"] == "Return pickup scheduled"
    assert booked.json()["reverse_awb"] == "REV-AWB-123"
    assert [row[0] for row in calls] == ["create", "awb", "pickup"]
    assert calls[0][2]["pickup_pincode"] == 400001
    assert calls[0][2]["shipping_address"] == "Warehouse Road"
    assert len(calls[0][2]["pickup_phone"]) == 10

    admin_case = next(row for row in client.get("/api/v1/erp/returns", headers=admin_headers).json() if row["id"] == case['id'])
    line_id = admin_case["items"][0]["id"]
    early_receive = client.post(f"/api/v1/erp/returns/{case['id']}/receive", headers=admin_headers, json={
        "items": [{"line_id": line_id, "quantity_received": 1, "quantity_restocked": 1}],
    })
    assert early_receive.status_code == 409

    monkeypatch.setattr(settings, "shiprocket_webhook_token", "return-approval-test-token")
    delivered = client.post("/api/v1/shipping/status-callback",
        headers={"x-api-key": "return-approval-test-token"},
        json={"awb": "REV-AWB-123", "shipment_status": "RETURN DELIVERED"})
    assert delivered.status_code == 200
    received = client.post(f"/api/v1/erp/returns/{case['id']}/receive", headers=admin_headers, json={
        "items": [{"line_id": line_id, "quantity_received": 1, "quantity_restocked": 1}],
    })
    assert received.status_code == 200

    db = SessionLocal()
    stored = db.query(SalesReturn).filter(SalesReturn.id == case['id']).one()
    assert stored.reverse_shipment_id == "12345678"
    assert stored.reverse_awb == "REV-AWB-123"
    assert stored.request_source == "customer"
    db.close()


def test_return_webhook_updates_return_case_not_forward_order(monkeypatch):
    from app.models.returns import SalesReturn

    data = _fixture()
    client = TestClient(app)
    admin_token = data["admin_token"]
    case_response = client.post(
        f"/api/v1/orders/my/{data['order']}/returns",
        headers={"Authorization": f"Bearer {data['customer_token']}"},
        json={"reason": "damaged", "items": [{"order_item_id": data["line"], "quantity": 1}]},
    )
    assert case_response.status_code == 201
    case_id = case_response.json()["id"]
    db = SessionLocal()
    case = db.get(SalesReturn, case_id)
    case.reverse_shipment_id = "98765000"
    case.reverse_awb = "RETURN-AWB-321"
    case.status = "approved"
    db.commit()
    db.close()

    monkeypatch.setattr(settings, "shiprocket_webhook_token", "return-test-token")
    response = client.post(
        "/api/v1/shipping/status-callback",
        headers={"x-api-key": "return-test-token"},
        json={"awb": "RETURN-AWB-321", "shipment_status": "RETURN IN TRANSIT", "courier_name": "Reverse Courier"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["return_id"] == case_id
    db = SessionLocal()
    assert db.get(SalesReturn, case_id).reverse_status == "RETURN IN TRANSIT"
    db.close()


def test_return_destination_uses_the_configured_shiprocket_pickup_location(monkeypatch):
    from app.services import shiprocket_service

    class Response:
        status_code = 200

        def json(self):
            return {"data": {"shipping_address": [{
                "pickup_location": "Other",
                "is_primary_location": True,
                "name": "Wrong place",
                "address": "Wrong Road",
                "city": "Mumbai",
                "state": "Maharashtra",
                "pin_code": "400001",
                "phone": "9000000000",
            }], "recent_addresses": [{
                "pickup_location": "Returns Warehouse",
                "name": "VastraX Returns",
                "address": "Returns Road",
                "address_2": "",
                "city": "Chennai",
                "state": "Tamil Nadu",
                "country": "India",
                "pin_code": "600001",
                "email": "returns@example.test",
                "phone": "9000000001",
            }]}}

    monkeypatch.setattr(shiprocket_service, "get_token", lambda: "test-token")
    monkeypatch.setattr(shiprocket_service, "_pickup_location", lambda: "Returns Warehouse")
    monkeypatch.setattr(shiprocket_service.requests, "get", lambda *args, **kwargs: Response())

    result = shiprocket_service.get_return_destination()

    assert result["status"] == 200
    assert result["data"]["address"] == "Returns Road"
    assert result["data"]["pincode"] == "600001"


def test_customer_return_request_is_limited_to_seven_days_after_delivery():
    from datetime import datetime, timedelta, timezone

    from app.models.order import Order

    data = _fixture()
    db = SessionLocal()
    order = db.get(Order, data["order"])
    order.delivered_at = datetime.now(timezone.utc) - timedelta(days=8)
    db.commit()
    db.close()

    response = TestClient(app).post(
        f"/api/v1/orders/my/{data['order']}/returns",
        headers={"Authorization": f"Bearer {data['customer_token']}"},
        json={"reason": "size", "items": [{"order_item_id": data["line"], "quantity": 1}]},
    )
    assert response.status_code == 409
    assert "7 days" in response.json()["detail"]
