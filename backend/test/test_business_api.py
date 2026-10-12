"""Integration tests for Vastrax CRM and purchasing/inventory workflows."""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.category import Category
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.user import User


@pytest.fixture()
def business_admin():
    suffix = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(id=f"admin-{suffix}", email=f"admin-{suffix}@example.test", hashed_password="test", role="admin", is_active=True)
    customer = User(id=f"customer-{suffix}", email=f"customer-{suffix}@example.test", full_name="Beta Customer", hashed_password="test", role="customer", is_active=True)
    category = Category(id=f"cat-{suffix}", name=f"Business {suffix}", slug=f"business-{suffix}")
    product = Product(id=f"p-{suffix}", category_id=category.id, name="Test Dress", price_mrp=100, price_selling=90)
    variant = ProductVariant(id=f"v-{suffix}", product_id=product.id, sku=f"sku-{suffix}", size="S", stock_qty=4)
    db.add_all([admin, customer, category, product, variant])
    db.commit()
    customer_id, variant_id = customer.id, variant.id
    token = create_access_token({"sub": admin.id})
    db.close()
    yield {"token": token, "customer_id": customer_id, "variant_id": variant_id, "suffix": suffix}


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
    received = client.post(f"/api/v1/erp/purchase-orders/{po_id}/receive", headers=headers, json={"items": [{"line_id": line["id"], "quantity": 3}]})
    assert received.status_code == 200 and received.json()["status"] == "partially_received"
    db = SessionLocal()
    assert db.get(ProductVariant, business_admin["variant_id"]).stock_qty == 7
    db.close()
    over = client.post(f"/api/v1/erp/purchase-orders/{po_id}/receive", headers=headers, json={"items": [{"line_id": line["id"], "quantity": 3}]})
    assert over.status_code == 409
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