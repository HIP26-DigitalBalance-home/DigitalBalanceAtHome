import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RateLimitCounter(Base):
    """Fixed-window per-user request counter (persistent rate limiting).

    One row per (user, action, window). The action string embeds the window
    length so rules with different windows never share a row. Expired rows
    are purged by the photo-recovery sweep.
    """

    __tablename__ = "rate_limit_counters"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    action: Mapped[str] = mapped_column(String, primary_key=True)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
