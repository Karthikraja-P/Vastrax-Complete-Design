"""Admin general-ledger and trial-balance endpoints."""
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import case, func
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.db.database import get_db
from app.middleware.auth import require_business_permission
from app.models.ledger import JournalEntry, JournalLine, LedgerAccount, BankStatementLine, BankStatementMatchEvent
from app.models.erp_posting_config import ERPPostingConfig
from app.models.payment import Payment
from app.models.payment_refund import PaymentRefund
from app.services.erp_posting_service import reconcile_postings
from app.models.user import User

router = APIRouter(tags=["erp-accounting"], dependencies=[Depends(require_business_permission("erp"))])


class AccountCreate(BaseModel):
    code: str = Field(min_length=1, max_length=30, pattern=r"^[A-Za-z0-9._-]+$")
    name: str = Field(min_length=1, max_length=160)
    account_type: Literal["asset", "liability", "equity", "revenue", "expense"]


STARTER_CHART = [
    ("1000", "Cash on hand", "asset"),
    ("1010", "Operating bank account", "asset"),
    ("1020", "Payment gateway clearing", "asset"),
    ("1100", "Trade receivables", "asset"),
    ("1200", "Inventory", "asset"),
    ("1300", "Recoverable input tax", "asset"),
    ("2000", "Accounts payable", "liability"),
    ("2100", "Supplier trade payables", "liability"),
    ("2200", "Customer advances", "liability"),
    ("2300", "Output tax payable", "liability"),
    ("3000", "Owner capital", "equity"),
    ("4000", "Sales revenue", "revenue"),
    ("4100", "Other operating income", "revenue"),
    ("5000", "Cost of goods sold", "expense"),
    ("5100", "Sales returns and refunds", "expense"),
    ("5200", "Shipping and fulfillment", "expense"),
    ("5300", "Payment processing fees", "expense"),
    ("5400", "Marketing expense", "expense"),
    ("5500", "Salaries and contract labor", "expense"),
    ("5600", "Rent and utilities", "expense"),
    ("5700", "Packaging and supplies", "expense"),
    ("5800", "Other operating expenses", "expense"),
]


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




class BankStatementImportLine(BaseModel):
    statement_date: date
    description: str = Field(min_length=1, max_length=255)
    reference: str | None = Field(default=None, max_length=100)
    amount: Decimal = Field(max_digits=14, decimal_places=2)
    source_fingerprint: str = Field(min_length=64, max_length=64, pattern=r"^[a-fA-F0-9]{64}$")


class BankStatementImport(BaseModel):
    account_id: str
    lines: list[BankStatementImportLine] = Field(min_length=1, max_length=2000)


class BankStatementMatchIn(BaseModel):
    journal_entry_id: str


class PostingSettingsIn(BaseModel):
    payment_clearing_account_id: str
    customer_advances_account_id: str
    sales_revenue_account_id: str
    sales_returns_account_id: str


def _entry_exists(db: Session, source_key: str) -> bool:
    return db.query(JournalEntry.id).filter(JournalEntry.source_key == source_key).first() is not None


def _processed_refunds_total(db: Session, payment_id: str) -> Decimal:
    rows = db.query(PaymentRefund.amount).filter(
        PaymentRefund.payment_id == payment_id, PaymentRefund.status == "processed"
    ).all()
    return sum((Decimal(row[0]) for row in rows), Decimal("0.00"))


def posting_status(db: Session) -> dict:
    configured = db.get(ERPPostingConfig, "default") is not None
    captured = db.query(Payment).filter(Payment.status.in_(("success", "partially_refunded", "refunded"))).all()
    unposted_receipts = sum(1 for payment in captured if not _entry_exists(db, f"payment-receipt:{payment.id}"))
    delivered = [payment for payment in captured if payment.order and payment.order.status == "delivered"]
    unposted_sales = sum(1 for payment in delivered if not _entry_exists(db, f"order-revenue:{payment.id}")
                         and Decimal(payment.amount) > _processed_refunds_total(db, payment.id))
    processed_refunds = db.query(PaymentRefund).filter(PaymentRefund.status == "processed").all()
    unposted_refunds = sum(1 for refund in processed_refunds if not _entry_exists(db, f"payment-refund:{refund.id}"))
    return {"configured": configured, "unposted_receipts": unposted_receipts,
            "unposted_sales": unposted_sales, "unposted_refunds": unposted_refunds}


