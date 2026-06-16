"""add English columns to collage presets and backfill

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-06-16

Adds nullable name_en / description_en to collage_presets and backfills the five
curated presets (matched on their German name) with English translations.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# fmt: off
# (german_name, english_name, english_description) — german_name matches the
# current collage_presets.name set by migration b2c3d4e5f6a7.
BACKFILL: list[tuple[str, str, str]] = [
    ("Outdoor-Abenteuer", "Outdoor Adventures",
     "Get out into the fresh air: nine activities for active days outdoors."),
    ("Kreative Familie", "Creative Family",
     "Craft, paint and create: nine ideas for creative hours at home."),
    ("Achtsame Momente", "Mindful Moments",
     "Quiet moments together to slow down and enjoy."),
    ("Gemeinsam in der Küche", "Together in the Kitchen",
     "Cook, bake and snack together: nine activities all about food."),
    ("Regentag-Entdecker", "Rainy-Day Explorers",
     "For indoors when it rains: nine ideas to beat boredom."),
]
# fmt: on


def upgrade() -> None:
    op.add_column("collage_presets", sa.Column("name_en", sa.String(), nullable=True))
    op.add_column("collage_presets", sa.Column("description_en", sa.String(), nullable=True))

    conn = op.get_bind()
    for de_name, en_name, en_desc in BACKFILL:
        conn.execute(
            sa.text(
                "UPDATE collage_presets SET name_en = :en_name, description_en = :en_desc WHERE name = :de_name"
            ),
            {"en_name": en_name, "en_desc": en_desc, "de_name": de_name},
        )


def downgrade() -> None:
    op.drop_column("collage_presets", "description_en")
    op.drop_column("collage_presets", "name_en")
