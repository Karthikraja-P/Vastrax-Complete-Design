"""Regression coverage for return eligibility, review, receipts, and inventory sync."""
import uuid
import hashlib
import hmac
import json
import pytest
from decimal import Decimal

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.core.exceptions import BadRequestError
from app.db.database import SessionLocal
from app.main import app
from app.models.address import Address
from app.models.category import Category
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.payment import Payment
from app.models.payment_refund import PaymentRefund
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.user import User


def _return_fixture():
    suffix = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(id=f"admin-{suffix}", email=f"admin-{suffix}@example.test", hashed_password="test", role="admin", is_active=True)
    customer = User(id=f"customer-{suffix}", email=f"customer-{suffix}@example.test", full_name="Return Customer", hashed_password="test", role="customer", is_active=True)
    address = Address(id=f"address-{suffix}", user_id=customer.id, label="Home", address_line1="1 Main Road", city="Mumbai", state="MH", pincode="400001")
    category = Category(id=f"cat-{suffix}", name=f"Returns {suffix}", slug=f"returns-{suffix}")
    product = Product(id=f"product-{suffix}", category_id=category.id, name="Return Dress", price_mrp=100, price_selling=90)
    variant = ProductVariant(id=f"variant-{suffix}", product_id=product.id, sku=f"return-{suffix}", size="M", stock_qty=3)
    order = Order(id=f"order-{suffix}", user_id=customer.id, address_id=address.id, total_amount=Decimal("180"), status="delivered", payment_status="paid")
    order_item = OrderItem(id=f"item-{suffix}", order_id=order.id, product_id=product.id, variant_id=variant.id, quantity=2, unit_price=Decimal("90"))
    payment = Payment(id=f"txn-{suffix}", order_id=order.id, user_id=customer.id, amount=Decimal("180"), method="UPI", status="success")
    db.add_all([admin, customer, address, category, product, variant, order, order_item, payment])
    db.commit()
    data = {"admin": admin.id, "order": order.id, "item": order_item.id, "variant": variant.id, "payment": payment.id, "token": create_access_token({"sub": admin.id})}
    db.close()
    return data


def test_return_review_receipt_restock_and_quantity_caps():
    data = _return_fixture()
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {data['token']}"}
    assert client.get("/api/v1/erp/returns").status_code == 401
    assert client.get("/api/v1/erp/returnable-orders", headers=headers).json()[0]["id"] == data["order"]
    created = client.post("/api/v1/erp/returns", headers=headers, json={
        "order_id": data["order"], "reason": "size", "items": [{"order_item_id": data["item"], "quantity": 1}],
    })
    assert created.status_code == 201, created.text
    case = created.json()
    assert case["status"] == "requested" and case["items"][0]["unit_price"] == "90.00"
    excess = client.post("/api/v1/erp/returns", headers=headers, json={
        "order_id": data["order"], "reason": "quality", "items": [{"order_item_id": data["item"], "quantity": 2}],
    })
    assert excess.status_code == 409
    approved = client.post(f"/api/v1/erp/returns/{case['id']}/review", headers=headers, json={"decision": "approve"})
    assert approved.status_code == 200 and approved.json()["status"] == "approved"
    line_id = case["items"][0]["id"]
    received = client.post(f"/api/v1/erp/returns/{case['id']}/receive", headers=headers, json={
        "items": [{"line_id": line_id, "quantity_received": 1, "quantity_restocked": 1}],
    })
    assert received.status_code == 200 and received.json()["status"] == "received"
    db = SessionLocal()
    assert db.get(ProductVariant, data["variant"]).stock_qty == 4
    db.close()
    duplicate = client.post(f"/api/v1/erp/returns/{case['id']}/receive", headers=headers, json={
        "items": [{"line_id": line_id, "quantity_received": 1, "quantity_restocked": 1}],
    })
    assert duplicate.status_code == 409
    movement = client.get("/api/v1/erp/inventory/movements", headers=headers, params={"variant_id": data["variant"]})
    assert any(row["reason"] == "customer_return" and row["reference_id"] == case["id"] for row in movement.json())



