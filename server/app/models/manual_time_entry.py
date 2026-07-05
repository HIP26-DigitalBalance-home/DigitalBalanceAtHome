import uuid
from datetime import date

from sqlalchemy import CheckConstraint, Date, ForeignKey, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ManualTimeEntry(Base, TimestampMixin):
    """One parent-entered manual time total per local calendar day."""

    __tablename__ = "manual_time_entries"
    __table_args__ = (
        UniqueConstraint("user_id", "entry_date", name="uq_manual_time_user_date"),
        CheckConstraint("minutes >= 1 AND minutes <= 1440", name="ck_manual_time_minutes_range"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    minutes: Mapped[int] = mapped_column(Integer, nullable=False)
