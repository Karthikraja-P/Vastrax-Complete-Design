import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.core.config import settings
from app.db.database import SessionLocal
from app.main import app
from app.models.address import Address
from app.models.business import StockMovement
from app.models.category import Category
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.rto_receipt import RtoReceipt
from app.models.user import User


def _rto_fixture():
    suffix = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(id=f"rto-admin-{suffix}", email=f"rto-admin-{suffix}@example.test",
                 full_name="RTO Admin", hashed_password="test", role="admin", is_active=True)
    customer = User(id=f"rto-customer-{suffix}", email=f"rto-customer-{suffix}@example.test",
                    full_name="RTO Customer", hashed_password="test", role="customer", is_active=True)
    address = Address(id=f"rto-address-{suffix}", user_id=customer.id, label="Home",
                      address_line1="1 Main Road", city="Mumbai", state="Maharashtra", pincode="400001")
    category = Category(id=f"rto-category-{suffix}", name=f"RTO {suffix}", slug=f"rto-{suffix}")
    product = Product(id=f"rto-product-{suffix}", category_id=category.id, name="RTO Dress",
                      price_mrp=100, price_selling=90)
    variant = ProductVariant(id=f"rto-variant-{suffix}", product_id=product.id,
                              sku=f"rto-sku-{suffix}", size="M", stock_qty=1)
    order = Order(id=f"VX-RTO-{suffix}", user_id=customer.id, address_id=address.id,
                  total_amount=Decimal("90.00"), status="shipped", payment_status="paid",
                  shipping_status="RTO IN TRANSIT", shipping_shipment_id="12345678",
                  shipping_awb=f"RTO-AWB-{suffix}")
    line = OrderItem(id=f"rto-line-{suffix}", order_id=order.id, product_id=product.id,
                     variant_id=variant.id, quantity=1, unit_price=Decimal("90.00"))
    db.add_all([admin, customer, address, category, product, variant, order, line])
    db.commit()
    result = {
        "order_id": order.id, "line_id": line.id, "variant_id": variant.id,
        "admin_token": create_access_token({"sub": admin.id}),
        "customer_token": create_access_token({"sub": customer.id}),
        "awb": order.shipping_awb,
    }
    db.close()
    return result


def test_admin_can_decide_shiprocket_ndr_action(monkeypatch):
    from app.api.routes import shipping

    data = _rto_fixture()
    monkeypatch.setattr(shipping, "get_ndr_shipments", lambda **kwargs: {
        "status": 200, "data": [{"awb": data["awb"], "ndr_reason": "Customer unavailable", "ndr_attempt": 1}],
    })
    submitted = {}
    monkeypatch.setattr(shipping, "submit_ndr_action", lambda awb, action, comments, **kwargs: (
        submitted.update({"awb": awb, "action": action, "comments": comments}) or {"status": 200, "data": {"message": "Action accepted"}}
    ))
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {data['admin_token']}"}

    ndr = client.get("/api/v1/shipping/admin/ndr", headers=headers)
    assert ndr.status_code == 200
    assert ndr.json()["items"][0]["order_id"] == data["order_id"]

    action = client.post(
        f"/api/v1/shipping/admin/orders/{data['order_id']}/ndr-action",
        headers=headers, json={"action": "return", "comments": "Customer declined delivery"},
    )
    assert action.status_code == 200, action.text
    assert submitted["action"] == "return"
    db = SessionLocal()
    order = db.query(Order).filter(Order.id == data["order_id"]).one()
    assert order.shipping_status == "NDR RETURN REQUESTED"
    db.close()


def test_rto_webhook_creates_receipt_and_admin_reconciles_stock_once(monkeypatch):
    data = _rto_fixture()
    monkeypatch.setattr(settings, "shiprocket_webhook_token", "rto-test-webhook")
    client = TestClient(app)
    callback = client.post(
        "/api/v1/shipping/status-callback",
        headers={"x-api-key": "rto-test-webhook"},
        json={"awb": data["awb"], "shipment_status": "RTO DELIVERED", "courier_name": "Return Courier"},
    )
    assert callback.status_code == 200, callback.text

    db = SessionLocal()
    order = db.query(Order).filter(Order.id == data["order_id"]).one()
    assert order.status == "returned"
    assert order.shipping_status == "RTO DELIVERED"
    receipt = db.query(RtoReceipt).filter(RtoReceipt.order_id == data["order_id"]).one()
    receipt_id = receipt.id
    variant = db.query(ProductVariant).filter(ProductVariant.id == data["variant_id"]).one()
    assert variant.stock_qty == 1
    db.close()

    headers = {"Authorization": f"Bearer {data['admin_token']}"}
    receive = client.post(
        f"/api/v1/shipping/admin/rto-receipts/{receipt_id}/receive",
        headers=headers,
        json={"notes": "Parcel opened and inspected", "items": [{
            "order_item_id": data["line_id"], "quantity_received": 1, "quantity_restocked": 1,
        }]},
    )
    assert receive.status_code == 200, receive.text
    assert receive.json()["status"] == "received"

    duplicate = client.post(
        f"/api/v1/shipping/admin/rto-receipts/{receipt_id}/receive",
        headers=headers,
        json={"items": [{"order_item_id": data["line_id"], "quantity_received": 1, "quantity_restocked": 1}]},
    )
    assert duplicate.status_code == 409

    db = SessionLocal()
    variant = db.query(ProductVariant).filter(ProductVariant.id == data["variant_id"]).one()
    movement = db.query(StockMovement).filter(StockMovement.reference_id == receipt_id).one()
    assert variant.stock_qty == 2
    assert movement.quantity_delta == 1
    db.close()
