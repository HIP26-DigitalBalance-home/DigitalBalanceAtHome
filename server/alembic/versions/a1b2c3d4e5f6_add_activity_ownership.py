"""add activity ownership columns

Revision ID: a1b2c3d4e5f6
Revises: d1d1fba86cde
Create Date: 2026-06-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "d1d1fba86cde"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NULL = global/curated activity (all existing seed rows stay global).
    op.add_column(
        "activities",
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "activities",
        sa.Column("family_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_activities_created_by_user",
        "activities",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_activities_family",
        "activities",
        "families",
        ["family_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_activities_family", "activities", type_="foreignkey")
    op.drop_constraint("fk_activities_created_by_user", "activities", type_="foreignkey")
    op.drop_column("activities", "family_id")
    op.drop_column("activities", "created_by_user_id")
