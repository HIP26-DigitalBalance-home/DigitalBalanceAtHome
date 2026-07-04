"""
Re-link (or seed) the curated collage presets against the activities currently
in the database.

Why this exists
---------------
`collage_presets.activity_ids` is a denormalised snapshot of activity UUIDs.
Whenever the `activities` table is re-created with fresh ids — e.g. after the
"restore activities after a full nuke" SQL in CLAUDE.md, which inserts rows with
new `gen_random_uuid()` values — every preset's `activity_ids` start pointing at
rows that no longer exist. The collage builder then renders empty slots for
preset/random collages, and the challenge can never be created.

This script resolves each preset's nine activities by *title* (matching either
the German `title` or the English `title_en`) and rewrites `activity_ids`, so
presets always point at whatever activities currently exist. It is idempotent:
re-running it against an already-correct database is a no-op.

Run it after any activity re-seed / restore:

    docker compose exec api sh -c "PYTHONPATH=/app python /app/scripts/relink_collage_presets.py"

    # or locally (reads env from server/.env):
    set -a && source server/.env && set +a
    PYTHONPATH=server python server/scripts/relink_collage_presets.py
"""

import asyncio
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.activity import Activity
from app.models.collage_preset import CollagePreset

# Canonical English seed title -> German title, copied verbatim from migration
# c3d4e5f6a7b8. Lets us resolve a preset activity whether the DB currently holds
# activities in English (fresh seed) or German (translated / restored).
EN_TO_DE: dict[str, str] = {
    "Bake cookies together": "Gemeinsam Plätzchen backen",
    "Go to the park": "In den Park gehen",
    "Build a pillow fort": "Eine Kissenburg bauen",
    "Draw and paint together": "Gemeinsam zeichnen und malen",
    "Plant something in a pot": "Etwas in einen Topf pflanzen",
    "Make paper planes": "Papierflieger basteln",
    "Invent a story together": "Gemeinsam eine Geschichte erfinden",
    "Nature walk — find 10 things": "Naturspaziergang – 10 Dinge entdecken",
    "Cook a simple meal together": "Gemeinsam ein Gericht kochen",
    "Play a board game": "Ein Brettspiel spielen",
    "Do a jigsaw puzzle": "Ein Puzzle lösen",
    "Make a paper collage": "Eine Papier-Collage basteln",
    "Visit the library": "Die Bücherei besuchen",
    "Dance to favourite songs": "Zu Lieblingsliedern tanzen",
    "Make homemade playdough": "Selbstgemachte Knete herstellen",
    "Watch clouds and find shapes": "Wolken beobachten und Formen entdecken",
    "Collect leaves and press them": "Blätter sammeln und pressen",
    "Build a snowman": "Einen Schneemann bauen",
    "Make hot chocolate from scratch": "Heiße Schokolade selbst machen",
    "Star gazing in the garden": "Sterne beobachten im Garten",
    "Make a bird feeder": "Ein Vogelhäuschen bauen",
    "Scavenger hunt in the park": "Schnitzeljagd im Park",
    "Shadow puppet theatre": "Schattentheater",
    "Read a chapter book aloud": "Ein Buch gemeinsam vorlesen",
    "Make pancakes for breakfast": "Pfannkuchen zum Frühstück backen",
    "Write a letter to a grandparent": "Einen Brief an die Großeltern schreiben",
    "Prepare a picnic and eat outside": "Ein Picknick vorbereiten und draußen essen",
    "Play catch or frisbee": "Fangen oder Frisbee spielen",
    "Make a family photo album page": "Eine Seite für das Familienalbum gestalten",
    "Teach your child to ride a bike": "Dem Kind Fahrradfahren beibringen",
}

