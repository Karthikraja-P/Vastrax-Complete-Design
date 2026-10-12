"""Integration tests for Vastrax CRM and purchasing/inventory workflows."""
import uuid
import hashlib

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.db.database import SessionLocal
from app.main import app
from app.models.address import Address
from app.models.business import CRMActivity, PurchaseOrder, PurchaseOrderLine, ERPPurchaseOrderRequest, ERPInventoryCostLayer
from app.models.category import Category
from app.models.product import Product
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product_variant import ProductVariant
from app.models.user import User
from app.models.support_ticket import SupportTicket
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
    member_token = create_access_token({"sub": business_admin["customer_id"]})
    member_headers = {"Authorization": f"Bearer {member_token}"}
    path = "/api/v1/users/admin/business-team"

    assert client.get(path).status_code == 401
    grant = client.put(path, headers=admin_headers, json={
        "email": f"customer-{business_admin['suffix']}@example.com",
        "permissions": ["crm"],
    })
    repeated_grant = client.put(path, headers=admin_headers, json={
        "email": f"customer-{business_admin['suffix']}@example.com",
        "permissions": ["crm"],
    })
    assert repeated_grant.status_code == 200, repeated_grant.text
    db = SessionLocal()
    team_user = db.get(User, business_admin["customer_id"])
    team_user.hashed_password = hash_password("TeamMember!123")
    db.commit()
    db.close()
    login = client.post("/api/v1/auth/login", json={
        "email": f"customer-{business_admin['suffix']}@example.com",
        "password": "TeamMember!123",
    })
    assert login.status_code == 200, login.text
    assert login.json()["user"]["business_permissions"] == ["crm"]
    assert grant.status_code == 200, grant.text
    assert grant.json()["permissions"] == ["crm"]
    assert client.get("/api/v1/auth/me", headers=member_headers).json()["business_permissions"] == ["crm"]
    assert client.get("/api/v1/crm/overview", headers=member_headers).status_code == 200
    assert client.get("/api/v1/erp/overview", headers=member_headers).status_code == 403

    update = client.put(path, headers=admin_headers, json={
        "email": f"customer-{business_admin['suffix']}@example.com",
        "permissions": ["erp"],
    })
    assert update.status_code == 200
    assert client.get("/api/v1/crm/overview", headers=member_headers).status_code == 403
    assert client.get("/api/v1/erp/overview", headers=member_headers).status_code == 200

    revoked = client.delete(f"{path}/{business_admin['customer_id']}", headers=admin_headers)
    assert revoked.status_code == 204
    assert client.get("/api/v1/erp/overview", headers=member_headers).status_code == 403


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
    line = client.get("/api/v1/erp/purchase-orders", headers=headers).json()["items"][0]["items"][0]
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


