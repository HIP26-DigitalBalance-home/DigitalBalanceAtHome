"""add rate limit counters

Revision ID: a1f4d7e92b03
Revises: 7e3b9d24c8a1
Create Date: 2026-07-09

Fixed-window per-user request counters backing the persistent rate limiter.
Rows cascade from users, so account erasure removes them automatically;
expired windows are purged by the in-app recovery sweep.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "a1f4d7e92b03"
down_revision: Union[str, None] = "7e3b9d24c8a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rate_limit_counters",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False, server_default="1"),
        sa.PrimaryKeyConstraint("user_id", "action", "window_start"),
    )


def downgrade() -> None:
    op.drop_table("rate_limit_counters")
