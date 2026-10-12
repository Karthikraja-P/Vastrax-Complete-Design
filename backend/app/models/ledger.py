"""Append-only double-entry ledger records."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LedgerAccount(Base):
    __tablename__ = "erp_ledger_accounts"
    __table_args__ = (UniqueConstraint("code", name="uq_ledger_account_code"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    account_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class JournalEntry(Base):
    __tablename__ = "erp_journal_entries"
    __table_args__ = (Index("uq_erp_journal_source_key", "source_key", unique=True),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: f"JE-{uuid.uuid4().hex[:12].upper()}")
    posting_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    reference: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    source_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class JournalLine(Base):
    __tablename__ = "erp_journal_lines"
    __table_args__ = (
        CheckConstraint("debit >= 0 AND credit >= 0", name="ck_journal_nonnegative_amounts"),
        CheckConstraint("(debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)", name="ck_journal_one_side_per_line"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    journal_entry_id: Mapped[str] = mapped_column(ForeignKey("erp_journal_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id: Mapped[str] = mapped_column(ForeignKey("erp_ledger_accounts.id"), nullable=False, index=True)
    debit: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    credit: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False, default=Decimal("0"))
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
