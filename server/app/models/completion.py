import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Completion(Base, TimestampMixin):
    __tablename__ = "completions"
    __table_args__ = (UniqueConstraint("family_id", "challenge_activity_id", name="uq_completion"),)

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
    shared_to_feed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
