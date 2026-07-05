"""add time spent tracking

Revision ID: c9e7a4b2d1f0
Revises: f2a4c6e8b0d1
Create Date: 2026-07-05

Adds parent-scoped manual daily time and a stable local completion date.
Journal data and schema are intentionally untouched.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "c9e7a4b2d1f0"
down_revision: Union[str, None] = "f2a4c6e8b0d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "manual_time_entries",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "entry_date", name="uq_manual_time_user_date"),
        sa.CheckConstraint("minutes >= 1 AND minutes <= 1440", name="ck_manual_time_minutes_range"),
    )
    op.create_index("ix_manual_time_entries_user_id", "manual_time_entries", ["user_id"])

    op.add_column("completions", sa.Column("completed_on", sa.Date(), nullable=True))
    op.execute("UPDATE completions SET completed_on = (completed_at AT TIME ZONE 'UTC')::date")
    op.alter_column("completions", "completed_on", nullable=False)
    op.create_index(
        "ix_completions_user_completed_on",
        "completions",
        ["completed_by_user_id", "completed_on"],
    )
    op.create_check_constraint(
        "ck_completion_duration_minutes_range",
        "completions",
        "duration_minutes IS NULL OR (duration_minutes >= 1 AND duration_minutes <= 1440)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_completion_duration_minutes_range", "completions", type_="check")
    op.drop_index("ix_completions_user_completed_on", table_name="completions")
    op.drop_column("completions", "completed_on")
    op.drop_index("ix_manual_time_entries_user_id", table_name="manual_time_entries")
    op.drop_table("manual_time_entries")
