import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, CheckConstraint, Date, DateTime, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Completion(Base, TimestampMixin):
    __tablename__ = "completions"
    __table_args__ = (
        UniqueConstraint("family_id", "challenge_activity_id", name="uq_completion"),
        CheckConstraint(
            "duration_minutes IS NULL OR (duration_minutes >= 1 AND duration_minutes <= 1440)",
            name="ck_completion_duration_minutes_range",
        ),
        Index("ix_completions_user_completed_on", "completed_by_user_id", "completed_on"),
    )

    challenge_activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("challenge_activities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    family_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True
    )
    completed_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # processing | pending_verification | verified | rejected | self_reported
    status: Mapped[str] = mapped_column(String, nullable=False)
    photo_key: Mapped[str | None] = mapped_column(String, nullable=True)
    caption: Mapped[str | None] = mapped_column(String, nullable=True)
    # Family-reported activity duration from the upload dropdown; required for
    # casual-tier activities (30-minute point gate), optional otherwise
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    completed_on: Mapped[date] = mapped_column(Date, nullable=False)
    shared_to_feed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
