"""Regression coverage for return eligibility, review, receipts, and inventory sync."""
import uuid
from decimal import Decimal

from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.address import Address
from app.models.category import Category
from app.models.order import Order
from app.models.order_item import OrderItem
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
    db.add_all([admin, customer, address, category, product, variant, order, order_item])
    db.commit()
    data = {"admin": admin.id, "order": order.id, "item": order_item.id, "variant": variant.id, "token": create_access_token({"sub": admin.id})}
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
