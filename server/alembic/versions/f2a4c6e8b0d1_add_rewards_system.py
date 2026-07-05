"""add rewards system: effort tiers, verification statuses, point ledger, reward levels

Revision ID: f2a4c6e8b0d1
Revises: 387fb2accfe3
Create Date: 2026-07-05

Family Points & Reward Levels (specs/003-rewards-system, Rev 2 demo scope):

- activities.effort_tier (casual | dedicated) with an OD-101 backfill for the
  curated seed activities (marketplace tier is derived from cost_indicator /
  is_partner_content, never stored)
- challenges.is_featured (community challenge, +5 bonus points)
- completions.duration_minutes (30-minute casual gate) and a data migration
  moving legacy 'ready' completions to 'verified'
- point_ledger_entries: immutable point awards; quarter balance is derived
- reward_levels: 4 seeded global milestone tiers (50/100/150/250)
- redemptions: once per family/level/quarter, Level 4 capped 3x/year
- photo_verifications: immutable audit log of verification actions
"""

import json
import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID

from alembic import op

revision: str = "f2a4c6e8b0d1"
down_revision: Union[str, None] = "387fb2accfe3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# OD-101: curated seed activities classified as "dedicated" (structured /
# planned, mirroring the business model's examples: board game night, cooking
# project, bike outing). Matched by German title against curated rows
# (family_id IS NULL); everything else stays "casual".
DEDICATED_TITLES: list[str] = [
    "Gemeinsam ein Gericht kochen",
    "Ein Brettspiel spielen",
    "Ein Puzzle lösen",
    "Die Bücherei besuchen",
    "Ein Vogelhäuschen bauen",
    "Schnitzeljagd im Park",
    "Einen Brief an die Großeltern schreiben",
    "Ein Picknick vorbereiten und draußen essen",
    "Eine Seite für das Familienalbum gestalten",
    "Dem Kind Fahrradfahren beibringen",
]

# fmt: off
# (level_number, points_threshold, title, title_en, description, description_en,
#  choice_options, annual_redemption_cap)
REWARD_LEVELS = [
    (1, 50,
     "Kostenloses BOND Marktplatz-Erlebnis",
     "Free BOND marketplace activity credit",
     "Eine kostenlose Session bei einem BOND-Partner — z. B. Töpfern oder Sport.",
     "One free session with a BOND partner — e.g. pottery or a sports class.",
     None, None),
    (2, 100,
     "Kinokarten",
     "Cinema tickets",
     "Zwei Kinokarten für einen gemeinsamen Kinobesuch von Elternteil und Kind.",
     "Two cinema tickets for a parent-and-child trip to the movies.",
     None, None),
    (3, 150,
     "Supermarktgutschein oder Streaming-Monat",
     "Supermarket voucher or streaming month",
     "Wähle: REWE-Gutschein (20–30 EUR) oder ein Monat Disney+/Netflix.",
     "Your choice: a REWE voucher (20–30 EUR) or one month of Disney+/Netflix.",
     ["supermarket_voucher", "streaming_month"], None),
    (4, 250,
     "LEGO-Set oder Musik-/Keramikkurs",
     "LEGO set or music/ceramics class",
     "Ein LEGO-Set oder eine einzelne Musik- bzw. Keramikstunde für dein Kind. Maximal 3x pro Jahr einlösbar.",
     "A LEGO set or a single music/ceramics class for your child. Redeemable at most 3x per year.",
     None, 3),
]
# fmt: on


def upgrade() -> None:
    # ── Column additions on existing tables ─────────────────────
    op.add_column(
        "activities",
        sa.Column("effort_tier", sa.String(), nullable=False, server_default="casual"),
    )
    op.add_column(
        "challenges",
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("completions", sa.Column("duration_minutes", sa.Integer(), nullable=True))

    conn = op.get_bind()

    # OD-101 backfill: flip curated structured activities to "dedicated"
    conn.execute(
        sa.text("UPDATE activities SET effort_tier = 'dedicated' WHERE title = ANY(:titles) AND family_id IS NULL"),
        {"titles": DEDICATED_TITLES},
    )

    # Legacy status migration: 'ready' predates the verification pipeline and
    # maps to 'verified' (photos were implicitly trusted before this feature)
    conn.execute(sa.text("UPDATE completions SET status = 'verified' WHERE status = 'ready'"))

    # ── New tables ───────────────────────────────────────────────
    op.create_table(
        "point_ledger_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "family_id",
            UUID(as_uuid=True),
            sa.ForeignKey("families.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "completion_id",
            UUID(as_uuid=True),
            sa.ForeignKey("completions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("base_points", sa.Integer(), nullable=False),
        sa.Column("bonus_points", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("awarded_at", sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("completion_id", name="uq_ledger_completion"),
    )

    op.create_table(
        "reward_levels",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("level_number", sa.Integer(), nullable=False, unique=True),
        sa.Column("points_threshold", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("title_en", sa.String(), nullable=True),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("description_en", sa.String(), nullable=True),
        sa.Column("choice_options", JSONB(), nullable=True),
        sa.Column("annual_redemption_cap", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.create_table(
        "redemptions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "family_id",
            UUID(as_uuid=True),
            sa.ForeignKey("families.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "reward_level_id",
            UUID(as_uuid=True),
            sa.ForeignKey("reward_levels.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("quarter_key", sa.String(), nullable=False),
        sa.Column("chosen_option", sa.String(), nullable=True),
        sa.Column("points_at_redemption", sa.Integer(), nullable=False),
        sa.Column("voucher_code", sa.String(), nullable=False),
        sa.Column("redeemed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("family_id", "reward_level_id", "quarter_key", name="uq_redemption_family_level_quarter"),
    )

    op.create_table(
        "photo_verifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "completion_id",
            UUID(as_uuid=True),
            sa.ForeignKey("completions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "reviewer_user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("rejection_reason", sa.String(), nullable=True),
        sa.Column("policy_type", sa.String(), nullable=False, server_default="manual"),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # ── Seed the 4 global reward levels ─────────────────────────
    for number, threshold, title, title_en, desc, desc_en, options, cap in REWARD_LEVELS:
        conn.execute(
            sa.text(
                "INSERT INTO reward_levels "
                "(id, level_number, points_threshold, title, title_en, description, description_en, "
                " choice_options, annual_redemption_cap) "
                "VALUES (:id, :number, :threshold, :title, :title_en, :desc, :desc_en, "
                "        CAST(:options AS jsonb), :cap)"
            ),
            {
                "id": str(uuid.uuid4()),
                "number": number,
                "threshold": threshold,
                "title": title,
                "title_en": title_en,
                "desc": desc,
                "desc_en": desc_en,
                "options": None if options is None else json.dumps(options),
                "cap": cap,
            },
        )


def downgrade() -> None:
    op.drop_table("photo_verifications")
    op.drop_table("redemptions")
    op.drop_table("reward_levels")
    op.drop_table("point_ledger_entries")

    conn = op.get_bind()
    conn.execute(sa.text("UPDATE completions SET status = 'ready' WHERE status = 'verified'"))
    conn.execute(
        sa.text("UPDATE completions SET status = 'ready' WHERE status IN ('pending_verification', 'rejected')")
    )

    op.drop_column("completions", "duration_minutes")
    op.drop_column("challenges", "is_featured")
    op.drop_column("activities", "effort_tier")
