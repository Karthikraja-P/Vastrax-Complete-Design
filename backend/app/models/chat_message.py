import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, String, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    __table_args__ = (
        Index("ix_chat_messages_session_id", "session_id"),
        Index("ix_chat_messages_user_id", "user_id"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: f"msg-{uuid.uuid4().hex[:8]}"
    )
    session_id: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    sender: Mapped[str] = mapped_column(String(20), nullable=False)  # "user" | "stylist"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_products: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON string
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