def test_crm_support_queue_updates_customer_ticket_and_audit(business_admin):
    db = SessionLocal()
    ticket = SupportTicket(
        id=f"ticket-{business_admin['suffix']}", user_id=business_admin["customer_id"],
        order_id="order-sample", subject="Need exchange", description="Requested a size exchange",
        status="OPEN", priority="HIGH",
    )
    db.add(ticket)
    db.commit()
    ticket_id = ticket.id
    db.close()

    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    assert client.get("/api/v1/crm/support-tickets").status_code == 401
    rows = client.get("/api/v1/crm/support-tickets", headers=headers, params={"status": "OPEN", "priority": "HIGH"})
    assert rows.status_code == 200
    assert any(row["id"] == ticket_id and row["customer_name"] == "Beta Customer" for row in rows.json()["items"])
    updated = client.patch(f"/api/v1/crm/support-tickets/{ticket_id}", headers=headers, json={
        "status": "IN_PROGRESS", "priority": "URGENT", "assigned_to": f"admin-{business_admin['suffix']}",
    })
    assert updated.status_code == 200, updated.text
    assert updated.json()["status"] == "IN_PROGRESS" and updated.json()["priority"] == "URGENT"
    detail = client.get(f"/api/v1/crm/customers/{business_admin['customer_id']}", headers=headers).json()
    assert detail["support_tickets"][0]["id"] == ticket_id
    assert detail["support_tickets"][0]["assigned_to_name"] == f"admin-{business_admin['suffix']}@example.test"
    assert any(activity["subject"] == f"Support ticket updated · {ticket_id}" for activity in detail["activities"])
    bad_assignee = client.patch(f"/api/v1/crm/support-tickets/{ticket_id}", headers=headers, json={"assigned_to": "missing-user"})
    assert bad_assignee.status_code == 422


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
    assert client.post("/api/v1/crm/activities", headers=headers, json={"lead_id": lead_id, "activity_type": "task", "subject": "Bad assignee", "assigned_to": "missing-user"}).status_code == 422
    roster = client.get("/api/v1/crm/team-members", headers=headers)
    assert roster.status_code == 200 and any(member["id"] == f"admin-{business_admin['suffix']}" for member in roster.json())
    grant = client.put("/api/v1/users/admin/business-team", headers=headers, json={
        "email": f"customer-{business_admin['suffix']}@example.com", "permissions": ["crm"],
    })
    assert grant.status_code == 200, grant.text
    roster = client.get("/api/v1/crm/team-members", headers=headers).json()
    assert any(member["id"] == business_admin["customer_id"] for member in roster)
    assigned = client.post("/api/v1/crm/activities", headers=headers, json={
        "customer_id": business_admin["customer_id"], "activity_type": "task", "subject": "Assigned sizing follow-up",
        "due_at": "2030-01-01T00:00:00Z", "assigned_to": business_admin["customer_id"],
    })
    assert assigned.status_code == 201, assigned.text
    assert assigned.json()["assigned_to"] == business_admin["customer_id"]
    open_tasks = client.get("/api/v1/crm/activities", headers=headers, params={"upcoming": True}).json()
    assert any(row["id"] == assigned.json()["id"] and row["assigned_to"] == business_admin["customer_id"] for row in open_tasks["items"])
    customer_detail = client.get(f"/api/v1/crm/customers/{business_admin['customer_id']}", headers=headers).json()
    assert any(row["assigned_to_name"] == "Beta Customer" for row in customer_detail["activities"])
    assert client.post("/api/v1/crm/activities", headers=headers, json={"customer_id": business_admin["customer_id"], "lead_id": lead_id, "subject": "invalid"}).status_code == 422
    customer_rows = client.get("/api/v1/crm/customers", headers=headers, params={"q": "Beta Customer"}).json()
    assert any(row["id"] == business_admin["customer_id"] for row in customer_rows["items"])
    assert customer_rows["total"] >= 1 and customer_rows["offset"] == 0
    assert client.get("/api/v1/crm/customers", headers=headers, params={"limit": 201}).status_code == 422
    assert client.post(f"/api/v1/crm/activities/{task.json()['id']}/complete", headers=headers).status_code == 200


def test_crm_list_endpoints_page_with_stable_metadata(business_admin):
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    baseline = client.get("/api/v1/crm/leads", headers=headers).json()["total"]
    for index in range(3):
        response = client.post("/api/v1/crm/leads", headers=headers, json={"full_name": f"Paged prospect {index}"})
        assert response.status_code == 201, response.text
    first = client.get("/api/v1/crm/leads", headers=headers, params={"limit": 2})
    second = client.get("/api/v1/crm/leads", headers=headers, params={"limit": 2, "offset": 2})
    assert first.status_code == second.status_code == 200
    first_page, second_page = first.json(), second.json()
    assert len(first_page["items"]) == 2
    assert first_page["has_more"] is True
    assert second_page["offset"] == 2
    assert not ({row["id"] for row in first_page["items"]} & {row["id"] for row in second_page["items"]})
    assert first_page["total"] == second_page["total"] == baseline + 3


