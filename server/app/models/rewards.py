import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class PointLedgerEntry(Base):
    """Immutable record of one point award.

    A family's quarter balance is derived by summing entries whose awarded_at
    falls in the current calendar quarter (UTC) — there is no stored running
    balance. The unique constraint on completion_id is the idempotency
    mechanism: a completion can be awarded points at most once.
    """

    __tablename__ = "point_ledger_entries"
    __table_args__ = (UniqueConstraint("completion_id", name="uq_ledger_completion"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True
    )
    completion_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("completions.id", ondelete="CASCADE"), nullable=False
    )
    base_points: Mapped[int] = mapped_column(Integer, nullable=False)
    bonus_points: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    awarded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class RewardLevel(Base):
    """Seeded, system-wide reward tier. Not admin-editable, not per-group."""

    __tablename__ = "reward_levels"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    level_number: Mapped[int] = mapped_column(Integer, nullable=False, unique=True)
    points_threshold: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    title_en: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    description_en: Mapped[str | None] = mapped_column(String, nullable=True)
    # e.g. ["supermarket_voucher", "streaming_month"]; NULL when the level has
    # a single fixed reward
    choice_options: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    # NULL = no annual cap; Level 4 carries 3 (business model: 3x/family/year)
    annual_redemption_cap: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class Redemption(Base):
    """Immutable audit record of a family redeeming a reward level.

    Milestone semantics: redemption never debits the point balance. The unique
    constraint enforces at most one redemption per family per level per
    quarter; the Level 4 annual cap is checked in the service layer.
    """

    __tablename__ = "redemptions"
    __table_args__ = (
        UniqueConstraint("family_id", "reward_level_id", "quarter_key", name="uq_redemption_family_level_quarter"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    family_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("families.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reward_level_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reward_levels.id", ondelete="CASCADE"), nullable=False
    )
    quarter_key: Mapped[str] = mapped_column(String, nullable=False)  # e.g. "2026-Q3"
    chosen_option: Mapped[str | None] = mapped_column(String, nullable=True)
    points_at_redemption: Mapped[int] = mapped_column(Integer, nullable=False)
    # Placeholder code generated at redemption time (BOND-XXXXXX); real voucher
    # inventory is an evolution-path concern
    voucher_code: Mapped[str] = mapped_column(String, nullable=False)
    redeemed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )


class PhotoVerification(Base):
    """Immutable audit log of every verification action on a completion photo.

    One row per action; a completion accumulates multiple rows if rejected,
    re-submitted, and approved. reviewer_user_id is NULL for auto-approvals
    and SET NULL when the reviewer account is deleted (GDPR).
    """

    __tablename__ = "photo_verifications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    completion_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("completions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reviewer_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String, nullable=False)  # approved | rejected | auto_approved
    rejection_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    # manual | timed | llm ("llm" reserved for the planned AI-validation policy)
    policy_type: Mapped[str] = mapped_column(String, nullable=False, default="manual", server_default="manual")
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
