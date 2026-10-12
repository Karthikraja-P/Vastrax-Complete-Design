"""Account mappings for automatic postings from shared ecommerce records."""
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ERPPostingConfig(Base):
    __tablename__ = "erp_posting_config"

    id: Mapped[str] = mapped_column(String(20), primary_key=True, default="default")
    payment_clearing_account_id: Mapped[str] = mapped_column(ForeignKey("erp_ledger_accounts.id"), nullable=False)
    customer_advances_account_id: Mapped[str] = mapped_column(ForeignKey("erp_ledger_accounts.id"), nullable=False)
    sales_revenue_account_id: Mapped[str] = mapped_column(ForeignKey("erp_ledger_accounts.id"), nullable=False)
    sales_returns_account_id: Mapped[str] = mapped_column(ForeignKey("erp_ledger_accounts.id"), nullable=False)
    updated_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
