import uuid
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.activity_resource_photo import ActivityResourcePhoto


class ActivityResource(Base, TimestampMixin):
    """A helpful item attached to an activity to reduce doing overhead.

    Discriminated by ``kind``:
      * external  → a web link (``url`` required, optional ``label``)
      * internal  → a written note (``note_text``) with zero or more photos

    Invariant (FR-003, service-enforced): an internal resource must have
    non-empty ``note_text`` OR at least one photo. The creation paths never
    write a transient-empty row.
    """

    __tablename__ = "activity_resources"
    __table_args__ = (
        CheckConstraint("kind IN ('external','internal')", name="ck_activity_resource_kind"),
        CheckConstraint(
            "(kind = 'external' AND url IS NOT NULL AND note_text IS NULL) OR (kind = 'internal' AND url IS NULL)",
            name="ck_activity_resource_shape",
        ),
    )

    activity_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(String, nullable=False)  # external | internal
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    label: Mapped[str | None] = mapped_column(String(100), nullable=True)
    url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    note_text: Mapped[str | None] = mapped_column(String(2000), nullable=True)

    photos: Mapped[list["ActivityResourcePhoto"]] = relationship(
        "ActivityResourcePhoto",
        back_populates="resource",
        order_by="ActivityResourcePhoto.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
