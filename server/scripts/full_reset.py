"""
Full environment reset: wipes all user/demo data, clears S3, restores
the 30 seed activities so POST /dev/seed works immediately after.

Usage (inside Docker Compose — recommended):
    docker compose exec api sh -c "PYTHONPATH=/app python /app/scripts/full_reset.py"

Usage (local, with env vars from server/.env):
    set -a && source server/.env && set +a
    PYTHONPATH=server python server/scripts/full_reset.py

After running, sign in to the app and tap "Load Demo Data" on the Profile screen.
"""

import asyncio
import os
import sys

import boto3
from botocore.config import Config
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.environ.get("DATABASE_URL", "")
S3_ENDPOINT_URL = os.environ.get("S3_ENDPOINT_URL", "")
S3_BUCKET_NAME = os.environ.get("S3_BUCKET_NAME", "")
S3_ACCESS_KEY = os.environ.get("S3_ACCESS_KEY", "")
S3_SECRET_KEY = os.environ.get("S3_SECRET_KEY", "")
S3_REGION = os.environ.get("S3_REGION", "eu-central-1")

if not DATABASE_URL:
    print("❌  DATABASE_URL must be set.")
    sys.exit(1)

ACTIVITIES = [
    ("Gemeinsam Plätzchen backen", "Teig anrühren, ausstechen und verzieren — Kinder können bei jedem Schritt helfen und das Ergebnis genießen.", 60, 3, 12, "free", None, None),
    ("In den Park gehen", "Zum nächsten Spielplatz oder ins Grüne gehen — rennen, entdecken und gemeinsam frische Luft schnappen.", 60, 3, 12, "free", ["spring", "summer", "autumn"], ["sunny", "cloudy"]),
    ("Eine Kissenburg bauen", "Kissen, Decken und Stühle zur besten Burg im Haus aufbauen und dann darin lesen oder spielen.", 45, 3, 8, "free", None, None),
    ("Gemeinsam zeichnen und malen", "Ein Thema aussuchen — Tiere, Superhelden, das eigene Zuhause — und Seite an Seite Kunstwerke schaffen.", 45, 3, 12, "free", None, None),
    ("Etwas in einen Topf pflanzen", "Schnell wachsende Samen wählen (Kresse, Sonnenblumen, Kräuter) und in den nächsten Wochen beim Wachsen zuschauen.", 30, 5, 12, "low_cost", ["spring", "summer"], ["sunny", "cloudy"]),
    ("Papierflieger basteln", "Verschiedene Modelle falten, draußen ausprobieren und schauen, wessen Flieger am weitesten kommt.", 30, 5, 12, "free", None, None),
    ("Gemeinsam eine Geschichte erfinden", "Abwechselnd einen Satz hinzufügen und gemeinsam die verrückteste Geschichte aller Zeiten aufbauen.", 30, 3, 10, "free", None, None),
    ("Naturspaziergang – 10 Dinge entdecken", "Ein Thema festlegen (gelbe Dinge, runde Dinge, Dinge die gut riechen) und gemeinsam auf die Suche gehen.", 60, 3, 12, "free", ["spring", "summer", "autumn"], ["sunny", "cloudy"]),
    ("Gemeinsam ein Gericht kochen", "Das Kind bei einem echten Rezept mitmachen lassen — abmessen, rühren und probieren inklusive.", 60, 6, 12, "free", None, None),
    ("Ein Brettspiel spielen", "Ein Familienfavorit hervorkramen oder ein neues Spiel kennenlernen — richtig ernst nehmen oder absichtlich schlecht spielen.", 60, 5, 12, "free", None, None),
    ("Ein Puzzle lösen", "Gemeinsam an einem Puzzle arbeiten, das etwas zu schwierig ist — die Freude am Ende ist es wert.", 45, 4, 12, "free", None, None),
    ("Eine Papier-Collage basteln", "Alte Zeitschriften, Geschenkpapier oder Buntpapier zerreißen und zu einem Bild zusammenkleben.", 30, 3, 12, "free", None, None),
    ("Die Bücherei besuchen", "Gemeinsam Bücher aussuchen, die Bibliothekarin um eine Empfehlung bitten und gemütlich schmökern.", 90, 3, 12, "free", None, None),
    ("Zu Lieblingsliedern tanzen", "Abwechselnd einen Song aussuchen und tanzen, als würde niemand zuschauen — denn niemand tut es.", 30, 3, 12, "free", None, None),
    ("Selbstgemachte Knete herstellen", "Mehl, Salz, Wasser und Lebensmittelfarbe mischen und stundenlangen Bastelspaß zaubern.", 30, 3, 8, "free", None, None),
    ("Wolken beobachten und Formen entdecken", "Im Gras liegen und laut rufen, was man sieht — Drachen, Gesichter, ein Hund der einen Hut frisst.", 30, 3, 12, "free", ["spring", "summer", "autumn"], ["cloudy", "sunny"]),
    ("Blätter sammeln und pressen", "Die schönsten Herbstblätter sammeln, in einem schweren Buch pressen und dann aufhängen.", 45, 3, 12, "free", ["autumn"], None),
    ("Einen Schneemann bauen", "Klassisches Winterabenteuer — Schneekugeln rollen, einen Schal und eine Karotte, dann ein Foto vor dem Tauen.", 45, 3, 12, "free", ["winter"], None),
    ("Heiße Schokolade selbst machen", "Echte Schokolade schmelzen, Milch langsam erwärmen und etwas Zimt hinzufügen — schlägt Instantpulver jedes Mal.", 20, 3, 12, "free", ["winter", "autumn"], None),
    ("Sterne beobachten im Garten", "Nach Einbruch der Dunkelheit eine Decke nach draußen tragen, Sternbilder suchen und neue erfinden.", 45, 5, 12, "free", ["summer"], ["sunny"]),
    ("Ein Vogelhäuschen bauen", "Einen Tannenzapfen oder eine leere Flasche mit Samen füllen und dort aufhängen, wo man Vögeln beim Fressen zusehen kann.", 45, 5, 12, "low_cost", ["autumn", "winter"], None),
    ("Schnitzeljagd im Park", "Eine Liste mit Dingen zum Finden oder Fotografieren schreiben — eine Feder, etwas Blaues, einen lustig geformten Stein.", 60, 4, 12, "free", ["spring", "summer", "autumn"], ["sunny", "cloudy"]),
    ("Schattentheater", "Mit einer Taschenlampe und den Händen ein Schattenspiel an der Wand oder auf einem Laken aufführen.", 30, 3, 10, "free", None, None),
    ("Ein Buch gemeinsam vorlesen", "Abwechselnd je ein Kapitel aus einem Buch vorlesen, das etwas über dem Niveau des Kindes liegt.", 30, 4, 12, "free", None, None),
    ("Pfannkuchen zum Frühstück backen", "Einfacher Teig, eine heiße Pfanne und Toppings nach Wahl des Kindes — ein garantiertes Wochenend-Highlight.", 30, 3, 12, "free", None, None),
    ("Einen Brief an die Großeltern schreiben", "Ein echter Brief, im Umschlag mit Briefmarke — Großeltern heben sie für immer auf.", 45, 6, 12, "free", None, None),
    ("Ein Picknick vorbereiten und draußen essen", "Gemeinsam Essen einpacken, einen Platz in der Nähe aussuchen und dort essen — draußen schmeckt alles besser.", 90, 3, 12, "free", ["spring", "summer", "autumn"], ["sunny"]),
    ("Fangen oder Frisbee spielen", "Kein Zubehör außer einem Ball oder einem Frisbee — ein einfaches Spiel, das trotzdem alle zum Lachen bringt.", 30, 4, 12, "free", ["spring", "summer", "autumn"], ["sunny", "cloudy"]),
    ("Eine Seite für das Familienalbum gestalten", "Fotos aus einer schönen Erinnerung ausdrucken oder zeichnen und eine Seite für das Familienalbum dekorieren.", 45, 4, 12, "low_cost", None, None),
    ("Dem Kind Fahrradfahren beibringen", "Geduldig, beständig, ein aufgeschürftes Knie — dann der Moment, in dem es alleine klappt. Jede Minute wert.", 60, 4, 10, "free", ["spring", "summer", "autumn"], ["sunny", "cloudy"]),
]


