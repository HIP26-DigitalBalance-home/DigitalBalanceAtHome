"""add consent family child tables

Revision ID: fbb22b7d05c1
Revises: c76f0473bee1
Create Date: 2026-05-29

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "fbb22b7d05c1"
down_revision: Union[str, None] = "c76f0473bee1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # consent_records
    op.create_table(
        "consent_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("policy_version", sa.String(), nullable=False),
        sa.Column("consented_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("data_storage_consent", sa.Boolean(), nullable=False),
        sa.Column("photo_processing_consent", sa.Boolean(), nullable=False),
        sa.Column("location_consent", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_consent_records_user_id", "consent_records", ["user_id"])

    # families
    op.create_table(
        "families",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # family_role enum
    family_role = postgresql.ENUM("admin", "member", name="family_role", create_type=True)
    family_role.create(op.get_bind())

    # family_memberships
    op.create_table(
        "family_memberships",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("families.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", postgresql.ENUM("admin", "member", name="family_role", create_type=False), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("family_id", "user_id", name="uq_family_membership"),
    )
    op.create_index("ix_family_memberships_family_id", "family_memberships", ["family_id"])
    op.create_index("ix_family_memberships_user_id", "family_memberships", ["user_id"])

    # family_invites
    op.create_table(
        "family_invites",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("families.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", postgresql.UUID(as_uuid=True), unique=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("created_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
    )

    # child_profiles
    op.create_table(
        "child_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("family_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("families.id", ondelete="CASCADE"), nullable=False),
        sa.Column("nickname", sa.String(), nullable=False),
        sa.Column("date_of_birth", sa.Date(), nullable=False),
        sa.Column("interests", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_child_profiles_family_id", "child_profiles", ["family_id"])


def downgrade() -> None:
    op.drop_index("ix_child_profiles_family_id", table_name="child_profiles")
    op.drop_table("child_profiles")
    op.drop_table("family_invites")
    op.drop_index("ix_family_memberships_user_id", table_name="family_memberships")
    op.drop_index("ix_family_memberships_family_id", table_name="family_memberships")
    op.drop_table("family_memberships")
    postgresql.ENUM(name="family_role").drop(op.get_bind())
    op.drop_table("families")
    op.drop_index("ix_consent_records_user_id", table_name="consent_records")
    op.drop_table("consent_records")
