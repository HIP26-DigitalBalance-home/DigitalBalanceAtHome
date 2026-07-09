import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.activity_resource import ActivityResource


class ActivityResourcePhoto(Base, TimestampMixin):
    """An image belonging to exactly one internal ActivityResource.

    Same lifecycle as completion photos: uploaded raw → background compression
    → ``status='ready'`` with the compressed object at ``photo_key``. Served
    only via pre-signed URLs generated on read (never stored)."""

    __tablename__ = "activity_resource_photos"
    __table_args__ = (CheckConstraint("status IN ('processing','ready')", name="ck_activity_resource_photo_status"),)

    resource_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("activity_resources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    photo_key: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, nullable=False)  # processing | ready
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    resource: Mapped["ActivityResource"] = relationship("ActivityResource", back_populates="photos")
