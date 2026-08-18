from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    address_id: Mapped[str] = mapped_column(ForeignKey("addresses.id"), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    payment_status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    shipping_shipment_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipping_awb: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipping_courier: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipping_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    placed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    user: Mapped["User"] = relationship("User", back_populates="orders")
    address: Mapped["Address"] = relationship("Address")
    items: Mapped[list["OrderItem"]] = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan", lazy="select"
    )
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="order", lazy="select")
