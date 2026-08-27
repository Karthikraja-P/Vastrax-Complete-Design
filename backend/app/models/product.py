import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("ix_products_category_id", "category_id"),
        Index("ix_products_name", "name"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: f"vtx-{uuid.uuid4().hex[:8]}"
    )
    category_id: Mapped[str] = mapped_column(ForeignKey("categories.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    fabric: Mapped[str | None] = mapped_column(String(100), nullable=True)
    colour: Mapped[str | None] = mapped_column(String(100), nullable=True)
    occasion: Mapped[str | None] = mapped_column(String(100), nullable=True)
    price_mrp: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    price_selling: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    model_path: Mapped[str | None] = mapped_column(String(255), nullable=True)  # relative URL e.g., /models/3d/{product_id}.glb
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    category: Mapped["Category"] = relationship("Category", back_populates="products")
    images: Mapped[list["ProductImage"]] = relationship(
        "ProductImage",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="ProductImage.display_order",
        lazy="select",
    )
    variants: Mapped[list["ProductVariant"]] = relationship(
        "ProductVariant", back_populates="product", cascade="all, delete-orphan", lazy="select"
    )
