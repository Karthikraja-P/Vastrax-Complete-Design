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
    journals = client.get("/api/v1/erp/journals", headers=headers).json()
    posted = next(entry for entry in journals if entry["id"] == response.json()["journal_entry_id"])
    assert sum(float(line["debit"]) for line in posted["lines"]) == 118
    assert sum(float(line["credit"]) for line in posted["lines"]) == 118
    assert len(posted["lines"]) == 3
    missing_tax = client.post("/api/v1/erp/expenses", headers=headers, json={**body, "description": "Must not persist", "input_tax_account_id": None})
    assert missing_tax.status_code == 422
    expenses = client.get("/api/v1/erp/expenses", headers=headers).json()
    assert len([item for item in expenses if item["description"] == "Shipping supplies"]) == 1
    assert not any(item["description"] == "Must not persist" for item in expenses)



def test_profit_and_loss_and_balance_sheet_use_posted_journals():
    suffix = uuid.uuid4().hex[:10]
    db = SessionLocal()
    admin = User(id=f"reports-admin-{suffix}", email=f"reports-{suffix}@example.test", hashed_password="test", role="admin", is_active=True)
    cash = LedgerAccount(code=f"RPT-CASH-{suffix}", name="Report cash", account_type="asset")
    sales = LedgerAccount(code=f"RPT-REV-{suffix}", name="Report sales", account_type="revenue")
    expenses = LedgerAccount(code=f"RPT-EXP-{suffix}", name="Report expenses", account_type="expense")
    db.add_all([admin, cash, sales, expenses]); db.commit()
    token = create_access_token({"sub": admin.id})
    account_ids = {"cash": cash.id, "sales": sales.id, "expenses": expenses.id}
    db.close()
    client = TestClient(app)
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/erp/profit-and-loss", params={"start_date": "2026-10-01", "end_date": "2026-10-02"}).status_code == 401
    entries = [
        ("2026-09-30", "Prior period sale", account_ids["cash"], account_ids["sales"], "50.00"),
        ("2026-10-01", "Current period sale", account_ids["cash"], account_ids["sales"], "100.00"),
        ("2026-10-02", "Current period expense", account_ids["expenses"], account_ids["cash"], "25.00"),
    ]
    for day, description, debit_account, credit_account, amount in entries:
        response = client.post("/api/v1/erp/journals", headers=headers, json={
            "posting_date": day, "description": description,
            "lines": [{"account_id": debit_account, "debit": amount}, {"account_id": credit_account, "credit": amount}],
        })
        assert response.status_code == 201, response.text

    report = client.get("/api/v1/erp/profit-and-loss", headers=headers, params={"start_date": "2026-10-01", "end_date": "2026-10-02"})
    assert report.status_code == 200, report.text
    assert next(row for row in report.json()["revenue"] if row["code"] == f"RPT-REV-{suffix}")["amount"] == "100.00"
    assert next(row for row in report.json()["expenses"] if row["code"] == f"RPT-EXP-{suffix}")["amount"] == "25.00"
    invalid = client.get("/api/v1/erp/profit-and-loss", headers=headers, params={"start_date": "2026-10-03", "end_date": "2026-10-02"})
    assert invalid.status_code == 422

    balance = client.get("/api/v1/erp/balance-sheet", headers=headers, params={"as_of": "2026-10-02"})
    assert balance.status_code == 200, balance.text
    assert next(row for row in balance.json()["assets"] if row["code"] == f"RPT-CASH-{suffix}")["amount"] == "125.00"
    assert balance.json()["balanced"] is True