@router.get("/erp/posting-settings")
def get_posting_settings(db: Session = Depends(get_db)):
    config = db.get(ERPPostingConfig, "default")
    settings_payload = None
    if config:
        settings_payload = {
            "payment_clearing_account_id": config.payment_clearing_account_id,
            "customer_advances_account_id": config.customer_advances_account_id,
            "sales_revenue_account_id": config.sales_revenue_account_id,
            "sales_returns_account_id": config.sales_returns_account_id,
            "updated_at": config.updated_at,
        }
    accounts = db.query(LedgerAccount).filter(LedgerAccount.is_active.is_(True)).order_by(LedgerAccount.code).all()
    return {"settings": settings_payload,
            "accounts": [{"id": a.id, "code": a.code, "name": a.name, "account_type": a.account_type} for a in accounts],
            "status": posting_status(db)}


@router.put("/erp/posting-settings")
def save_posting_settings(body: PostingSettingsIn, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    expected = {
        body.payment_clearing_account_id: "asset",
        body.customer_advances_account_id: "liability",
        body.sales_revenue_account_id: "revenue",
        body.sales_returns_account_id: "expense",
    }
    if len(expected) != 4:
        raise HTTPException(422, "Choose a different ledger account for each posting role")
    accounts = db.query(LedgerAccount).filter(
        LedgerAccount.id.in_(expected), LedgerAccount.is_active.is_(True)
    ).all()
    by_id = {account.id: account for account in accounts}
    if len(by_id) != 4 or any(by_id[key].account_type != value for key, value in expected.items()):
        raise HTTPException(422, "Select active accounts with the required asset, liability, revenue, and expense types")
    config = db.get(ERPPostingConfig, "default")
    values = body.model_dump()
    if config:
        for key, value in values.items():
            setattr(config, key, value)
        config.updated_by = admin.id
    else:
        db.add(ERPPostingConfig(id="default", **values, updated_by=admin.id))
    db.commit()
    return get_posting_settings(db)


@router.get("/erp/postings/status")
def get_posting_status(db: Session = Depends(get_db)):
    return posting_status(db)


@router.post("/erp/postings/reconcile")
def reconcile_erp_postings(_: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    if not db.get(ERPPostingConfig, "default"):
        raise HTTPException(409, "Configure automatic posting accounts before reconciling")
    counts = reconcile_postings(db)
    db.commit()
    return {"posted": counts, "status": posting_status(db)}

@router.get("/erp/accounts")
def list_accounts(db: Session = Depends(get_db)):
    return db.query(LedgerAccount).order_by(LedgerAccount.code).all()


@router.post("/erp/accounts/starter-chart", status_code=status.HTTP_201_CREATED)
def create_starter_chart(admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    existing = {row.code.upper(): row for row in db.query(LedgerAccount).all()}
    conflicts = [
        code for code, name, account_type in STARTER_CHART
        if code in existing and (existing[code].name != name or existing[code].account_type != account_type)
    ]
    if conflicts:
        raise HTTPException(409, f"Starter chart codes already exist with different details: {', '.join(conflicts)}")
    missing = [(code, name, account_type) for code, name, account_type in STARTER_CHART if code not in existing]
    db.add_all([LedgerAccount(code=code, name=name, account_type=account_type) for code, name, account_type in missing])
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "The chart of accounts changed during setup. Refresh and retry.")
    accounts = db.query(LedgerAccount).filter(LedgerAccount.code.in_([item[0] for item in STARTER_CHART])).order_by(LedgerAccount.code).all()
    return {"created_count": len(missing), "review_required": True,
            "posting_configured": db.get(ERPPostingConfig, "default") is not None,
            "accounts": [{"id": account.id, "code": account.code, "name": account.name,
                          "account_type": account.account_type, "is_active": account.is_active} for account in accounts]}


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


@router.get("/erp/bank-reconciliation")
def list_bank_statement_lines(
    account_id: str | None = None,
    unmatched_only: bool = False,
    db: Session = Depends(get_db),
):
    query = db.query(BankStatementLine, LedgerAccount.code, LedgerAccount.name).join(
        LedgerAccount, LedgerAccount.id == BankStatementLine.account_id
    )
    if account_id:
        query = query.filter(BankStatementLine.account_id == account_id)
    if unmatched_only:
        query = query.filter(BankStatementLine.matched_journal_entry_id.is_(None))
    rows = query.order_by(BankStatementLine.statement_date.desc(), BankStatementLine.created_at.desc()).limit(1000).all()
    output = []
    for line, code, name in rows:
        journal = db.get(JournalEntry, line.matched_journal_entry_id) if line.matched_journal_entry_id else None
        output.append({
            "id": line.id, "account_id": line.account_id, "account_code": code, "account_name": name,
            "statement_date": line.statement_date, "description": line.description, "reference": line.reference,
            "amount": str(line.amount), "matched_journal_entry_id": line.matched_journal_entry_id,
            "matched_journal_description": journal.description if journal else None,
            "created_at": line.created_at,
        })
    return output


@router.post("/erp/bank-reconciliation/import", status_code=status.HTTP_201_CREATED)
def import_bank_statement(
    body: BankStatementImport,
    admin: User = Depends(require_business_permission("erp")),
    db: Session = Depends(get_db),
):
    account = db.get(LedgerAccount, body.account_id)
    if not account or not account.is_active or account.account_type != "asset":
        raise HTTPException(422, "Choose an active cash or bank asset account")
    created = []
    skipped = 0
    seen_fingerprints: set[str] = set()
    for row in body.lines:
        amount = row.amount.quantize(Decimal("0.01"))
        if amount == 0:
            raise HTTPException(422, "Statement lines must have a non-zero amount")
        fingerprint = row.source_fingerprint.lower()
        if fingerprint in seen_fingerprints or db.query(BankStatementLine.id).filter(BankStatementLine.source_fingerprint == fingerprint).first():
            skipped += 1
            continue
        seen_fingerprints.add(fingerprint)
        description = row.description.strip()
        if not description:
            raise HTTPException(422, "Statement line descriptions cannot be blank")
        line = BankStatementLine(
            account_id=account.id,
            statement_date=row.statement_date,
            description=description,
            reference=row.reference.strip() if row.reference and row.reference.strip() else None,
            amount=amount,
            source_fingerprint=fingerprint,
            created_by=admin.id,
        )
        db.add(line)
        created.append(line)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "A duplicate statement line was imported concurrently; reload before retrying")
    return {"imported": len(created), "skipped_duplicates": skipped}


@router.get("/erp/bank-reconciliation/{line_id}/candidates")
def bank_reconciliation_candidates(line_id: str, db: Session = Depends(get_db)):
    statement_line = db.get(BankStatementLine, line_id)
    if not statement_line:
        raise HTTPException(404, "Statement line not found")
    if statement_line.matched_journal_entry_id:
        return []
    net_amount = func.sum(JournalLine.debit - JournalLine.credit)
    rows = db.query(
        JournalEntry.id, JournalEntry.posting_date, JournalEntry.description, JournalEntry.reference,
        net_amount.label("net_amount"),
    ).join(JournalLine, JournalLine.journal_entry_id == JournalEntry.id).filter(
        JournalLine.account_id == statement_line.account_id,
        JournalEntry.posting_date.between(statement_line.statement_date - timedelta(days=7), statement_line.statement_date + timedelta(days=7)),
    ).group_by(JournalEntry.id).having(net_amount == statement_line.amount).order_by(
        JournalEntry.posting_date.desc(), JournalEntry.created_at.desc()
    ).limit(50).all()
    return [{
        "journal_entry_id": row.id, "posting_date": row.posting_date, "description": row.description,
        "reference": row.reference, "amount": str(Decimal(row.net_amount).quantize(Decimal("0.01"))),
        "reference_match": bool(statement_line.reference and row.reference and statement_line.reference.casefold() == row.reference.casefold()),
    } for row in rows]


@router.post("/erp/bank-reconciliation/{line_id}/match")
def match_bank_statement_line(
    line_id: str,
    body: BankStatementMatchIn,
    admin: User = Depends(require_business_permission("erp")),
    db: Session = Depends(get_db),
):
    line = db.query(BankStatementLine).filter(BankStatementLine.id == line_id).with_for_update().first()
    if not line:
        raise HTTPException(404, "Statement line not found")
    if line.matched_journal_entry_id:
        if line.matched_journal_entry_id == body.journal_entry_id:
            return {"id": line.id, "status": "matched", "journal_entry_id": body.journal_entry_id}
        raise HTTPException(409, "This statement line is already matched; unmatch it before choosing another entry")
    entry = db.get(JournalEntry, body.journal_entry_id)
    if not entry:
        raise HTTPException(404, "Journal entry not found")
    net = db.query(func.coalesce(func.sum(JournalLine.debit - JournalLine.credit), 0)).filter(
        JournalLine.journal_entry_id == entry.id,
        JournalLine.account_id == line.account_id,
    ).scalar()
    if Decimal(net or 0).quantize(Decimal("0.01")) != Decimal(line.amount).quantize(Decimal("0.01")):
        raise HTTPException(409, "Journal entry does not match this bank account and signed amount")
    duplicate = db.query(BankStatementLine.id).filter(
        BankStatementLine.account_id == line.account_id,
        BankStatementLine.matched_journal_entry_id == entry.id,
        BankStatementLine.id != line.id,
    ).first()
    if duplicate:
        raise HTTPException(409, "This journal entry is already reconciled to another statement line")
    line.matched_journal_entry_id = entry.id
    line.matched_by = admin.id
    line.matched_at = datetime.now(timezone.utc)
    db.add(BankStatementMatchEvent(statement_line_id=line.id, journal_entry_id=entry.id, action="matched", actor_id=admin.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This journal entry has already been matched to another statement row")
    return {"id": line.id, "status": "matched", "journal_entry_id": entry.id}


@router.post("/erp/bank-reconciliation/{line_id}/unmatch")
def unmatch_bank_statement_line(
    line_id: str,
    admin: User = Depends(require_business_permission("erp")),
    db: Session = Depends(get_db),
):
    line = db.query(BankStatementLine).filter(BankStatementLine.id == line_id).with_for_update().first()
    if not line:
        raise HTTPException(404, "Statement line not found")
    if not line.matched_journal_entry_id:
        return {"id": line.id, "status": "unmatched"}
    previous_entry_id = line.matched_journal_entry_id
    db.add(BankStatementMatchEvent(statement_line_id=line.id, journal_entry_id=previous_entry_id, action="unmatched", actor_id=admin.id))
    line.matched_journal_entry_id = None
    line.matched_by = None
    line.matched_at = None
    db.commit()
    return {"id": line.id, "status": "unmatched"}


@router.get("/erp/bank-reconciliation/{line_id}/history")
def bank_reconciliation_history(line_id: str, db: Session = Depends(get_db)):
    if not db.get(BankStatementLine, line_id):
        raise HTTPException(404, "Statement line not found")
    rows = db.query(BankStatementMatchEvent, User.full_name, User.email, JournalEntry.description).join(
        User, User.id == BankStatementMatchEvent.actor_id
    ).outerjoin(JournalEntry, JournalEntry.id == BankStatementMatchEvent.journal_entry_id).filter(
        BankStatementMatchEvent.statement_line_id == line_id
    ).order_by(BankStatementMatchEvent.created_at.desc()).all()
    return [{
        "action": event.action, "journal_entry_id": event.journal_entry_id,
        "journal_description": description, "actor": name or email,
        "created_at": event.created_at,
    } for event, name, email, description in rows]
