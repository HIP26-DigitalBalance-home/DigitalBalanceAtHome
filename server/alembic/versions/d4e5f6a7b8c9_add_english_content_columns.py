"""add English content columns and backfill curated activities

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-06-16

Adds nullable title_en / description_en columns to activities and challenges so
curated content can be served in English via Accept-Language negotiation.
Backfills the 30 curated activities (matched on their German title) with the
English text that already lives in migration c3d4e5f6a7b8. User-created content
keeps NULL English columns and falls back to its base title/description.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# fmt: off
# (german_title, english_title, english_description) — german_title matches the
# current activities.title for the curated seed (set by migration c3d4e5f6a7b8).
BACKFILL: list[tuple[str, str, str]] = [
    ("Gemeinsam Plätzchen backen", "Bake cookies together",
     "Mix, roll and decorate biscuits or cookies — children can help with every step and eat the result."),
    ("In den Park gehen", "Go to the park",
     "Head to the nearest playground or green space — run, explore, and enjoy fresh air together."),
    ("Eine Kissenburg bauen", "Build a pillow fort",
     "Use cushions, blankets and chairs to construct the best fort in the house, then read or play inside it."),
    ("Gemeinsam zeichnen und malen", "Draw and paint together",
     "Pick any subject — animals, superheroes, your home — and create art side by side."),
    ("Etwas in einen Topf pflanzen", "Plant something in a pot",
     "Choose a fast-growing seed (cress, sunflowers, herbs) and watch it grow over the coming weeks."),
    ("Papierflieger basteln", "Make paper planes",
     "Fold different designs, test them outdoors and see whose plane flies furthest."),
    ("Gemeinsam eine Geschichte erfinden", "Invent a story together",
     "Take turns adding one sentence at a time to build the most absurd story imaginable."),
    ("Naturspaziergang – 10 Dinge entdecken", "Nature walk — find 10 things",
     "Pick a theme (yellow things, round things, things that smell nice) and hunt for them together."),
    ("Gemeinsam ein Gericht kochen", "Cook a simple meal together",
     "Let your child help with a real recipe — measuring, stirring, and tasting included."),
    ("Ein Brettspiel spielen", "Play a board game",
     "Dig out a family favourite or learn a new one — take it seriously or play deliberately badly."),
    ("Ein Puzzle lösen", "Do a jigsaw puzzle",
     "Work together on a puzzle that is slightly too hard — the satisfaction is worth it."),
    ("Eine Papier-Collage basteln", "Make a paper collage",
     "Tear up old magazines, wrapping paper or coloured paper and stick them into a picture."),
    ("Die Bücherei besuchen", "Visit the library",
     "Choose books together, ask the librarian for a recommendation and settle in for a quiet read."),
    ("Zu Lieblingsliedern tanzen", "Dance to favourite songs",
     "Take turns picking a song, then dance as if no one is watching — because no one is."),
    ("Selbstgemachte Knete herstellen", "Make homemade playdough",
     "Combine flour, salt, water and food colouring for hours of sculpting fun."),
    ("Wolken beobachten und Formen entdecken", "Watch clouds and find shapes",
     "Lie on the grass and call out what you see — dragons, faces, a dog eating a hat."),
    ("Blätter sammeln und pressen", "Collect leaves and press them",
     "Find the most interesting autumn leaves, press them inside a heavy book, then display them."),
    ("Einen Schneemann bauen", "Build a snowman",
     "Classic winter activity — rolls of snow, a scarf and a carrot, then a photo before it melts."),
    ("Heiße Schokolade selbst machen", "Make hot chocolate from scratch",
     "Melt real chocolate, warm milk slowly and add a little cinnamon — beats a packet every time."),
    ("Sterne beobachten im Garten", "Star gazing in the garden",
     "Take a blanket outside after dark, find constellations and make up new ones."),
    ("Ein Vogelhäuschen bauen", "Make a bird feeder",
     "Fill a pine cone or empty bottle with seeds and hang it where you can watch birds feed."),
    ("Schnitzeljagd im Park", "Scavenger hunt in the park",
     "Write a list of things to find or photograph — a feather, something blue, a funny-shaped stone."),
    ("Schattentheater", "Shadow puppet theatre",
     "Use a torch and your hands to put on a shadow show against the wall or a sheet."),
    ("Ein Buch gemeinsam vorlesen", "Read a chapter book aloud",
     "Take turns reading a chapter each from a book that is just beyond your child's current level."),
    ("Pfannkuchen zum Frühstück backen", "Make pancakes for breakfast",
     "Simple batter, a hot pan and toppings your child chooses — a guaranteed weekend highlight."),
    ("Einen Brief an die Großeltern schreiben", "Write a letter to a grandparent",
     "A real letter, in an envelope with a stamp — grandparents keep them for ever."),
    ("Ein Picknick vorbereiten und draußen essen", "Prepare a picnic and eat outside",
     "Pack food together, choose a spot nearby and eat it there — anything tastes better outside."),
    ("Fangen oder Frisbee spielen", "Play catch or frisbee",
     "No equipment needed beyond a ball or a frisbee — a simple game that still makes everyone smile."),
    ("Eine Seite für das Familienalbum gestalten", "Make a family photo album page",
     "Print or draw pictures from a recent memory and decorate a page for a family scrapbook."),
    ("Dem Kind Fahrradfahren beibringen", "Teach your child to ride a bike",
     "Patient, steady, a scraped knee — then the moment they do it alone. Worth every minute."),
]
# fmt: on


def upgrade() -> None:
    op.add_column("activities", sa.Column("title_en", sa.String(), nullable=True))
    op.add_column("activities", sa.Column("description_en", sa.String(), nullable=True))
    op.add_column("challenges", sa.Column("title_en", sa.String(), nullable=True))
    op.add_column("challenges", sa.Column("description_en", sa.String(), nullable=True))

    conn = op.get_bind()
    for de_title, en_title, en_desc in BACKFILL:
        conn.execute(
            sa.text(
                "UPDATE activities SET title_en = :en_title, description_en = :en_desc "
                "WHERE title = :de_title AND family_id IS NULL"
            ),
            {"en_title": en_title, "en_desc": en_desc, "de_title": de_title},
        )


def downgrade() -> None:
    op.drop_column("challenges", "description_en")
    op.drop_column("challenges", "title_en")
    op.drop_column("activities", "description_en")
    op.drop_column("activities", "title_en")
