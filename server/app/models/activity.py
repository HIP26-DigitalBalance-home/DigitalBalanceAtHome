import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Activity(Base, TimestampMixin):
    __tablename__ = "activities"

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    # English translations of curated content. NULL for user-created activities,
    # which fall back to the base title/description regardless of requested language.
    title_en: Mapped[str | None] = mapped_column(String, nullable=True)
    description_en: Mapped[str | None] = mapped_column(String, nullable=True)
    estimated_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    age_min: Mapped[int] = mapped_column(Integer, nullable=False)
    age_max: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_indicator: Mapped[str] = mapped_column(String, nullable=False)  # free | low_cost | paid
    season_relevance: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    weather_suitability: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    is_partner_content: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="de")
    # Ownership: NULL = global/curated activity. Non-null = user-created, visible
    # only to the owning family in the activity pool.
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    family_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=True
    )
