"""convert family streaks from weeks to days

Revision ID: a7c1e2d3f4b5
Revises: fd1957537579
Create Date: 2026-07-02 00:00:00.000000

Streaks are now measured in consecutive days with at least one completion,
replacing the previous ISO-week-based tracking. Existing week-based values are
not meaningfully convertible to days, so streaks reset to zero on upgrade.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a7c1e2d3f4b5'
down_revision: Union[str, None] = 'fd1957537579'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop the week-based tracking columns
    op.drop_column('families', 'last_frozen_iso_week')
    op.drop_column('families', 'last_activity_iso_week')
    op.drop_column('families', 'longest_streak_weeks')
    op.drop_column('families', 'last_streak_weeks')
    op.drop_column('families', 'streak_weeks')

    # Add the day-based tracking columns
    op.add_column('families', sa.Column('streak_days', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('families', sa.Column('last_streak_days', sa.Integer(), nullable=True))
    op.add_column('families', sa.Column('longest_streak_days', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('families', sa.Column('last_activity_date', sa.Date(), nullable=True))
    op.add_column('families', sa.Column('last_frozen_date', sa.Date(), nullable=True))
    # Remove server defaults — columns are managed by the application going forward
    op.alter_column('families', 'streak_days', server_default=None)
    op.alter_column('families', 'longest_streak_days', server_default=None)


def downgrade() -> None:
    op.drop_column('families', 'last_frozen_date')
    op.drop_column('families', 'last_activity_date')
    op.drop_column('families', 'longest_streak_days')
    op.drop_column('families', 'last_streak_days')
    op.drop_column('families', 'streak_days')

    op.add_column('families', sa.Column('streak_weeks', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('families', sa.Column('last_streak_weeks', sa.Integer(), nullable=True))
    op.add_column('families', sa.Column('longest_streak_weeks', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('families', sa.Column('last_activity_iso_week', sa.String(length=10), nullable=True))
    op.add_column('families', sa.Column('last_frozen_iso_week', sa.String(length=10), nullable=True))
    op.alter_column('families', 'streak_weeks', server_default=None)
    op.alter_column('families', 'longest_streak_weeks', server_default=None)