def test_erp_purchase_orders_support_pages(business_admin):
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    baseline = client.get("/api/v1/erp/purchase-orders", headers=headers).json()["total"]
    supplier = client.post("/api/v1/erp/suppliers", headers=headers, json={"name": f"Paged supplier {business_admin['suffix']}"})
    assert supplier.status_code == 201, supplier.text
    for _ in range(2):
        response = client.post("/api/v1/erp/purchase-orders", headers=headers, json={
            "supplier_id": supplier.json()["id"],
            "items": [{"variant_id": business_admin["variant_id"], "quantity": 1, "unit_cost": "10.00"}],
        })
        assert response.status_code == 201, response.text
    first = client.get("/api/v1/erp/purchase-orders", headers=headers, params={"limit": 1, "offset": baseline})
    second = client.get("/api/v1/erp/purchase-orders", headers=headers, params={"limit": 1, "offset": baseline + 1})
    assert first.status_code == second.status_code == 200
    first_page, second_page = first.json(), second.json()
    assert first_page["total"] == second_page["total"] == baseline + 2
    assert len(first_page["items"]) == len(second_page["items"]) == 1
    assert first_page["items"][0]["id"] != second_page["items"][0]["id"]
    assert first_page["has_more"] is True and second_page["has_more"] is False


def test_inventory_costing_status_is_read_only_and_requires_erp_access(business_admin):
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    path = "/api/v1/erp/inventory-costing/status"
    assert client.get(path).status_code == 401
    response = client.get(path, headers=headers)
    assert response.status_code == 200, response.text
    status_payload = response.json()
    assert status_payload["configured"] is False
    assert status_payload["unvalued_variants"] == status_payload["positive_stock_variants"]
    assert status_payload["unvalued_units"] + status_payload["valued_units"] == status_payload["on_hand_units"]
    assert status_payload["unposted_cost_consumptions"] == 0
    variants_path = "/api/v1/erp/inventory-costing/variants"
    assert client.get(variants_path).status_code == 401
    variants = client.get(variants_path, headers=headers, params={"limit": 1})
    assert variants.status_code == 200, variants.text
    assert variants.json()["total"] >= 1
    assert variants.json()["has_more"] == (variants.json()["total"] > 1)
    fixture_variant = client.get(variants_path, headers=headers, params={"limit": 200}).json()["items"]
    row = next(item for item in fixture_variant if item["variant_id"] == business_admin["variant_id"])
    assert row["on_hand_units"] == 4 and row["unvalued_units"] == 4


def test_customer_marketing_consent_is_opt_in_and_audited(business_admin):
    client = TestClient(app)
    customer_headers = {"Authorization": f"Bearer {business_admin['customer_token']}"}
    admin_headers = {"Authorization": f"Bearer {business_admin['token']}"}
    path = "/api/v1/users/me/marketing-consent"

    assert client.get(path).status_code == 401
    assert client.get(path, headers=admin_headers).status_code == 403
    initial = client.get(path, headers=customer_headers)
    assert initial.status_code == 200
    assert initial.json()["email_marketing"] is False
    assert initial.json()["sms_marketing"] is False
    assert initial.json()["history"] == []

    opted_in = client.patch(path, headers=customer_headers, json={"email_marketing": True})
    assert opted_in.status_code == 200, opted_in.text
    assert opted_in.json()["email_marketing"] is True
    assert opted_in.json()["sms_marketing"] is False
    assert len(opted_in.json()["history"]) == 1
    assert opted_in.json()["history"][0]["source"] == "customer_account"

    unchanged = client.patch(path, headers=customer_headers, json={"email_marketing": True})
    assert len(unchanged.json()["history"]) == 1
    changed = client.patch(path, headers=customer_headers, json={"email_marketing": False, "sms_marketing": True})
    assert changed.status_code == 200
    assert changed.json()["email_marketing"] is False and changed.json()["sms_marketing"] is True
    assert len(changed.json()["history"]) == 3

    profile = client.get(f"/api/v1/crm/customers/{business_admin['customer_id']}", headers=admin_headers)
    assert profile.status_code == 200
    assert profile.json()["marketing_preferences"]["email_marketing"] is False
    assert profile.json()["marketing_preferences"]["sms_marketing"] is True
    assert len(profile.json()["marketing_preferences"]["history"]) == 3





