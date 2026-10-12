"""Return authorization and receipt records linked to Vastrax orders."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SalesReturn(Base):
    __tablename__ = "erp_sales_returns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: f"RET-{uuid.uuid4().hex[:12].upper()}")
    order_id: Mapped[str] = mapped_column(ForeignKey("orders.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="requested", index=True)
    reason: Mapped[str] = mapped_column(String(40), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    reviewed_by: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class SalesReturnLine(Base):
    __tablename__ = "erp_sales_return_lines"
    __table_args__ = (
        UniqueConstraint("return_id", "order_item_id", name="uq_return_order_item"),
        CheckConstraint("quantity_requested > 0", name="ck_return_qty_positive"),
        CheckConstraint("quantity_received >= 0 AND quantity_received <= quantity_requested", name="ck_return_qty_received"),
        CheckConstraint("quantity_restocked >= 0 AND quantity_restocked <= quantity_received", name="ck_return_qty_restocked"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    return_id: Mapped[str] = mapped_column(ForeignKey("erp_sales_returns.id", ondelete="CASCADE"), nullable=False, index=True)
    order_item_id: Mapped[str] = mapped_column(ForeignKey("order_items.id"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id"), nullable=False)
    variant_id: Mapped[str] = mapped_column(ForeignKey("product_variants.id"), nullable=False)
    quantity_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_received: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    quantity_restocked: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
