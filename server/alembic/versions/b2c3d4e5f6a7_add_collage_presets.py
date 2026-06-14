"""add collage_presets table with seed data

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-14

"""

from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Each preset references nine activities by their (verbatim) seed title, ordered
# by grid position 0–8. Titles are resolved to UUIDs at migration time, since
# activity ids are generated with gen_random_uuid() and are not stable.
# fmt: off
SEED_PRESETS = [
    (
        "Outdoor-Abenteuer",
        "Raus an die frische Luft: neun Aktivitäten für aktive Tage draußen.",
        [
            "Go to the park",
            "Nature walk — find 10 things",
            "Scavenger hunt in the park",
            "Prepare a picnic and eat outside",
            "Play catch or frisbee",
            "Teach your child to ride a bike",
            "Star gazing in the garden",
            "Watch clouds and find shapes",
            "Make paper planes",
        ],
    ),
    (
        "Kreative Familie",
        "Basteln, malen, gestalten: neun Ideen für kreative Stunden zu Hause.",
        [
            "Draw and paint together",
            "Make a paper collage",
            "Make homemade playdough",
            "Make a family photo album page",
            "Invent a story together",
            "Shadow puppet theatre",
            "Make paper planes",
            "Make a bird feeder",
            "Write a letter to a grandparent",
        ],
    ),
    (
        "Achtsame Momente",
        "Ruhige, gemeinsame Momente zum Entschleunigen und Genießen.",
        [
            "Read a chapter book aloud",
            "Visit the library",
            "Watch clouds and find shapes",
            "Star gazing in the garden",
            "Invent a story together",
            "Nature walk — find 10 things",
            "Write a letter to a grandparent",
            "Dance to favourite songs",
            "Collect leaves and press them",
        ],
    ),
    (
        "Gemeinsam in der Küche",
        "Zusammen kochen, backen und naschen: neun Aktivitäten rund ums Essen.",
        [
            "Bake cookies together",
            "Cook a simple meal together",
            "Make pancakes for breakfast",
            "Make hot chocolate from scratch",
            "Prepare a picnic and eat outside",
            "Play a board game",
            "Do a jigsaw puzzle",
            "Make homemade playdough",
            "Draw and paint together",
        ],
    ),
    (
        "Regentag-Entdecker",
        "Für drinnen, wenn es draußen regnet: neun Ideen gegen Langeweile.",
        [
            "Build a pillow fort",
            "Play a board game",
            "Do a jigsaw puzzle",
            "Make homemade playdough",
            "Shadow puppet theatre",
            "Make a paper collage",
            "Read a chapter book aloud",
            "Invent a story together",
            "Make hot chocolate from scratch",
        ],
    ),
]
# fmt: on


def upgrade() -> None:
    presets_table = op.create_table(
        "collage_presets",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("activity_ids", postgresql.ARRAY(postgresql.UUID(as_uuid=True)), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, title FROM activities")).fetchall()
    title_to_id = {title: activity_id for activity_id, title in rows}

    seed_rows = []
    for sort_order, (name, description, titles) in enumerate(SEED_PRESETS):
        assert len(titles) == 9, f"Preset '{name}' must reference exactly 9 activities, got {len(titles)}"
        activity_ids = []
        for title in titles:
            activity_id = title_to_id.get(title)
            assert activity_id is not None, f"Preset '{name}' references unknown activity title: {title!r}"
            activity_ids.append(activity_id)
        seed_rows.append(
            {
                "name": name,
                "description": description,
                "activity_ids": activity_ids,
                "sort_order": sort_order,
            }
        )

    op.bulk_insert(presets_table, seed_rows)


def downgrade() -> None:
    op.drop_table("collage_presets")
