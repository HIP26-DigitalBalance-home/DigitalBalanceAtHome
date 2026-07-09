"""add activity resources

Revision ID: 7e3b9d24c8a1
Revises: c9e7a4b2d1f0
Create Date: 2026-07-08

Adds external/internal resources attachable to activities, plus their photos
(reusing the completion photo lifecycle). Both tables cascade from activities,
so family/account erasure removes them automatically.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

from alembic import op

revision: str = "7e3b9d24c8a1"
down_revision: Union[str, None] = "c9e7a4b2d1f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "activity_resources",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "activity_id",
            UUID(as_uuid=True),
            sa.ForeignKey("activities.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("label", sa.String(length=100), nullable=True),
        sa.Column("url", sa.String(length=2048), nullable=True),
        sa.Column("note_text", sa.String(length=2000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("kind IN ('external','internal')", name="ck_activity_resource_kind"),
        sa.CheckConstraint(
            "(kind = 'external' AND url IS NOT NULL AND note_text IS NULL) OR (kind = 'internal' AND url IS NULL)",
            name="ck_activity_resource_shape",
        ),
    )
    op.create_index("ix_activity_resources_activity_id", "activity_resources", ["activity_id"])

    op.create_table(
        "activity_resource_photos",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "resource_id",
            UUID(as_uuid=True),
            sa.ForeignKey("activity_resources.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("photo_key", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("status IN ('processing','ready')", name="ck_activity_resource_photo_status"),
    )
    op.create_index("ix_activity_resource_photos_resource_id", "activity_resource_photos", ["resource_id"])


def downgrade() -> None:
    op.drop_index("ix_activity_resource_photos_resource_id", table_name="activity_resource_photos")
    op.drop_table("activity_resource_photos")
    op.drop_index("ix_activity_resources_activity_id", table_name="activity_resources")
    op.drop_table("activity_resources")