def test_supplier_linked_expense_payable_can_be_partially_settled(business_admin):
    suffix = business_admin["suffix"]
    db = SessionLocal()
    expense_account = LedgerAccount(code=f"EXPENSE-{suffix}", name="Office services", account_type="expense")
    tax_account = LedgerAccount(code=f"TAX-{suffix}", name="Input tax asset", account_type="asset")
    bank_account = LedgerAccount(code=f"EXP-BANK-{suffix}", name="Expense settlement bank", account_type="asset")
    db.add_all([expense_account, tax_account, bank_account])
    db.commit()
    accounts = {"expense": expense_account.id, "tax": tax_account.id, "bank": bank_account.id}
    db.close()

    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    assert client.get("/api/v1/erp/payables/expenses").status_code == 401
    supplier = client.post("/api/v1/erp/suppliers", headers=headers, json={"name": f"Expense supplier {suffix}"})
    assert supplier.status_code == 201, supplier.text
    expense = client.post("/api/v1/erp/expenses", headers=headers, json={
        "category": "Operations",
        "description": f"Supplier maintenance {suffix}",
        "amount": "100.00",
        "tax_amount": "18.00",
        "supplier_id": supplier.json()["id"],
        "reference": f"SUP-INV-{suffix}",
        "expense_date": "2026-10-13",
        "expense_account_id": accounts["expense"],
        "credit_account_id": business_admin["payable_account_id"],
        "input_tax_account_id": accounts["tax"],
    })
    assert expense.status_code == 201, expense.text
    expense_id = expense.json()["expense"]["id"]
    payable = next(row for row in client.get("/api/v1/erp/payables/expenses", headers=headers).json()["items"]
                   if row["expense_id"] == expense_id)
    assert payable["received_total"] == "118.00" and payable["outstanding_total"] == "118.00"

    payment_body = {
        "amount": "50.00",
        "payment_date": "2026-10-13",
        "reference": f"SUP-BANK-{suffix}",
        "payable_account_id": business_admin["payable_account_id"],
        "payment_account_id": accounts["bank"],
    }
    payment = client.post(f"/api/v1/erp/payables/expenses/{expense_id}/payments", headers=headers, json=payment_body)
    assert payment.status_code == 201, payment.text
    assert payment.json()["outstanding_total"] == "68.00"
    assert client.post(f"/api/v1/erp/payables/expenses/{expense_id}/payments", headers=headers, json=payment_body).status_code == 409
    assert client.post(f"/api/v1/erp/payables/expenses/{expense_id}/payments", headers=headers, json={
        **payment_body, "amount": "69.00", "reference": f"SUP-OVER-{suffix}",
    }).status_code == 409

    payable = next(row for row in client.get("/api/v1/erp/payables/expenses", headers=headers).json()["items"]
                   if row["expense_id"] == expense_id)
    assert payable["paid_total"] == "50.00" and payable["outstanding_total"] == "68.00"
    journal = next(row for row in client.get("/api/v1/erp/journals", headers=headers).json()
                   if row["id"] == payment.json()["journal_entry_id"])
    assert sum(float(line["debit"]) for line in journal["lines"]) == 50
    assert sum(float(line["credit"]) for line in journal["lines"]) == 50