def _clear_s3() -> int:
    if not S3_ENDPOINT_URL or not S3_BUCKET_NAME:
        print("⚠  S3 not configured — skipping object storage wipe.")
        return 0
    client = boto3.client(
        "s3",
        endpoint_url=S3_ENDPOINT_URL,
        aws_access_key_id=S3_ACCESS_KEY,
        aws_secret_access_key=S3_SECRET_KEY,
        region_name=S3_REGION,
        config=Config(signature_version="s3v4"),
    )
    paginator = client.get_paginator("list_objects_v2")
    to_delete = []
    for page in paginator.paginate(Bucket=S3_BUCKET_NAME):
        for obj in page.get("Contents", []):
            to_delete.append({"Key": obj["Key"]})
    if not to_delete:
        return 0
    for i in range(0, len(to_delete), 1000):
        client.delete_objects(
            Bucket=S3_BUCKET_NAME,
            Delete={"Objects": to_delete[i : i + 1000], "Quiet": True},
        )
    return len(to_delete)


async def _reset_db() -> None:
    engine = create_async_engine(DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        # Wipe all user/demo data in dependency order
        for table in [
            "completions", "challenge_activities", "challenges",
            "group_admins", "group_memberships", "groups",
            "child_profiles", "family_memberships", "families",
            "consent_records", "users", "activities",
        ]:
            result = await conn.execute(text(f"DELETE FROM {table}"))
            print(f"  deleted {result.rowcount:>4} rows from {table}")

        # Re-insert the 30 seed activities
        for row in ACTIVITIES:
            title, desc, duration, age_min, age_max, cost, seasons, weather = row
            await conn.execute(
                text("""
                    INSERT INTO activities
                      (title, description, estimated_duration_minutes,
                       age_min, age_max, cost_indicator,
                       season_relevance, weather_suitability,
                       is_partner_content, language)
                    VALUES
                      (:title, :desc, :duration,
                       :age_min, :age_max, :cost,
                       :seasons, :weather,
                       false, 'de')
                """),
                {
                    "title": title, "desc": desc, "duration": duration,
                    "age_min": age_min, "age_max": age_max, "cost": cost,
                    "seasons": seasons, "weather": weather,
                },
            )
        print(f"  inserted  {len(ACTIVITIES):>4} activities")


async def main() -> None:
    print(f"Database : {DATABASE_URL.split('@')[-1]}")
    print(f"S3 bucket: {S3_BUCKET_NAME or '(not configured)'}")
    print()

    print("── Clearing S3 ────────────────────────────────")
    deleted = _clear_s3()
    print(f"  deleted {deleted} object(s)")

    print()
    print("── Resetting database ─────────────────────────")
    await _reset_db()

    print()
    print("✅  Reset complete.")
    print("   Sign in to the app and tap 'Load Demo Data' on the Profile screen.")


if __name__ == "__main__":
    asyncio.run(main())
