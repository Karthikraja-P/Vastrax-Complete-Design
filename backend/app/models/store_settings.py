from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class StoreSettings(Base):
    """Persist the singleton store configuration, including the private stylist prompt."""

    __tablename__ = "app_settings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default="default")
    settings_json: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