def test_supplier_payables_register_records_partial_payment_and_blocks_overpayment(business_admin):
    db = SessionLocal()
    cash = LedgerAccount(code=f"BANK-{business_admin['suffix']}", name="Operating bank", account_type="asset")
    db.add(cash)
    db.commit()
    cash_id = cash.id
    db.close()

    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    assert client.get("/api/v1/erp/payables").status_code == 401
    supplier = client.post("/api/v1/erp/suppliers", headers=headers, json={"name": f"Payables supplier {business_admin['suffix']}"})
    assert supplier.status_code == 201, supplier.text
    po = client.post("/api/v1/erp/purchase-orders", headers=headers, json={
        "supplier_id": supplier.json()["id"],
        "items": [{"variant_id": business_admin["variant_id"], "quantity": 5, "unit_cost": "220.00"}],
    })
    assert po.status_code == 201, po.text
    po_id = po.json()["id"]
    line = next(row for row in client.get("/api/v1/erp/purchase-orders", headers=headers).json()["items"] if row["id"] == po_id)["items"][0]
    receipt = client.post(f"/api/v1/erp/purchase-orders/{po_id}/receive", headers=headers, json={
        "items": [{"line_id": line["id"], "quantity": 3}],
        "inventory_account_id": business_admin["inventory_account_id"],
        "payable_account_id": business_admin["payable_account_id"],
    })
    assert receipt.status_code == 200, receipt.text

    payable = next(row for row in client.get("/api/v1/erp/payables", headers=headers).json()["items"] if row["purchase_order_id"] == po_id)
    assert payable["received_total"] == "660.00"
    assert payable["paid_total"] == "0.00" and payable["outstanding_total"] == "660.00"
    payment_body = {
        "amount": "400.00",
        "payment_date": "2026-10-13",
        "reference": f"BANK-REF-{business_admin['suffix']}",
        "payable_account_id": business_admin["payable_account_id"],
        "payment_account_id": cash_id,
    }
    payment = client.post(f"/api/v1/erp/payables/{po_id}/payments", headers=headers, json=payment_body)
    assert payment.status_code == 201, payment.text
    assert payment.json()["outstanding_total"] == "260.00"
    assert client.post(f"/api/v1/erp/payables/{po_id}/payments", headers=headers, json=payment_body).status_code == 409
    assert client.post(f"/api/v1/erp/payables/{po_id}/payments", headers=headers, json={**payment_body, "amount": "300.00", "reference": f"BANK-OVER-{business_admin['suffix']}"}).status_code == 409

    payable = next(row for row in client.get("/api/v1/erp/payables", headers=headers).json()["items"] if row["purchase_order_id"] == po_id)
    assert payable["paid_total"] == "400.00" and payable["outstanding_total"] == "260.00"
    assert len(payable["payments"]) == 1
    journal = next(row for row in client.get("/api/v1/erp/journals", headers=headers).json() if row["id"] == payment.json()["journal_entry_id"])
    assert [(line["account_id"], line["debit"], line["credit"]) for line in journal["lines"]] == [
        (business_admin["payable_account_id"], "400.00", "0.00"),
        (cash_id, "0.00", "400.00"),
    ]


