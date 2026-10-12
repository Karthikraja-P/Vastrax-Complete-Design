"""Integration tests for Vastrax CRM and purchasing/inventory workflows."""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.database import SessionLocal
from app.main import app
from app.models.address import Address
from app.models.business import CRMActivity
from app.models.category import Category
from app.models.product import Product
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product_variant import ProductVariant
from app.models.user import User
from app.models.ledger import LedgerAccount


@pytest.fixture()
def business_admin():
    suffix = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(id=f"admin-{suffix}", email=f"admin-{suffix}@example.test", hashed_password="test", role="admin", is_active=True)
    customer = User(id=f"customer-{suffix}", email=f"customer-{suffix}@example.com", full_name="Beta Customer", hashed_password="test", role="customer", is_active=True)
    category = Category(id=f"cat-{suffix}", name=f"Business {suffix}", slug=f"business-{suffix}")
    product = Product(id=f"p-{suffix}", category_id=category.id, name="Test Dress", price_mrp=100, price_selling=90)
    variant = ProductVariant(id=f"v-{suffix}", product_id=product.id, sku=f"sku-{suffix}", size="S", stock_qty=4)
    inventory_account = LedgerAccount(code=f"INV-{suffix}", name="Inventory", account_type="asset")
    payable_account = LedgerAccount(code=f"AP-{suffix}", name="Supplier payable", account_type="liability")
    db.add_all([admin, customer, category, product, variant, inventory_account, payable_account])
    db.commit()
    customer_id, variant_id = customer.id, variant.id
    token = create_access_token({"sub": admin.id})
    customer_token = create_access_token({"sub": customer.id})
    account_ids = {"inventory_account_id": inventory_account.id, "payable_account_id": payable_account.id}
    db.close()
    yield {"token": token, "customer_token": customer_token, "customer_id": customer_id, "variant_id": variant_id, "suffix": suffix, **account_ids}



def test_crm_customer_detail_reads_shared_orders_and_activities(business_admin):
    db = SessionLocal()
    variant = db.get(ProductVariant, business_admin["variant_id"])
    address = Address(user_id=business_admin["customer_id"], label="Home", address_line1="1 Test Street", city="Mumbai", state="Maharashtra", pincode="400001")
    db.add(address)
    db.flush()
    order = Order(id=f"order-{business_admin['suffix']}", user_id=business_admin["customer_id"], address_id=address.id, total_amount=194.20, status="delivered", payment_status="paid")
    db.add(order)
    db.flush()
    db.add(OrderItem(order_id=order.id, product_id=variant.product_id, variant_id=variant.id, quantity=2, unit_price=90))
    db.add(CRMActivity(customer_id=business_admin["customer_id"], activity_type="note", subject="Prefers phone contact", created_by=f"admin-{business_admin['suffix']}"))
    db.commit()
    order_id = order.id
    db.close()

    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    assert client.get(f"/api/v1/crm/customers/{business_admin['customer_id']}").status_code == 401
    detail = client.get(f"/api/v1/crm/customers/{business_admin['customer_id']}", headers=headers)
    assert detail.status_code == 200, detail.text
    payload = detail.json()
    assert payload["customer"]["id"] == business_admin["customer_id"]
    assert payload["orders"][0]["id"] == order_id
    assert payload["orders"][0]["items"] == [{"product_name": "Test Dress", "size": "S", "quantity": 2, "unit_price": "90.00"}]
    assert payload["activities"][0]["subject"] == "Prefers phone contact"
    note = client.post("/api/v1/crm/activities", headers=headers, json={
        "customer_id": business_admin["customer_id"],
        "activity_type": "note",
        "subject": "Customer note",
        "description": "Asked for a call next week",
    })
    assert note.status_code == 201, note.text
    updated = client.get(f"/api/v1/crm/customers/{business_admin['customer_id']}", headers=headers).json()
    assert any(activity["description"] == "Asked for a call next week" for activity in updated["activities"])



