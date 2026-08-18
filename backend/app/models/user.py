import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    phone_number: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="customer")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    refresh_token_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    addresses: Mapped[list["Address"]] = relationship(
        "Address", back_populates="user", cascade="all, delete-orphan", lazy="select"
    )
    wishlist_items: Mapped[list["Wishlist"]] = relationship(
        "Wishlist", back_populates="user", cascade="all, delete-orphan", lazy="select"
    )
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="user", lazy="select")
    tryon_sessions: Mapped[list["TryonSession"]] = relationship(
        "TryonSession", back_populates="user", lazy="select"
    )
    payments: Mapped[list["Payment"]] = relationship("Payment", back_populates="user", lazy="select")