# Canonical preset definitions. Names/descriptions from migrations b2c3d4e5f6a7
# and e5f6a7b8c9d0; activity lists (by English seed title, ordered by grid
# position 0–8) from b2c3d4e5f6a7.
# fmt: off
PRESETS: list[dict] = [
    {
        "name": "Outdoor-Abenteuer",
        "name_en": "Outdoor Adventures",
        "description": "Raus an die frische Luft: neun Aktivitäten für aktive Tage draußen.",
        "description_en": "Get out into the fresh air: nine activities for active days outdoors.",
        "activities": [
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
    },
    {
        "name": "Kreative Familie",
        "name_en": "Creative Family",
        "description": "Basteln, malen, gestalten: neun Ideen für kreative Stunden zu Hause.",
        "description_en": "Craft, paint and create: nine ideas for creative hours at home.",
        "activities": [
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
    },
    {
        "name": "Achtsame Momente",
        "name_en": "Mindful Moments",
        "description": "Ruhige, gemeinsame Momente zum Entschleunigen und Genießen.",
        "description_en": "Quiet moments together to slow down and enjoy.",
        "activities": [
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
    },
    {
        "name": "Gemeinsam in der Küche",
        "name_en": "Together in the Kitchen",
        "description": "Zusammen kochen, backen und naschen: neun Aktivitäten rund ums Essen.",
        "description_en": "Cook, bake and snack together: nine activities all about food.",
        "activities": [
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
    },
    {
        "name": "Regentag-Entdecker",
        "name_en": "Rainy-Day Explorers",
        "description": "Für drinnen, wenn es draußen regnet: neun Ideen gegen Langeweile.",
        "description_en": "For indoors when it rains: nine ideas to beat boredom.",
        "activities": [
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
    },
]
# fmt: on


async def relink() -> int:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    unresolved: list[str] = []
    try:
        async with Session() as session:
            activities = (await session.execute(select(Activity))).scalars().all()
            by_title = {a.title: a.id for a in activities}
            by_title_en = {a.title_en: a.id for a in activities if a.title_en}

            def resolve(en_title: str) -> object | None:
                # Prefer the English title, fall back to the German translation.
                if en_title in by_title_en:
                    return by_title_en[en_title]
                de_title = EN_TO_DE.get(en_title)
                if de_title and de_title in by_title:
                    return by_title[de_title]
                if en_title in by_title:  # DB still holds English titles
                    return by_title[en_title]
                return None

            existing = {p.name: p for p in (await session.execute(select(CollagePreset))).scalars().all()}

            for sort_order, spec in enumerate(PRESETS):
                activity_ids = []
                for en_title in spec["activities"]:
                    aid = resolve(en_title)
                    if aid is None:
                        unresolved.append(f"{spec['name']!r} -> {en_title!r}")
                        continue
                    activity_ids.append(aid)

                if len(activity_ids) != 9:
                    # Don't overwrite a preset with an incomplete list.
                    print(f"⚠  Skipping '{spec['name']}': resolved {len(activity_ids)}/9 activities")
                    continue

                preset = existing.get(spec["name"])
                if preset is None:
                    session.add(
                        CollagePreset(
                            name=spec["name"],
                            name_en=spec["name_en"],
                            description=spec["description"],
                            description_en=spec["description_en"],
                            activity_ids=activity_ids,
                            sort_order=sort_order,
                        )
                    )
                    print(f"✓  Created preset '{spec['name']}' (9 activities)")
                else:
                    preset.activity_ids = activity_ids
                    preset.sort_order = sort_order
                    # Backfill English content if it was lost in a restore.
                    preset.name_en = preset.name_en or spec["name_en"]
                    preset.description_en = preset.description_en or spec["description_en"]
                    print(f"✓  Re-linked preset '{spec['name']}' (9 activities)")

            await session.commit()
    finally:
        await engine.dispose()

    if unresolved:
        print("\n⚠  Could not resolve these preset activities against the DB:")
        for item in unresolved:
            print(f"     {item}")
        print("   (Are the seed activities present? See CLAUDE.md restore step.)")
        return 1
    print("\n✓  All presets re-linked successfully.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(relink()))