def test_multi_line_purchase_order_receipt_updates_shared_inventory_and_ledger(business_admin):
    db = SessionLocal()
    first = db.get(ProductVariant, business_admin["variant_id"])
    second = ProductVariant(id=f"v2-{business_admin['suffix']}", product_id=first.product_id,
                            sku=f"sku2-{business_admin['suffix']}", size="M", stock_qty=2)
    db.add(second)
    db.commit()
    second_id = second.id
    db.close()

    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    supplier = client.post("/api/v1/erp/suppliers", headers=headers, json={"name": f"Multi-line supplier {business_admin['suffix']}"})
    assert supplier.status_code == 201, supplier.text
    created = client.post("/api/v1/erp/purchase-orders", headers=headers, json={
        "supplier_id": supplier.json()["id"],
        "items": [
            {"variant_id": business_admin["variant_id"], "quantity": 3, "unit_cost": "220.00"},
            {"variant_id": second_id, "quantity": 4, "unit_cost": "125.50"},
        ],
    })
    assert created.status_code == 201, created.text
    po_id = created.json()["id"]
    po = next(row for row in client.get("/api/v1/erp/purchase-orders", headers=headers).json()["items"] if row["id"] == po_id)
    assert len(po["items"]) == 2
    receipt_payload = {
        "items": [{"line_id": item["id"], "quantity": item["quantity_ordered"]} for item in po["items"]],
        "inventory_account_id": business_admin["inventory_account_id"],
        "payable_account_id": business_admin["payable_account_id"],
        "idempotency_key": f"receipt-{business_admin['suffix']}",
    }
    received = client.post(f"/api/v1/erp/purchase-orders/{po_id}/receive", headers=headers, json=receipt_payload)
    assert received.status_code == 200 and received.json()["status"] == "received"
    retried = client.post(f"/api/v1/erp/purchase-orders/{po_id}/receive", headers=headers, json=receipt_payload)
    assert retried.status_code == 200 and retried.json() == received.json()
    conflict_payload = {**receipt_payload, "payable_account_id": business_admin["inventory_account_id"]}
    assert client.post(f"/api/v1/erp/purchase-orders/{po_id}/receive", headers=headers, json=conflict_payload).status_code == 409

    db = SessionLocal()
    assert db.get(ProductVariant, business_admin["variant_id"]).stock_qty == 7
    assert db.get(ProductVariant, second_id).stock_qty == 6
    layers = db.query(ERPInventoryCostLayer).filter(
        ERPInventoryCostLayer.source_type == "purchase_receipt",
        ERPInventoryCostLayer.source_key.like(f"{receipt_payload['idempotency_key']}:%"),
    ).all()
    assert {(layer.variant_id, layer.original_quantity, str(layer.unit_cost)) for layer in layers} == {
        (business_admin["variant_id"], 3, "220.0000"),
        (second_id, 4, "125.5000"),
    }
    from app.models.ledger import JournalEntry
    assert db.query(JournalEntry).filter(JournalEntry.source_key == f"inventory-receipt:{receipt_payload['idempotency_key']}").count() == 1
    db.close()
    journal = next(row for row in client.get("/api/v1/erp/journals", headers=headers).json()
                   if row["id"] == received.json()["journal_entry_id"])
    assert sum(float(line["debit"]) for line in journal["lines"]) == 1162
    assert sum(float(line["credit"]) for line in journal["lines"]) == 1162


