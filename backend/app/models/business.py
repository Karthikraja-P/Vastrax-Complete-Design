"""Customer relationship and commerce operations records for Vastrax."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class CRMLead(Base):
    __tablename__ = "crm_leads"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True, index=True)
    source: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stage: Mapped[str] = mapped_column(String(30), nullable=False, default="new", index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    converted_customer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)


class CRMActivity(Base):
    __tablename__ = "crm_activities"
    __table_args__ = (
        CheckConstraint("(customer_id IS NOT NULL) != (lead_id IS NOT NULL)", name="ck_crm_activity_one_contact"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    customer_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    lead_id: Mapped[str | None] = mapped_column(ForeignKey("crm_leads.id"), nullable=True, index=True)
    activity_type: Mapped[str] = mapped_column(String(30), nullable=False, default="note")
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    assigned_to: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class Supplier(Base):
    __tablename__ = "erp_suppliers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    gstin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class PurchaseOrder(Base):
    __tablename__ = "erp_purchase_orders"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: f"PO-{uuid.uuid4().hex[:10].upper()}")
    supplier_id: Mapped[str] = mapped_column(ForeignKey("erp_suppliers.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="draft", index=True)
    expected_date: Mapped[datetime | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)


class PurchaseOrderLine(Base):
    __tablename__ = "erp_purchase_order_lines"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    purchase_order_id: Mapped[str] = mapped_column(ForeignKey("erp_purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    variant_id: Mapped[str] = mapped_column(ForeignKey("product_variants.id"), nullable=False)
    quantity_ordered: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_received: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)



class SupplierPayment(Base):
    __tablename__ = "erp_supplier_payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_supplier_payment_positive_amount"),
        UniqueConstraint("supplier_id", "reference", name="uq_supplier_payment_reference"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    purchase_order_id: Mapped[str] = mapped_column(ForeignKey("erp_purchase_orders.id"), nullable=False, index=True)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("erp_suppliers.id"), nullable=False, index=True)
    payable_account_id: Mapped[str] = mapped_column(ForeignKey("erp_ledger_accounts.id"), nullable=False)
    payment_account_id: Mapped[str] = mapped_column(ForeignKey("erp_ledger_accounts.id"), nullable=False)
    journal_entry_id: Mapped[str] = mapped_column(ForeignKey("erp_journal_entries.id"), nullable=False, unique=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    reference: Mapped[str] = mapped_column(String(100), nullable=False)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)



class SupplierExpensePayment(Base):
    __tablename__ = "erp_supplier_expense_payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_supplier_expense_payment_positive_amount"),
        UniqueConstraint("supplier_id", "reference", name="uq_supplier_expense_payment_reference"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    expense_id: Mapped[str] = mapped_column(ForeignKey("erp_operating_expenses.id"), nullable=False, index=True)
    supplier_id: Mapped[str] = mapped_column(ForeignKey("erp_suppliers.id"), nullable=False, index=True)
    payable_account_id: Mapped[str] = mapped_column(ForeignKey("erp_ledger_accounts.id"), nullable=False)
    payment_account_id: Mapped[str] = mapped_column(ForeignKey("erp_ledger_accounts.id"), nullable=False)
    journal_entry_id: Mapped[str] = mapped_column(ForeignKey("erp_journal_entries.id"), nullable=False, unique=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    reference: Mapped[str] = mapped_column(String(100), nullable=False)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class StockMovement(Base):
    __tablename__ = "erp_stock_movements"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    variant_id: Mapped[str] = mapped_column(ForeignKey("product_variants.id"), nullable=False, index=True)
    quantity_delta: Mapped[int] = mapped_column(Integer, nullable=False)
    stock_before: Mapped[int] = mapped_column(Integer, nullable=False)
    stock_after: Mapped[int] = mapped_column(Integer, nullable=False)
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    reference_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class ERPPurchaseOrderRequest(Base):
    """Idempotency record for purchase-order creation requests."""
    __tablename__ = "erp_purchase_order_requests"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_erp_purchase_order_request_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    purchase_order_id: Mapped[str] = mapped_column(ForeignKey("erp_purchase_orders.id"), nullable=False, unique=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class ERPInventoryReceipt(Base):
    """Idempotency record for a posted purchase-order stock receipt."""
    __tablename__ = "erp_inventory_receipts"
    __table_args__ = (UniqueConstraint("idempotency_key", name="uq_erp_inventory_receipt_key"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    idempotency_key: Mapped[str] = mapped_column(String(64), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    purchase_order_id: Mapped[str] = mapped_column(ForeignKey("erp_purchase_orders.id"), nullable=False, index=True)
    result_status: Mapped[str] = mapped_column(String(30), nullable=False)
    journal_entry_id: Mapped[str | None] = mapped_column(ForeignKey("erp_journal_entries.id"), nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)


class OperatingExpense(Base):
    __tablename__ = "erp_operating_expenses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    tax_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=Decimal("0"))
    supplier_id: Mapped[str | None] = mapped_column(ForeignKey("erp_suppliers.id"), nullable=True)
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True)
    journal_entry_id: Mapped[str | None] = mapped_column(ForeignKey("erp_journal_entries.id"), nullable=True, index=True)
    expense_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)