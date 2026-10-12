"""Admin general-ledger and trial-balance endpoints."""
from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import require_business_permission
from app.models.ledger import JournalEntry, JournalLine, LedgerAccount
from app.models.user import User

router = APIRouter(tags=["erp-accounting"], dependencies=[Depends(require_business_permission("erp"))])


class AccountCreate(BaseModel):
    code: str = Field(min_length=1, max_length=30, pattern=r"^[A-Za-z0-9._-]+$")
    name: str = Field(min_length=1, max_length=160)
    account_type: Literal["asset", "liability", "equity", "revenue", "expense"]


class JournalLineInput(BaseModel):
    account_id: str
    debit: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    credit: Decimal = Field(default=Decimal("0"), ge=0, max_digits=14, decimal_places=2)
    memo: str | None = Field(default=None, max_length=1000)


class JournalCreate(BaseModel):
    posting_date: date
    description: str = Field(min_length=1, max_length=255)
    reference: str | None = Field(default=None, max_length=100)
    lines: list[JournalLineInput] = Field(min_length=2, max_length=100)


def _entry_payload(db: Session, entry: JournalEntry) -> dict:
    rows = db.query(JournalLine, LedgerAccount.code, LedgerAccount.name).join(LedgerAccount, LedgerAccount.id == JournalLine.account_id).filter(JournalLine.journal_entry_id == entry.id).all()
    return {"id": entry.id, "posting_date": entry.posting_date, "description": entry.description, "reference": entry.reference,
            "created_at": entry.created_at,
            "lines": [{"account_id": line.account_id, "account_code": code, "account_name": name,
                       "debit": str(line.debit), "credit": str(line.credit), "memo": line.memo} for line, code, name in rows]}


@router.get("/erp/accounts")
def list_accounts(db: Session = Depends(get_db)):
    return db.query(LedgerAccount).order_by(LedgerAccount.code).all()


@router.post("/erp/accounts", status_code=status.HTTP_201_CREATED)
def create_account(body: AccountCreate, db: Session = Depends(get_db)):
    code = body.code.strip().upper()
    if db.query(LedgerAccount.id).filter(func.upper(LedgerAccount.code) == code).first():
        raise HTTPException(409, "Account code already exists")
    account = LedgerAccount(code=code, name=body.name.strip(), account_type=body.account_type)
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("/erp/journals")
def list_journals(limit: int = Query(default=100, ge=1, le=500), db: Session = Depends(get_db)):
    entries = db.query(JournalEntry).order_by(JournalEntry.posting_date.desc(), JournalEntry.created_at.desc()).limit(limit).all()
    return [_entry_payload(db, entry) for entry in entries]


@router.post("/erp/journals", status_code=status.HTTP_201_CREATED)
def post_journal(body: JournalCreate, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    debit_total = sum((line.debit for line in body.lines), Decimal("0"))
    credit_total = sum((line.credit for line in body.lines), Decimal("0"))
    if debit_total <= 0 or debit_total != credit_total:
        raise HTTPException(422, "Journal must have equal positive debit and credit totals")
    if any((line.debit > 0) == (line.credit > 0) for line in body.lines):
        raise HTTPException(422, "Each journal line must have exactly one positive side")
    account_ids = {line.account_id for line in body.lines}
    accounts = db.query(LedgerAccount).filter(LedgerAccount.id.in_(account_ids), LedgerAccount.is_active.is_(True)).all()
    if len(accounts) != len(account_ids):
        raise HTTPException(422, "Every journal line must reference an active account")
    entry = JournalEntry(posting_date=body.posting_date, description=body.description.strip(), reference=body.reference, created_by=admin.id)
    db.add(entry)
    db.flush()
    db.add_all([JournalLine(journal_entry_id=entry.id, account_id=line.account_id, debit=line.debit, credit=line.credit, memo=line.memo) for line in body.lines])
    db.commit()
    db.refresh(entry)
    return _entry_payload(db, entry)


@router.get("/erp/trial-balance")
def trial_balance(as_of: date = Query(default_factory=date.today), db: Session = Depends(get_db)):
    rows = db.query(
        LedgerAccount,
        func.coalesce(func.sum(case((JournalEntry.posting_date <= as_of, JournalLine.debit), else_=0)), 0).label("debit_total"),
        func.coalesce(func.sum(case((JournalEntry.posting_date <= as_of, JournalLine.credit), else_=0)), 0).label("credit_total"),
    ).outerjoin(JournalLine, JournalLine.account_id == LedgerAccount.id)\
        .outerjoin(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id)\
        .group_by(LedgerAccount.id).order_by(LedgerAccount.code).all()
    debit_sum = Decimal("0")
    credit_sum = Decimal("0")
    accounts = []
    for account, debit, credit in rows:
        debit_value = Decimal(str(debit or 0)).quantize(Decimal("0.01"))
        credit_value = Decimal(str(credit or 0)).quantize(Decimal("0.01"))
        debit_sum += debit_value
        credit_sum += credit_value
        accounts.append({"account_id": account.id, "code": account.code, "name": account.name,
                         "account_type": account.account_type, "debit": str(debit_value), "credit": str(credit_value),
                         "balance": str(debit_value - credit_value)})
    return {"as_of": as_of, "accounts": accounts, "debit_total": str(debit_sum), "credit_total": str(credit_sum),
            "balanced": debit_sum == credit_sum}


@router.get("/erp/profit-and-loss")
def profit_and_loss(
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
):
    if end_date < start_date:
        raise HTTPException(422, "End date must be on or after start date")
    accounts = db.query(LedgerAccount).filter(
        LedgerAccount.account_type.in_(("revenue", "expense"))
    ).order_by(LedgerAccount.account_type, LedgerAccount.code).all()
    totals: dict[str, tuple[Decimal, Decimal]] = {}
    lines = db.query(JournalLine, LedgerAccount.account_type).join(
        LedgerAccount, LedgerAccount.id == JournalLine.account_id
    ).join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id).filter(
        LedgerAccount.account_type.in_(("revenue", "expense")),
        JournalEntry.posting_date >= start_date,
        JournalEntry.posting_date <= end_date,
    ).all()
    for line, _account_type in lines:
        debit, credit = totals.get(line.account_id, (Decimal("0.00"), Decimal("0.00")))
        totals[line.account_id] = (debit + Decimal(line.debit), credit + Decimal(line.credit))

    revenue_rows = []
    expense_rows = []
    revenue_total = Decimal("0.00")
    expense_total = Decimal("0.00")
    for account in accounts:
        debit, credit = totals.get(account.id, (Decimal("0.00"), Decimal("0.00")))
        amount = (credit - debit) if account.account_type == "revenue" else (debit - credit)
        amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        row = {"account_id": account.id, "code": account.code, "name": account.name, "amount": str(amount)}
        if account.account_type == "revenue":
            revenue_rows.append(row)
            revenue_total += amount
        else:
            expense_rows.append(row)
            expense_total += amount
    return {
        "start_date": start_date,
        "end_date": end_date,
        "revenue": revenue_rows,
        "expenses": expense_rows,
        "revenue_total": str(revenue_total.quantize(Decimal("0.01"))),
        "expense_total": str(expense_total.quantize(Decimal("0.01"))),
        "net_income": str((revenue_total - expense_total).quantize(Decimal("0.01"))),
    }


