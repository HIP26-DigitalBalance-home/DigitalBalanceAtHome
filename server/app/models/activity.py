from sqlalchemy import Boolean, Integer, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Activity(Base, TimestampMixin):
    __tablename__ = "activities"

    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    estimated_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    age_min: Mapped[int] = mapped_column(Integer, nullable=False)
    age_max: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_indicator: Mapped[str] = mapped_column(String, nullable=False)  # free | low_cost | paid
    season_relevance: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    weather_suitability: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    is_partner_content: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
