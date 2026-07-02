import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class JournalEntry(Base, TimestampMixin):
    """One self-reported parent mood per user per local calendar day."""

    __tablename__ = "journal_entries"
    __table_args__ = (UniqueConstraint("user_id", "entry_date", name="uq_journal_user_date"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entry_date: Mapped[date] = mapped_column(Date, nullable=False)
    mood: Mapped[str] = mapped_column(String, nullable=False)  # bad | not_good | okay | good | super
