"""add activities table with seed data

Revision ID: 083b99406853
Revises: 696ba745d257
Create Date: 2026-05-29

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "083b99406853"
down_revision: Union[str, None] = "696ba745d257"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# fmt: off
SEED_ACTIVITIES = [
    # (title, description, duration_min, age_min, age_max, cost, seasons, weather)
    ("Bake cookies together", "Mix, roll and decorate biscuits or cookies — children can help with every step and eat the result.", 60, 3, 12, "free", None, None),
    ("Go to the park", "Head to the nearest playground or green space — run, explore, and enjoy fresh air together.", 60, 3, 12, "free", ["spring","summer","autumn"], ["sunny","cloudy"]),
    ("Build a pillow fort", "Use cushions, blankets and chairs to construct the best fort in the house, then read or play inside it.", 45, 3, 8, "free", None, None),
    ("Draw and paint together", "Pick any subject — animals, superheroes, your home — and create art side by side.", 45, 3, 12, "free", None, None),
    ("Plant something in a pot", "Choose a fast-growing seed (cress, sunflowers, herbs) and watch it grow over the coming weeks.", 30, 5, 12, "low_cost", ["spring","summer"], ["sunny","cloudy"]),
    ("Make paper planes", "Fold different designs, test them outdoors and see whose plane flies furthest.", 30, 5, 12, "free", None, None),
    ("Invent a story together", "Take turns adding one sentence at a time to build the most absurd story imaginable.", 30, 3, 10, "free", None, None),
    ("Nature walk — find 10 things", "Pick a theme (yellow things, round things, things that smell nice) and hunt for them together.", 60, 3, 12, "free", ["spring","summer","autumn"], ["sunny","cloudy"]),
    ("Cook a simple meal together", "Let your child help with a real recipe — measuring, stirring, and tasting included.", 60, 6, 12, "free", None, None),
    ("Play a board game", "Dig out a family favourite or learn a new one — take it seriously or play deliberately badly.", 60, 5, 12, "free", None, None),
    ("Do a jigsaw puzzle", "Work together on a puzzle that is slightly too hard — the satisfaction is worth it.", 45, 4, 12, "free", None, None),
    ("Make a paper collage", "Tear up old magazines, wrapping paper or coloured paper and stick them into a picture.", 30, 3, 12, "free", None, None),
    ("Visit the library", "Choose books together, ask the librarian for a recommendation and settle in for a quiet read.", 90, 3, 12, "free", None, None),
    ("Dance to favourite songs", "Take turns picking a song, then dance as if no one is watching — because no one is.", 30, 3, 12, "free", None, None),
    ("Make homemade playdough", "Combine flour, salt, water and food colouring for hours of sculpting fun.", 30, 3, 8, "free", None, None),
    ("Watch clouds and find shapes", "Lie on the grass and call out what you see — dragons, faces, a dog eating a hat.", 30, 3, 12, "free", ["spring","summer","autumn"], ["cloudy","sunny"]),
    ("Collect leaves and press them", "Find the most interesting autumn leaves, press them inside a heavy book, then display them.", 45, 3, 12, "free", ["autumn"], None),
    ("Build a snowman", "Classic winter activity — rolls of snow, a scarf and a carrot, then a photo before it melts.", 45, 3, 12, "free", ["winter"], None),
    ("Make hot chocolate from scratch", "Melt real chocolate, warm milk slowly and add a little cinnamon — beats a packet every time.", 20, 3, 12, "free", ["winter","autumn"], None),
    ("Star gazing in the garden", "Take a blanket outside after dark, find constellations and make up new ones.", 45, 5, 12, "free", ["summer"], ["sunny"]),
    ("Make a bird feeder", "Fill a pine cone or empty bottle with seeds and hang it where you can watch birds feed.", 45, 5, 12, "low_cost", ["autumn","winter"], None),
    ("Scavenger hunt in the park", "Write a list of things to find or photograph — a feather, something blue, a funny-shaped stone.", 60, 4, 12, "free", ["spring","summer","autumn"], ["sunny","cloudy"]),
    ("Shadow puppet theatre", "Use a torch and your hands to put on a shadow show against the wall or a sheet.", 30, 3, 10, "free", None, None),
    ("Read a chapter book aloud", "Take turns reading a chapter each from a book that is just beyond your child's current level.", 30, 4, 12, "free", None, None),
    ("Make pancakes for breakfast", "Simple batter, a hot pan and toppings your child chooses — a guaranteed weekend highlight.", 30, 3, 12, "free", None, None),
    ("Write a letter to a grandparent", "A real letter, in an envelope with a stamp — grandparents keep them for ever.", 45, 6, 12, "free", None, None),
    ("Prepare a picnic and eat outside", "Pack food together, choose a spot nearby and eat it there — anything tastes better outside.", 90, 3, 12, "free", ["spring","summer","autumn"], ["sunny"]),
    ("Play catch or frisbee", "No equipment needed beyond a ball or a frisbee — a simple game that still makes everyone smile.", 30, 4, 12, "free", ["spring","summer","autumn"], ["sunny","cloudy"]),
    ("Make a family photo album page", "Print or draw pictures from a recent memory and decorate a page for a family scrapbook.", 45, 4, 12, "low_cost", None, None),
    ("Teach your child to ride a bike", "Patient, steady, a scraped knee — then the moment they do it alone. Worth every minute.", 60, 4, 10, "free", ["spring","summer","autumn"], ["sunny","cloudy"]),
]
# fmt: on


def upgrade() -> None:
    activities_table = op.create_table(
        "activities",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("estimated_duration_minutes", sa.Integer(), nullable=False),
        sa.Column("age_min", sa.Integer(), nullable=False),
        sa.Column("age_max", sa.Integer(), nullable=False),
        sa.Column("cost_indicator", sa.String(), nullable=False),
        sa.Column("season_relevance", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("weather_suitability", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("is_partner_content", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    op.bulk_insert(
        activities_table,
        [
            {
                "title": title,
                "description": description,
                "estimated_duration_minutes": duration,
                "age_min": age_min,
                "age_max": age_max,
                "cost_indicator": cost,
                "season_relevance": seasons,
                "weather_suitability": weather,
                "is_partner_content": False,
            }
            for title, description, duration, age_min, age_max, cost, seasons, weather
            in SEED_ACTIVITIES
        ],
    )


def downgrade() -> None:
    op.drop_table("activities")