def test_crm_lead_conversion_links_existing_customer_and_logs_activity(business_admin):
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    customer_email = f"customer-{business_admin['suffix']}@example.com"
    created = client.post("/api/v1/crm/leads", headers=headers, json={
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


def test_bank_statement_import_match_unmatch_audit_and_duplicate_guard(business_admin):
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    suffix = business_admin["suffix"]
    revenue = client.post("/api/v1/erp/accounts", headers=headers, json={
        "code": f"BANK-REV-{suffix}", "name": "Bank reconciliation offset", "account_type": "revenue",
    })
    assert revenue.status_code == 201, revenue.text
    journal = client.post("/api/v1/erp/journals", headers=headers, json={
        "posting_date": "2026-10-01", "description": "Bank deposit", "reference": "UTR-123",
        "lines": [
            {"account_id": business_admin["inventory_account_id"], "debit": "125.50", "credit": "0"},
            {"account_id": revenue.json()["id"], "debit": "0", "credit": "125.50"},
        ],
    })
    assert journal.status_code == 201, journal.text
    fingerprint = hashlib.sha256(f"statement-row-{suffix}".encode()).hexdigest()
    payload = {"account_id": business_admin["inventory_account_id"], "lines": [{
        "statement_date": "2026-10-01", "description": "Settlement deposit", "reference": "UTR-123",
        "amount": "125.50", "source_fingerprint": fingerprint,
    }]}
    imported = client.post("/api/v1/erp/bank-reconciliation/import", headers=headers, json=payload)
    assert imported.status_code == 201 and imported.json() == {"imported": 1, "skipped_duplicates": 0}
    same_batch = {**payload, "lines": [payload["lines"][0], payload["lines"][0]]}
    within_batch = client.post("/api/v1/erp/bank-reconciliation/import", headers=headers, json=same_batch)
    assert within_batch.status_code == 201 and within_batch.json() == {"imported": 0, "skipped_duplicates": 2}
    duplicate = client.post("/api/v1/erp/bank-reconciliation/import", headers=headers, json=payload)
    assert duplicate.status_code == 201 and duplicate.json() == {"imported": 0, "skipped_duplicates": 1}
    rows = client.get("/api/v1/erp/bank-reconciliation", headers=headers, params={"unmatched_only": True}).json()
    assert len(rows) == 1
    line_id = rows[0]["id"]
    candidates = client.get(f"/api/v1/erp/bank-reconciliation/{line_id}/candidates", headers=headers)
    assert candidates.status_code == 200
    assert candidates.json()[0]["journal_entry_id"] == journal.json()["id"]
    assert candidates.json()[0]["reference_match"] is True
    wrong = client.post(f"/api/v1/erp/bank-reconciliation/{line_id}/match", headers=headers, json={"journal_entry_id": "missing"})
    assert wrong.status_code == 404
    matched = client.post(f"/api/v1/erp/bank-reconciliation/{line_id}/match", headers=headers, json={"journal_entry_id": journal.json()["id"]})
    assert matched.status_code == 200 and matched.json()["status"] == "matched"
    duplicate_line_payload = {**payload, "lines": [{**payload["lines"][0], "source_fingerprint": hashlib.sha256(f"second-row-{suffix}".encode()).hexdigest()}]}
    second = client.post("/api/v1/erp/bank-reconciliation/import", headers=headers, json=duplicate_line_payload)
    second_id = client.get("/api/v1/erp/bank-reconciliation", headers=headers, params={"unmatched_only": True}).json()[0]["id"]
    duplicate_match = client.post(f"/api/v1/erp/bank-reconciliation/{second_id}/match", headers=headers, json={"journal_entry_id": journal.json()["id"]})
    assert duplicate_match.status_code == 409
    unmatched = client.post(f"/api/v1/erp/bank-reconciliation/{line_id}/unmatch", headers=headers)
    assert unmatched.status_code == 200 and unmatched.json()["status"] == "unmatched"
    history = client.get(f"/api/v1/erp/bank-reconciliation/{line_id}/history", headers=headers)
    assert history.status_code == 200
    assert [event["action"] for event in history.json()] == ["unmatched", "matched"]
    assert client.get("/api/v1/erp/bank-reconciliation").status_code == 401


def test_purchase_order_creation_is_idempotent_and_rejects_key_reuse(business_admin):
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {business_admin['token']}"}
    supplier = client.post("/api/v1/erp/suppliers", headers=headers, json={"name": f"Retry-safe supplier {business_admin['suffix']}"})
    assert supplier.status_code == 201, supplier.text
    payload = {
        "supplier_id": supplier.json()["id"],
        "notes": "test duplicate submit handling",
        "items": [{"variant_id": business_admin["variant_id"], "quantity": 3, "unit_cost": "220.00"}],
        "idempotency_key": f"po-request-{business_admin['suffix']}",
    }
    path = "/api/v1/erp/purchase-orders"
    assert client.post(path, json=payload).status_code == 401
    created = client.post(path, headers=headers, json=payload)
    assert created.status_code == 201, created.text
    retried = client.post(path, headers=headers, json=payload)
    assert retried.status_code == 201 and retried.json() == created.json()
    changed = {**payload, "items": [{"variant_id": business_admin["variant_id"], "quantity": 4, "unit_cost": "220.00"}]}
    assert client.post(path, headers=headers, json=changed).status_code == 409

    db = SessionLocal()
    assert db.query(PurchaseOrder).filter(PurchaseOrder.id == created.json()["id"]).count() == 1
    assert db.query(PurchaseOrderLine).filter(PurchaseOrderLine.purchase_order_id == created.json()["id"]).count() == 1
    assert db.query(ERPPurchaseOrderRequest).filter(ERPPurchaseOrderRequest.idempotency_key == payload["idempotency_key"]).count() == 1
    db.close()
