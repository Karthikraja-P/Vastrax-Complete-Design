"""Scoped CRM/ERP access grants for team accounts; admin users retain full access."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class BusinessTeamPermission(Base):
    __tablename__ = "business_team_permissions"
    __table_args__ = (UniqueConstraint("user_id", "permission", name="uq_business_team_user_permission"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    permission: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    granted_by: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
