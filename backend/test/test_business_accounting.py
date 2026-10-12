"""Double-entry ledger validation and trial balance tests."""
import uuid
from fastapi.testclient import TestClient
from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.ledger import LedgerAccount
from app.models.user import User


def test_journal_requires_balance_and_trial_balance_matches_postings():
    suffix = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(id=f"ledger-admin-{suffix}", email=f"ledger-{suffix}@example.test", hashed_password="test", role="admin", is_active=True)
    cash = LedgerAccount(code=f"CASH-{suffix}", name="Cash", account_type="asset")
    income = LedgerAccount(code=f"REV-{suffix}", name="Sales", account_type="revenue")
    db.add_all([admin, cash, income]); db.commit()
    data = {"token": create_access_token({"sub": admin.id}), "cash": cash.id, "income": income.id}
    db.close()
    client = TestClient(app); headers = {"Authorization": f"Bearer {data['token']}"}
    base = {"posting_date": "2026-10-01", "description": "Test opening sale", "reference": f"TEST-{suffix}"}
    unbalanced = client.post("/api/v1/erp/journals", headers=headers, json={**base, "lines": [
        {"account_id": data["cash"], "debit": "100.00"}, {"account_id": data["income"], "credit": "99.00"},
    ]})
    assert unbalanced.status_code == 422
    posted = client.post("/api/v1/erp/journals", headers=headers, json={**base, "lines": [
        {"account_id": data["cash"], "debit": "100.00"}, {"account_id": data["income"], "credit": "100.00"},
    ]})
    assert posted.status_code == 201, posted.text
    assert posted.json()["id"].startswith("JE-")
    report = client.get("/api/v1/erp/trial-balance", headers=headers, params={"as_of": "2026-10-01"})
    assert report.status_code == 200, report.text
    result = report.json()
    assert result["balanced"] is True and result["debit_total"] == result["credit_total"] == "100.00"
    future = client.get("/api/v1/erp/trial-balance", headers=headers, params={"as_of": "2026-09-30"}).json()
    assert future["balanced"] is True and future["debit_total"] == future["credit_total"] == "0.00"


def test_expense_register_posts_balanced_journal_atomically():
    suffix = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(id=f"expense-admin-{suffix}", email=f"expense-{suffix}@example.test", hashed_password="test", role="admin", is_active=True)
    expense_account = LedgerAccount(code=f"EXP-{suffix}", name="Office supplies", account_type="expense")
    cash_account = LedgerAccount(code=f"BANK-{suffix}", name="Operating bank", account_type="asset")
    tax_account = LedgerAccount(code=f"TAX-{suffix}", name="Recoverable input tax", account_type="asset")
    db.add_all([admin, expense_account, cash_account, tax_account]); db.commit()
    data = {"token": create_access_token({"sub": admin.id}), "expense": expense_account.id, "cash": cash_account.id, "tax": tax_account.id}
    db.close()
    client = TestClient(app); headers = {"Authorization": f"Bearer {data['token']}"}
    body = {"category": "Operations", "description": "Shipping supplies", "amount": "100.00", "tax_amount": "18.00",
            "expense_date": "2026-10-02", "expense_account_id": data["expense"], "credit_account_id": data["cash"],
            "input_tax_account_id": data["tax"]}
    response = client.post("/api/v1/erp/expenses", headers=headers, json=body)
    assert response.status_code == 201, response.text
    posted = client.get("/api/v1/erp/journals", headers=headers).json()[0]
    assert posted["id"] == response.json()["journal_entry_id"]
    assert sum(float(line["debit"]) for line in posted["lines"]) == 118
    assert sum(float(line["credit"]) for line in posted["lines"]) == 118
    assert len(posted["lines"]) == 3
    missing_tax = client.post("/api/v1/erp/expenses", headers=headers, json={**body, "description": "Must not persist", "input_tax_account_id": None})
    assert missing_tax.status_code == 422
    expenses = client.get("/api/v1/erp/expenses", headers=headers).json()
    assert len([item for item in expenses if item["description"] == "Shipping supplies"]) == 1
    assert not any(item["description"] == "Must not persist" for item in expenses)
