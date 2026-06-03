import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ConsentRecord(Base):
    """Append-only GDPR consent log. Never update in place — always insert a new row."""

    __tablename__ = "consent_records"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    policy_version: Mapped[str] = mapped_column(String, nullable=False)
    consented_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    data_storage_consent: Mapped[bool] = mapped_column(Boolean, nullable=False)
    photo_processing_consent: Mapped[bool] = mapped_column(Boolean, nullable=False)
    location_consent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
