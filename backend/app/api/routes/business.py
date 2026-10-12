"""Admin CRM and commerce ERP endpoints backed by Vastrax's existing records."""
from datetime import date, datetime, timezone
from decimal import Decimal
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import case, func, or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.middleware.auth import require_business_permission
from app.models.business import CRMActivity, CRMLead, OperatingExpense, PurchaseOrder, PurchaseOrderLine, StockMovement, Supplier
from app.models.ledger import JournalEntry, JournalLine, LedgerAccount
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.product import Product
from app.models.product_variant import ProductVariant
from app.models.user import User
from app.models.marketing_consent import CRMMarketingConsentEvent

router = APIRouter(tags=["crm-erp"])


class LeadCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)
    source: str | None = Field(default=None, max_length=100)
    notes: str | None = None


class LeadUpdate(BaseModel):
    stage: Literal["new", "contacted", "qualified", "lost"]


class ActivityCreate(BaseModel):
    customer_id: str | None = None
    lead_id: str | None = None
    activity_type: Literal["note", "call", "email", "meeting", "task"] = "note"
    subject: str = Field(min_length=1, max_length=255)
    description: str | None = None
    due_at: datetime | None = None


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    gstin: str | None = Field(default=None, max_length=20)
    address: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255)
    contact_name: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=40)
    gstin: str | None = Field(default=None, max_length=20)
    address: str | None = None
    is_active: bool | None = None


class PurchaseLineCreate(BaseModel):
    variant_id: str
    quantity: int = Field(gt=0, le=100000)
    unit_cost: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class PurchaseOrderCreate(BaseModel):
    supplier_id: str
    expected_date: date | None = None
    notes: str | None = None
    items: list[PurchaseLineCreate] = Field(min_length=1)


class ReceiptLine(BaseModel):
    line_id: str
    quantity: int = Field(gt=0, le=100000)


class PurchaseReceipt(BaseModel):
    items: list[ReceiptLine] = Field(min_length=1)
    inventory_account_id: str
    payable_account_id: str


class StockAdjustment(BaseModel):
    quantity_delta: int
    reason: Literal["count_correction", "damaged", "returned", "other"]
    notes: str | None = None


class ExpenseCreate(BaseModel):
    category: str = Field(min_length=1, max_length=80)
    description: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    tax_amount: Decimal = Field(default=Decimal("0"), ge=0, max_digits=12, decimal_places=2)
    supplier_id: str | None = None
    reference: str | None = Field(default=None, max_length=100)
    expense_date: date
    expense_account_id: str
    credit_account_id: str
    input_tax_account_id: str | None = None


@router.get("/crm/overview", dependencies=[Depends(require_business_permission("crm"))])
def crm_overview(db: Session = Depends(get_db)):
    open_leads = db.query(func.count(CRMLead.id)).filter(CRMLead.stage.notin_(["converted", "lost"])).scalar() or 0
    due_tasks = db.query(func.count(CRMActivity.id)).filter(
        CRMActivity.activity_type == "task", CRMActivity.completed_at.is_(None), CRMActivity.due_at <= datetime.now(timezone.utc)
    ).scalar() or 0
    customers = db.query(func.count(User.id)).filter(User.role == "customer", User.is_active.is_(True)).scalar() or 0
    activities = db.query(func.count(CRMActivity.id)).scalar() or 0
    return {"customers": customers, "open_leads": open_leads, "due_tasks": due_tasks, "logged_activities": activities}


