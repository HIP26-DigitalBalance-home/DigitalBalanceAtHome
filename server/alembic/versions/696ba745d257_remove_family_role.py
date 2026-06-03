"""remove family role — families have no admin concept

Revision ID: 696ba745d257
Revises: 0939c91dc10f
Create Date: 2026-05-29

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "696ba745d257"
down_revision: Union[str, None] = "0939c91dc10f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("family_memberships", "role")
    postgresql.ENUM(name="family_role").drop(op.get_bind(), checkfirst=True)


def downgrade() -> None:
    family_role = postgresql.ENUM("admin", "member", name="family_role", create_type=True)
    family_role.create(op.get_bind())
    op.add_column(
        "family_memberships",
        sa.Column(
            "role",
            postgresql.ENUM("admin", "member", name="family_role", create_type=False),
            nullable=False,
            server_default="member",
        ),
    )
