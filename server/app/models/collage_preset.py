import uuid

from sqlalchemy import Integer, String
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CollagePreset(Base, TimestampMixin):
    __tablename__ = "collage_presets"

    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(String, nullable=False)
    # English translations of the curated preset name/description (NULL = none).
    name_en: Mapped[str | None] = mapped_column(String, nullable=True)
    description_en: Mapped[str | None] = mapped_column(String, nullable=True)
    # Exactly nine activity ids, ordered by grid position 0–8.
    activity_ids: Mapped[list[uuid.UUID]] = mapped_column(ARRAY(UUID(as_uuid=True)), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