def test_admin_grants_scoped_business_access_to_existing_team_accounts(business_admin):
    client = TestClient(app)
    admin_headers = {"Authorization": f"Bearer {business_admin['token']}"}
    member_toke
        "full_name": "Existing Customer Prospect", "email": customer_email, "source": "website",
    })
    assert created.status_code == 201, created.text
    lead_id = created.json()["id"]
    assert client.post(f"/api/v1/crm/leads/{lead_id}/convert").status_code == 401
    assert client.post(f"/api/v1/crm/leads/{lead_id}/convert", headers=headers).status_code == 409
    qualified = client.patch(f"/api/v1/crm/leads/{lead_id}", headers=headers, json={"stage": "qualified"})
    assert qualified.status_code == 200

    converted = client.post(f"/api/v1/crm/leads/{lead_id}/convert", headers=headers)
    assert converted.status_code == 200, converted.text
    assert converted.json()["stage"] == "converted"
    assert converted.json()["converted_customer_id"] == business_admin["customer_id"]
    assert client.patch(f"/api/v1/crm/leads/{lead_id}", headers=headers, json={"stage": "lost"}).status_code == 409

    detail = client.get(f"/api/v1/crm/customers/{business_admin['customer_id']}", headers=headers)
    assert detail.status_code == 200
    assert any(a["subject"] == "Lead converted to customer" for a in detail.json()["activities"])


def test_supplier_maintenance_updates_and_deactivates_without_deleting_history(business_admin):
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    supplier_path = "/api/v1/erp/suppliers"
    assert client.patch(f"{supplier_path}/missing", json={"name": "Renamed"}).status_code == 401

    created = client.post(supplier_path, headers=headers, json={
        "name": "  Textile House  ", "contact_name": "Asha", "email": "asha@example.test",
        "phone": "+91 90000 00000", "gstin": "27ABCDE1234F1Z5", "address": "Mumbai",
    })
    assert created.status_code == 201, created.text
    supplier = created.json()
    assert supplier["name"] == "Textile House"
    assert supplier["is_active"] is True

    updated = client.patch(f"{supplier_path}/{supplier['id']}", headers=headers, json={
        "contact_name": "Asha Rao", "phone": "+91 91111 11111", "gstin": "27ABCDE1234F1Z5",
    })
    assert updated.status_code == 200, updated.text
    assert updated.json()["contact_name"] == "Asha Rao"
    assert updated.json()["phone"] == "+91 91111 11111"
    assert client.patch(f"{supplier_path}/{supplier['id']}", headers=headers, json={"name": "   "}).status_code == 422
    assert client.patch(f"{supplier_path}/{supplier['id']}", headers=headers, json={}).status_code == 422

    inactive = client.patch(f"{supplier_path}/{supplier['id']}", headers=headers, json={"is_active": False})
    assert inactive.status_code == 200 and inactive.json()["is_active"] is False
    rejected_po = client.post("/api/v1/erp/purchase-orders", headers=headers, json={
        "supplier_id": supplier["id"],
        "items": [{"variant_id": business_admin["variant_id"], "quantity": 1, "unit_cost": "100.00"}],
    })
    assert rejected_po.status_code == 404

    reactivated = client.patch(f"{supplier_path}/{supplier['id']}", headers=headers, json={"is_active": True})
    assert reactivated.status_code == 200 and reactivated.json()["is_active"] is True
    po = client.post("/api/v1/erp/purchase-orders", headers=headers, json={
        "supplier_id": supplier["id"],
        "items": [{"variant_id": business_admin["variant_id"], "quantity": 1, "unit_cost": "100.00"}],
    })
    assert po.status_code == 201, po.text
    listed = client.get(supplier_path, headers=headers)
    assert listed.status_code == 200
    assert any(row["id"] == supplier["id"] and row["is_active"] for row in listed.json())