@router.get("/erp/balance-sheet")
def balance_sheet(as_of: date = Query(default_factory=date.today), db: Session = Depends(get_db)):
    accounts = db.query(LedgerAccount).order_by(LedgerAccount.account_type, LedgerAccount.code).all()
    totals: dict[str, tuple[Decimal, Decimal]] = {}
    lines = db.query(JournalLine, LedgerAccount.account_type).join(
        LedgerAccount, LedgerAccount.id == JournalLine.account_id
    ).join(JournalEntry, JournalEntry.id == JournalLine.journal_entry_id).filter(
        JournalEntry.posting_date <= as_of
    ).all()
    for line, _account_type in lines:
        debit, credit = totals.get(line.account_id, (Decimal("0.00"), Decimal("0.00")))
        totals[line.account_id] = (debit + Decimal(line.debit), credit + Decimal(line.credit))

    rows: dict[str, list[dict]] = {"asset": [], "liability": [], "equity": []}
    summed = {"asset": Decimal("0.00"), "liability": Decimal("0.00"), "equity": Decimal("0.00")}
    for account in accounts:
        if account.account_type not in rows:
            continue
        debit, credit = totals.get(account.id, (Decimal("0.00"), Decimal("0.00")))
        amount = (debit - credit) if account.account_type == "asset" else (credit - debit)
        amount = amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        rows[account.account_type].append({"account_id": account.id, "code": account.code,
                                           "name": account.name, "amount": str(amount)})
        summed[account.account_type] += amount

    # Revenue and expense balances not yet closed to retained earnings are shown
    # separately so the balance sheet still reflects all posted journal history.
    revenue = Decimal("0.00")
    expenses = Decimal("0.00")
    for account in accounts:
        if account.account_type not in ("revenue", "expense"):
            continue
        debit, credit = totals.get(account.id, (Decimal("0.00"), Decimal("0.00")))
        revenue += credit - debit if account.account_type == "revenue" else Decimal("0.00")
        expenses += debit - credit if account.account_type == "expense" else Decimal("0.00")
    unclosed_earnings = (revenue - expenses).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    rows["equity"].append({"account_id": None, "code": "CURRENT-EARNINGS", "name": "Unclosed earnings", "amount": str(unclosed_earnings)})
    summed["equity"] += unclosed_earnings
    liabilities_and_equity = summed["liability"] + summed["equity"]
    return {
        "as_of": as_of,
        "assets": rows["asset"],
        "liabilities": rows["liability"],
        "equity": rows["equity"],
        "assets_total": str(summed["asset"].quantize(Decimal("0.01"))),
        "liabilities_total": str(summed["liability"].quantize(Decimal("0.01"))),
        "equity_total": str(summed["equity"].quantize(Decimal("0.01"))),
        "liabilities_and_equity_total": str(liabilities_and_equity.quantize(Decimal("0.01"))),
        "balanced": summed["asset"].quantize(Decimal("0.01")) == liabilities_and_equity.quantize(Decimal("0.01")),
    }