def test_return_refund_is_linked_capped_and_auditable():
    data = _return_fixture()
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {data['token']}"}
    case = client.post("/api/v1/erp/returns", headers=headers, json={
        "order_id": data["order"], "reason": "size", "items": [{"order_item_id": data["item"], "quantity": 1}],
    }).json()
    client.post(f"/api/v1/erp/returns/{case['id']}/review", headers=headers, json={"decision": "approve"})
    early = client.post(f"/api/v1/erp/returns/{case['id']}/refund", headers=headers, json={"txn_id": data["payment"], "amount": "40.00"})
    assert early.status_code == 400
    client.post(f"/api/v1/erp/returns/{case['id']}/receive", headers=headers, json={
        "items": [{"line_id": case["items"][0]["id"], "quantity_received": 1, "quantity_restocked": 1}],
    })

    partial = client.post(f"/api/v1/erp/returns/{case['id']}/refund", headers=headers, json={"txn_id": data["payment"], "amount": "40.00"})
    assert partial.status_code == 200, partial.text
    assert partial.json()["status"] == "partially_refunded"
    too_much = client.post(f"/api/v1/erp/returns/{case['id']}/refund", headers=headers, json={"txn_id": data["payment"], "amount": "150.00"})
    assert too_much.status_code == 400
    detail = client.get("/api/v1/erp/returns", headers=headers).json()
    linked = next(row for row in detail if row["id"] == case["id"])
    assert linked["payments"][0]["refundable_amount"] == "140.00"
    assert linked["payments"][0]["refunds"][0]["amount"] == "40.00"

    final = client.post(f"/api/v1/erp/returns/{case['id']}/refund", headers=headers, json={"txn_id": data["payment"], "amount": "140.00"})
    assert final.status_code == 200 and final.json()["status"] == "refunded"
    db = SessionLocal()
    payment = db.get(Payment, data["payment"])
    assert payment.status == "refunded"
    assert db.query(PaymentRefund).filter(PaymentRefund.payment_id == data["payment"], PaymentRefund.return_id == case["id"], PaymentRefund.status == "processed").count() == 2
    db.close()


def test_ambiguous_gateway_refund_is_reserved_not_marked_success(monkeypatch):
    from app.core.config import settings
    from app.services.payment_service import PaymentService
    import requests

    data = _return_fixture()
    db = SessionLocal()
    payment = db.get(Payment, data["payment"])
    payment.razorpay_payment_id = "pay_gateway_test"
    db.commit()
    monkeypatch.setattr(settings, "razorpay_key_id", "rzp_live_test")
    monkeypatch.setattr(settings, "razorpay_key_secret", "gateway-test-secret")
    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: (_ for _ in ()).throw(requests.Timeout("timeout")))
    with pytest.raises(BadRequestError, match="reserved for reconciliation"):
        PaymentService(db).process_refund(payment.id, Decimal("20.00"), created_by_id=data["admin"])
    row = db.query(PaymentRefund).filter(PaymentRefund.payment_id == payment.id).one()
    assert row.status == "unknown"
    assert payment.status == "success"
    with pytest.raises(BadRequestError, match="remaining refundable amount"):
        PaymentService(db).process_refund(payment.id, Decimal("170.00"), created_by_id=data["admin"])
    db.close()



def test_gateway_refund_webhook_confirms_partial_refund_idempotently(monkeypatch):
    import requests
    from app.core.config import settings
    from app.models.order import Order
    from app.services.payment_service import PaymentService

    data = _return_fixture()
    db = SessionLocal()
    payment = db.get(Payment, data["payment"])
    payment.razorpay_payment_id = "pay_gateway_test"
    db.commit()
    monkeypatch.setattr(settings, "razorpay_key_id", "rzp_live_test")
    monkeypatch.setattr(settings, "razorpay_key_secret", "gateway-test-secret")
    monkeypatch.setattr(settings, "razorpay_webhook_secret", "webhook-test-secret")

    class GatewayResponse:
        status_code = 200
        def json(self):
            return {"id": "rfnd_partial_test", "payment_id": "pay_gateway_test", "amount": 2000, "status": "pending"}
    monkeypatch.setattr(requests, "post", lambda *args, **kwargs: GatewayResponse())
    result = PaymentService(db).process_refund(payment.id, Decimal("20.00"), created_by_id=data["admin"])
    assert result["status"] == "pending"
    assert payment.status == "success"

    body = json.dumps({"event": "refund.processed", "payload": {"refund": {"entity": {
        "id": "rfnd_partial_test", "payment_id": "pay_gateway_test", "amount": 2000,
    }}}}).encode()
    signature = hmac.new(b"webhook-test-secret", body, hashlib.sha256).hexdigest()
    service = PaymentService(db)
    assert service.handle_webhook(body, signature) == {"status": "ok"}
    assert service.handle_webhook(body, signature) == {"status": "ok"}
    db.refresh(payment)
    assert payment.status == "partially_refunded"
    assert db.get(Order, data["order"]).payment_status == "partially_refunded"
    assert db.query(PaymentRefund).filter(PaymentRefund.gateway_refund_id == "rfnd_partial_test").count() == 1
    db.close()