@router.get("/crm/customers", dependencies=[Depends(require_business_permission("crm"))])
        raise HTTPException(422, "Choose an active asset account for received inventory")
    if not payable_account or not payable_account.is_active or payable_account.account_type != "liability":
        raise HTTPException(422, "Choose an active liability account for supplier payable")
    if len({receipt.line_id for receipt in body.items}) != len(body.items):
        raise HTTPException(422, "Each purchase order line can appear once per receipt")
    validated = []
    total_cost = Decimal("0.00")
    for receipt in body.items:
        line = db.query(PurchaseOrderLine).filter(PurchaseOrderLine.id == receipt.line_id).with_for_update().first()
        if not line or line.purchase_order_id != po.id:
            raise HTTPException(404, "Purchase order line not found")
        if line.quantity_received + receipt.quantity > line.quantity_ordered:
            raise HTTPException(409, "Received quantity exceeds the ordered quantity")
        variant = db.query(ProductVariant).filter(ProductVariant.id == line.variant_id).with_for_update().first()
        if not variant:
            raise HTTPException(409, "Product variant no longer exists")
        validated.append((receipt, line, variant))
        total_cost += Decimal(receipt.quantity) * Decimal(line.unit_cost)
    for receipt, line, variant in validated:
        before = int(variant.stock_qty or 0)
        variant.stock_qty = before + receipt.quantity
        line.quantity_received += receipt.quantity
        db.add(StockMovement(product_id=line.product_id, variant_id=line.variant_id, quantity_delta=receipt.quantity,
                             stock_before=before, stock_after=variant.stock_qty, reason="purchase_receipt",
                             reference_id=po.id, created_by=admin.id))
    lines = db.query(PurchaseOrderLine).filter(PurchaseOrderLine.purchase_order_id == po.id).all()
    po.status = "received" if all(line.quantity_received == line.quantity_ordered for line in lines) else "partially_received"
    journal_entry_id = None
    if total_cost > 0:
        entry = JournalEntry(posting_date=date.today(), description=f"Inventory receipt for {po.id}",
                             reference=f"RECEIPT-{uuid.uuid4().hex[:12].upper()}", created_by=admin.id)
        db.add(entry)
        db.flush()
        db.add_all([
            JournalLine(journal_entry_id=entry.id, account_id=inventory_account.id, debit=total_cost, credit=0),
            JournalLine(journal_entry_id=entry.id, account_id=payable_account.id, debit=0, credit=total_cost),
        ])
        journal_entry_id = entry.id
    db.commit()
    return {"id": po.id, "status": po.status, "journal_entry_id": journal_entry_id}


@router.post("/erp/purchase-orders/{po_id}/cancel", dependencies=[Depends(require_business_permission("erp"))])
def cancel_purchase_order(po_id: str, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).with_for_update().first()
    if not po or po.status not in ("ordered", "partially_received"):
        raise HTTPException(409, "Only an open purchase order can be cancelled")
    po.status = "cancelled"
    db.commit()
    return {"id": po.id, "status": po.status}


@router.get("/erp/expenses", dependencies=[Depends(require_business_permission("erp"))])
def list_expenses(db: Session = Depends(get_db)):
    return db.query(OperatingExpense).order_by(OperatingExpense.expense_date.desc(), OperatingExpense.created_at.desc()).limit(500).all()


@router.post("/erp/expenses", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_business_permission("erp"))])
def create_expense(body: ExpenseCreate, admin: User = Depends(require_business_permission("erp")), db: Session = Depends(get_db)):
    if body.supplier_id and not db.get(Supplier, body.supplier_id):
        raise HTTPException(404, "Supplier not found")
    expense_account = db.get(LedgerAccount, body.expense_account_id)
    credit_account = db.get(LedgerAccount, body.credit_account_id)
    tax_account = db.get(LedgerAccount, body.input_tax_account_id) if body.input_tax_account_id else None
    if not expense_account or not expense_account.is_active or expense_account.account_type != "expense":
        raise HTTPException(422, "Choose an active expense account")
    if not credit_account or not credit_account.is_active or credit_account.account_type not in ("asset", "liability"):
        raise HTTPException(422, "Choose an active asset or liability credit account")
    if body.tax_amount > 0 and (not tax_account or not tax_account.is_active or tax_account.account_type != "asset"):
        raise HTTPException(422, "Choose an active asset account for recoverable tax")
    expense_data = body.model_dump(exclude={"expense_account_id", "credit_account_id", "input_tax_account_id"})
    expense = OperatingExpense(**expense_data, created_by=admin.id)
    db.add(expense)
    db.flush()
    entry = JournalEntry(posting_date=body.expense_date, description=f"Expense: {body.description}",
                         reference=body.reference or f"EXP-{expense.id}", created_by=admin.id)
    db.add(entry)
    db.flush()
    journal_lines = [
        JournalLine(journal_entry_id=entry.id, account_id=expense_account.id, debit=body.amount, credit=0),
        JournalLine(journal_entry_id=entry.id, account_id=credit_account.id, debit=0, credit=body.amount + body.tax_amount),
    ]
    if body.tax_amount > 0 and tax_account:
        journal_lines.append(JournalLine(journal_entry_id=entry.id, account_id=tax_account.id, debit=body.tax_amount, credit=0))
    db.add_all(journal_lines)
    db.commit()
    db.refresh(expense)
    return {"expense": expense, "journal_entry_id": entry.id}
