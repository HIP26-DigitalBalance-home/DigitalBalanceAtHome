"""add language columns and translate seed activities to German

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-14

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# fmt: off
# Maps each English seed title to (german_title, german_description).
# Downgrade restores English originals.
TRANSLATIONS: list[tuple[str, str, str, str]] = [
    (
        "Bake cookies together",
        "Gemeinsam Plätzchen backen",
        "Mix, roll and decorate biscuits or cookies — children can help with every step and eat the result.",
        "Teig anrühren, ausstechen und verzieren — Kinder können bei jedem Schritt helfen und das Ergebnis genießen.",
    ),
    (
        "Go to the park",
        "In den Park gehen",
        "Head to the nearest playground or green space — run, explore, and enjoy fresh air together.",
        "Zum nächsten Spielplatz oder ins Grüne gehen — rennen, entdecken und gemeinsam frische Luft schnappen.",
    ),
    (
        "Build a pillow fort",
        "Eine Kissenburg bauen",
        "Use cushions, blankets and chairs to construct the best fort in the house, then read or play inside it.",
        "Kissen, Decken und Stühle zur besten Burg im Haus aufbauen und dann darin lesen oder spielen.",
    ),
    (
        "Draw and paint together",
        "Gemeinsam zeichnen und malen",
        "Pick any subject — animals, superheroes, your home — and create art side by side.",
        "Ein Thema aussuchen — Tiere, Superhelden, das eigene Zuhause — und Seite an Seite Kunstwerke schaffen.",
    ),
    (
        "Plant something in a pot",
        "Etwas in einen Topf pflanzen",
        "Choose a fast-growing seed (cress, sunflowers, herbs) and watch it grow over the coming weeks.",
        "Schnell wachsende Samen wählen (Kresse, Sonnenblumen, Kräuter) und in den nächsten Wochen beim Wachsen zuschauen.",  # noqa: E501
    ),
    (
        "Make paper planes",
        "Papierflieger basteln",
        "Fold different designs, test them outdoors and see whose plane flies furthest.",
        "Verschiedene Modelle falten, draußen ausprobieren und schauen, wessen Flieger am weitesten kommt.",
    ),
    (
        "Invent a story together",
        "Gemeinsam eine Geschichte erfinden",
        "Take turns adding one sentence at a time to build the most absurd story imaginable.",
        "Abwechselnd einen Satz hinzufügen und gemeinsam die verrückteste Geschichte aller Zeiten aufbauen.",
    ),
    (
        "Nature walk — find 10 things",
        "Naturspaziergang – 10 Dinge entdecken",
        "Pick a theme (yellow things, round things, things that smell nice) and hunt for them together.",
        "Ein Thema festlegen (gelbe Dinge, runde Dinge, Dinge die gut riechen) und gemeinsam auf die Suche gehen.",
    ),
    (
        "Cook a simple meal together",
        "Gemeinsam ein Gericht kochen",
        "Let your child help with a real recipe — measuring, stirring, and tasting included.",
        "Das Kind bei einem echten Rezept mitmachen lassen — abmessen, rühren und probieren inklusive.",
    ),
    (
        "Play a board game",
        "Ein Brettspiel spielen",
        "Dig out a family favourite or learn a new one — take it seriously or play deliberately badly.",
        "Ein Familienfavorit hervorkramen oder ein neues Spiel kennenlernen — richtig ernst nehmen oder absichtlich schlecht spielen.",  # noqa: E501
    ),
    (
        "Do a jigsaw puzzle",
        "Ein Puzzle lösen",
        "Work together on a puzzle that is slightly too hard — the satisfaction is worth it.",
        "Gemeinsam an einem Puzzle arbeiten, das etwas zu schwierig ist — die Freude am Ende ist es wert.",
    ),
    (
        "Make a paper collage",
        "Eine Papier-Collage basteln",
        "Tear up old magazines, wrapping paper or coloured paper and stick them into a picture.",
        "Alte Zeitschriften, Geschenkpapier oder Buntpapier zerreißen und zu einem Bild zusammenkleben.",
    ),
    (
        "Visit the library",
        "Die Bücherei besuchen",
        "Choose books together, ask the librarian for a recommendation and settle in for a quiet read.",
        "Gemeinsam Bücher aussuchen, die Bibliothekarin um eine Empfehlung bitten und gemütlich schmökern.",
    ),
    (
        "Dance to favourite songs",
        "Zu Lieblingsliedern tanzen",
        "Take turns picking a song, then dance as if no one is watching — because no one is.",
        "Abwechselnd einen Song aussuchen und tanzen, als würde niemand zuschauen — denn niemand tut es.",
    ),
    (
        "Make homemade playdough",
        "Selbstgemachte Knete herstellen",
        "Combine flour, salt, water and food colouring for hours of sculpting fun.",
        "Mehl, Salz, Wasser und Lebensmittelfarbe mischen und stundenlangen Bastelspaß zaubern.",
    ),
    (
        "Watch clouds and find shapes",
        "Wolken beobachten und Formen entdecken",
        "Lie on the grass and call out what you see — dragons, faces, a dog eating a hat.",
        "Im Gras liegen und laut rufen, was man sieht — Drachen, Gesichter, ein Hund der einen Hut frisst.",
    ),
    (
        "Collect leaves and press them",
        "Blätter sammeln und pressen",
        "Find the most interesting autumn leaves, press them inside a heavy book, then display them.",
        "Die schönsten Herbstblätter sammeln, in einem schweren Buch pressen und dann aufhängen.",
    ),
    (
        "Build a snowman",
        "Einen Schneemann bauen",
        "Classic winter activity — rolls of snow, a scarf and a carrot, then a photo before it melts.",
        "Klassisches Winterabenteuer — Schneekugeln rollen, einen Schal und eine Karotte, dann ein Foto vor dem Tauen.",
    ),
    (
        "Make hot chocolate from scratch",
        "Heiße Schokolade selbst machen",
        "Melt real chocolate, warm milk slowly and add a little cinnamon — beats a packet every time.",
        "Echte Schokolade schmelzen, Milch langsam erwärmen und etwas Zimt hinzufügen — schlägt Instantpulver jedes Mal.",  # noqa: E501
    ),
    (
        "Star gazing in the garden",
        "Sterne beobachten im Garten",
        "Take a blanket outside after dark, find constellations and make up new ones.",
        "Nach Einbruch der Dunkelheit eine Decke nach draußen tragen, Sternbilder suchen und neue erfinden.",
    ),
    (
        "Make a bird feeder",
        "Ein Vogelhäuschen bauen",
        "Fill a pine cone or empty bottle with seeds and hang it where you can watch birds feed.",
        "Einen Tannenzapfen oder eine leere Flasche mit Samen füllen und dort aufhängen, wo man Vögeln beim Fressen zusehen kann.",  # noqa: E501
    ),
    (
        "Scavenger hunt in the park",
        "Schnitzeljagd im Park",
        "Write a list of things to find or photograph — a feather, something blue, a funny-shaped stone.",
        "Eine Liste mit Dingen zum Finden oder Fotografieren schreiben — eine Feder, etwas Blaues, einen lustig geformten Stein.",  # noqa: E501
    ),
    (
        "Shadow puppet theatre",
        "Schattentheater",
        "Use a torch and your hands to put on a shadow show against the wall or a sheet.",
        "Mit einer Taschenlampe und den Händen ein Schattenspiel an der Wand oder auf einem Laken aufführen.",
    ),
    (
        "Read a chapter book aloud",
        "Ein Buch gemeinsam vorlesen",
        "Take turns reading a chapter each from a book that is just beyond your child's current level.",
        "Abwechselnd je ein Kapitel aus einem Buch vorlesen, das etwas über dem Niveau des Kindes liegt.",
    ),
    (
        "Make pancakes for breakfast",
        "Pfannkuchen zum Frühstück backen",
        "Simple batter, a hot pan and toppings your child chooses — a guaranteed weekend highlight.",
        "Einfacher Teig, eine heiße Pfanne und Toppings nach Wahl des Kindes — ein garantiertes Wochenend-Highlight.",
    ),
    (
        "Write a letter to a grandparent",
        "Einen Brief an die Großeltern schreiben",
        "A real letter, in an envelope with a stamp — grandparents keep them for ever.",
        "Ein echter Brief, im Umschlag mit Briefmarke — Großeltern heben sie für immer auf.",
    ),
    (
        "Prepare a picnic and eat outside",
        "Ein Picknick vorbereiten und draußen essen",
        "Pack food together, choose a spot nearby and eat it there — anything tastes better outside.",
        "Gemeinsam Essen einpacken, einen Platz in der Nähe aussuchen und dort essen — draußen schmeckt alles besser.",
    ),
    (
        "Play catch or frisbee",
        "Fangen oder Frisbee spielen",
        "No equipment needed beyond a ball or a frisbee — a simple game that still makes everyone smile.",
        "Kein Zubehör außer einem Ball oder einem Frisbee — ein einfaches Spiel, das trotzdem alle zum Lachen bringt.",
    ),
    (
        "Make a family photo album page",
        "Eine Seite für das Familienalbum gestalten",
        "Print or draw pictures from a recent memory and decorate a page for a family scrapbook.",
        "Fotos aus einer schönen Erinnerung ausdrucken oder zeichnen und eine Seite für das Familienalbum dekorieren.",
    ),
    (
        "Teach your child to ride a bike",
        "Dem Kind Fahrradfahren beibringen",
        "Patient, steady, a scraped knee — then the moment they do it alone. Worth every minute.",
        "Geduldig, beständig, ein aufgeschürftes Knie — dann der Moment, in dem es alleine klappt. Jede Minute wert.",
    ),
]
# fmt: on


def upgrade() -> None:
    op.add_column("users", sa.Column("preferred_language", sa.String(10), nullable=False, server_default="de"))
    op.add_column("activities", sa.Column("language", sa.String(10), nullable=False, server_default="de"))

    conn = op.get_bind()
    for en_title, de_title, _en_desc, de_desc in TRANSLATIONS:
        conn.execute(
            sa.text("UPDATE activities SET title = :de_title, description = :de_desc WHERE title = :en_title"),
            {"de_title": de_title, "de_desc": de_desc, "en_title": en_title},
        )


def downgrade() -> None:
    conn = op.get_bind()
    for en_title, de_title, en_desc, _de_desc in TRANSLATIONS:
        conn.execute(
            sa.text("UPDATE activities SET title = :en_title, description = :en_desc WHERE title = :de_title"),
            {"en_title": en_title, "en_desc": en_desc, "de_title": de_title},
        )

    op.drop_column("activities", "language")
    op.drop_column("users", "preferred_language")
