"""Integration tests for Vastrax CRM and purchasing/inventory workflows."""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
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
    customer = User(id=f"customer-{suffix}", email=f"customer-{suffix}@example.test", full_name="Beta Customer", hashed_password="test", role="customer", is_active=True)
    category = Category(id=f"cat-{suffix}", name=f"Business {suffix}", slug=f"business-{suffix}")
    product = Product(id=f"p-{suffix}", category_id=category.id, name="Test Dress", price_mrp=100, price_selling=90)
    variant = ProductVariant(id=f"v-{suffix}", product_id=product.id, sku=f"sku-{suffix}", size="S", stock_qty=4)
    inventory_account = LedgerAccount(code=f"INV-{suffix}", name="Inventory", account_type="asset")
    payable_account = LedgerAccount(code=f"AP-{suffix}", name="Supplier payable", account_type="liability")
    db.add_all([admin, customer, category, product, variant, inventory_account, payable_account])
    db.commit()
    customer_id, variant_id = customer.id, variant.id
    token = create_access_token({"sub": admin.id})
    account_ids = {"inventory_account_id": inventory_account.id, "payable_account_id": payable_account.id}
    db.close()
    yield {"token": token, "customer_id": customer_id, "variant_id": variant_id, "suffix": suffix, **account_ids}



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


def test_supplier_purchase_receipt_and_stock_audit(business_admin):
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    supplier = client.post("/api/v1/erp/suppliers", headers=headers, json={"name": "Textile House", "gstin": "27ABCDE1234F1Z5"})
    assert supplier.status_code == 201, supplier.text
    po = client.post("/api/v1/erp/purchase-orders", headers=headers, json={
        "supplier_id": supplier.json()["id"],
        "items": [{"variant_id": business_admin["variant_id"], "quantity": 5, "unit_cost": "220.00"}],
    })
    assert po.status_code == 201, po.text
    po_id = po.json()["id"]
    line = client.get("/api/v1/erp/purchase-orders", headers=headers).json()[0]["items"][0]
    invalid_accounts = client.post(f"/api/v1/erp/purchase-orders/{po_id}/receive", headers=headers, json={
        "items": [{"line_id": line["id"], "quantity": 1}],
        "inventory_account_id": business_admin["inventory_account_id"],
        "payable_account_id": business_admin["inventory_account_id"],
    })
    assert invalid_accounts.status_code == 422
    db = SessionLocal()
    assert db.get(ProductVariant, business_admin["variant_id"]).stock_qty == 4
    db.close()
    received = client.post(f"/api/v1/erp/purchase-orders/{po_id}/receive", headers=headers, json={"items": [{"line_id": line["id"], "quantity": 3}], "inventory_account_id": business_admin["inventory_account_id"], "payable_account_id": business_admin["payable_account_id"]})
    assert received.status_code == 200 and received.json()["status"] == "partially_received"
    db = SessionLocal()
    assert db.get(ProductVariant, business_admin["variant_id"]).stock_qty == 7
    db.close()
    journals = client.get("/api/v1/erp/journals", headers=headers).json()
    receipt_journal = next(entry for entry in journals if entry["description"].startswith("Inventory receipt for "))
    assert sum(float(line["debit"]) for line in receipt_journal["lines"]) == 660
    assert sum(float(line["credit"]) for line in receipt_journal["lines"]) == 660
    over = client.post(f"/api/v1/erp/purchase-orders/{po_id}/receive", headers=headers, json={"items": [{"line_id": line["id"], "quantity": 3}], "inventory_account_id": business_admin["inventory_account_id"], "payable_account_id": business_admin["payable_account_id"]})
    assert over.status_code == 409
    unauthorized_cancel = client.post(f"/api/v1/erp/purchase-orders/{po_id}/cancel")
    assert unauthorized_cancel.status_code == 401
    cancelled = client.post(f"/api/v1/erp/purchase-orders/{po_id}/cancel", headers=headers)
    assert cancelled.status_code == 200 and cancelled.json()["status"] == "cancelled"
    after_cancel = client.post(f"/api/v1/erp/purchase-orders/{po_id}/receive", headers=headers, json={
        "items": [{"line_id": line["id"], "quantity": 1}],
        "inventory_account_id": business_admin["inventory_account_id"],
        "payable_account_id": business_admin["payable_account_id"],
    })
    assert after_cancel.status_code == 404
    adjust = client.post(f"/api/v1/erp/inventory/{business_admin['variant_id']}/adjust", headers=headers, json={"quantity_delta": -1, "reason": "damaged"})
    assert adjust.status_code == 200 and adjust.json()["stock_after"] == 6
    movements = client.get("/api/v1/erp/inventory/movements", headers=headers, params={"variant_id": business_admin["variant_id"]}).json()
    assert {movement["reason"] for movement in movements} >= {"purchase_receipt", "damaged"}


def test_crm_leads_tasks_customer_metrics_and_admin_access(business_admin):
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    denied = client.get("/api/v1/crm/overview")
    assert denied.status_code == 401
    leads = client.post("/api/v1/crm/leads", headers=headers, json={"full_name": "Interested Shopper", "source": "website"})
    assert leads.status_code == 201, leads.text
    lead_id = leads.json()["id"]
    task = client.post("/api/v1/crm/activities", headers=headers, json={"lead_id": lead_id, "activity_type": "task", "subject": "Call about sizing", "due_at": "2020-01-01T00:00:00Z"})
    assert task.status_code == 201, task.text
    assert client.get("/api/v1/crm/overview", headers=headers).json()["due_tasks"] >= 1
    assert client.post("/api/v1/crm/activities", headers=headers, json={"customer_id": business_admin["customer_id"], "lead_id": lead_id, "subject": "invalid"}).status_code == 422
    assert client.get("/api/v1/crm/customers", headers=headers, params={"q": "Beta Customer"}).json()[0]["id"] == business_admin["customer_id"]
    assert client.post(f"/api/v1/crm/activities/{task.json()['id']}/complete", headers=headers).status_code == 200