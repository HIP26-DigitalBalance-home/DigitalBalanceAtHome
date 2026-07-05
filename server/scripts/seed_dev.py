"""
Development seed script.

Run AFTER signing in at least once so your User record exists:

    docker compose exec api sh -c "PYTHONPATH=/app python /app/scripts/seed_dev.py"

Creates:
  - A "3B Class Parents" group with your account as admin
  - 4 mock families (with display names) added to the group
  - Your family is the creator/admin family
  - 3 mock challenges: one active group, one upcoming personal, one completed group
  - 8 photo completions uploaded to S3 (requires S3 to be configured)

Your email is detected from the SEED_ADMIN_EMAIL env var (default: ignacio.garcian15@gmail.com).
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import boto3
from botocore.config import Config
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.activity import Activity
from app.models.challenge import Challenge, ChallengeActivity
from app.models.child_profile import ChildProfile
from app.models.completion import Completion
from app.models.consent import ConsentRecord
from app.models.family import Family, FamilyMembership
from app.models.group import Group, GroupAdmin, GroupMembership
from app.models.rewards import PhotoVerification, PointLedgerEntry
from app.models.user import User
from app.services.points import compute_points

ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "ignacio.garcian15@gmail.com")

_SEED_PHOTOS_DIR = Path(__file__).parent / "seed_photos"

_ACTIVITY_PHOTO_MAP: list[tuple[str, str | None]] = [
    # Baking
    ("plätzchen", "baking.jpg"),  # Gemeinsam Plätzchen backen
    ("pfannkuchen", "baking.jpg"),  # Pfannkuchen zum Frühstück backen
    ("schokolade", "baking.jpg"),  # Heiße Schokolade selbst machen
    ("backen", "baking.jpg"),
    # Cooking
    ("kochen", "cooking.jpg"),
    # Park / outdoor
    ("schnitzeljagd", "park.jpg"),
    ("naturspaziergang", "park.jpg"),
    ("fangen", "park.jpg"),
    ("frisbee", "park.jpg"),
    ("schneemann", "park.jpg"),
    ("sterne", "park.jpg"),
    ("wolken", "park.jpg"),
    ("fahrrad", "park.jpg"),
    ("park", "park.jpg"),
    # Fort
    ("kissenburg", "fort.jpg"),
    # Drawing / crafts
    ("zeichnen", "drawing.jpg"),
    ("malen", "drawing.jpg"),
    ("collage", "drawing.jpg"),
    ("papierflieger", "planes.jpg"),  # Papierflieger basteln
    # Planting
    ("pflanzen", "planting.jpg"),
    ("vogelhäuschen", "planting.jpg"),
    # Library / reading
    ("bücherei", "library.jpg"),
    ("buch", "library.jpg"),
    # Storytelling / shadow puppets
    ("geschichte", "storytelling.jpg"),
    ("schattentheater", "storytelling.jpg"),
    # Playdough
    ("knete", "playdough.jpg"),
    # Board games
    ("brettspiel", "board_game.jpg"),
    ("puzzle", "board_game.jpg"),
    # Picnic
    ("picknick", "picnic.jpg"),
]


def _photo_for_activity(title: str) -> str | None:
    lower = title.lower()
    for keyword, filename in _ACTIVITY_PHOTO_MAP:
        if keyword in lower:
            return filename
    return None


MOCK_FAMILIES = [
    {
        "family_name": "Schmidt Family",
        "parents": [
            {"display_name": "Maria Schmidt", "email": "maria.schmidt@example.com"},
            {"display_name": "Thomas Schmidt", "email": "thomas.schmidt@example.com"},
        ],
    },
    {
        "family_name": "Müller Family",
        "parents": [
            {"display_name": "Anna Müller", "email": "anna.mueller@example.com"},
        ],
    },
    {
        "family_name": "Bauer Family",
        "parents": [
            {"display_name": "Klaus Bauer", "email": "k.bauer@example.com"},
            {"display_name": "Sabine Bauer", "email": "s.bauer@example.com"},
        ],
    },
    {
        "family_name": "Koch Family",
        "parents": [
            {"display_name": "Lisa Koch", "email": "lisa.koch@example.com"},
        ],
    },
]


def _upload_seed_photo(family_id: uuid.UUID, filename: str) -> str | None:
    """Upload a bundled seed photo to S3. Returns photo_key, or None if storage is unavailable."""
    if not settings.S3_ENDPOINT_URL or not settings.S3_BUCKET_NAME:
        return None
    photo_path = _SEED_PHOTOS_DIR / filename
    if not photo_path.exists():
        return None
    try:
        client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version="s3v4"),
        )
        data = photo_path.read_bytes()
        key = f"photos/{family_id}/{uuid.uuid4()}.jpg"
        client.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=key,
            Body=data,
            ContentType="image/jpeg",
        )
        return key
    except Exception as e:
        print(f"  ⚠  Photo upload failed ({filename}): {e}")
        return None


async def seed():
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    async with Session() as session:
        # ── Find the admin user ─────────────────────────────────────────────
        result = await session.execute(select(User).where(User.email == ADMIN_EMAIL))
        admin_user = result.scalar_one_or_none()
        if admin_user is None:
            print(f"❌  User with email {ADMIN_EMAIL} not found.")
            print("   Sign in to the app first, then re-run this script.")
            return

        print(f"✓  Found admin user: {admin_user.display_name} ({admin_user.email})")

        # ── Ensure admin has a family ────────────────────────────────────────
        result = await session.execute(select(FamilyMembership).where(FamilyMembership.user_id == admin_user.id))
        admin_membership = result.scalars().first()

        if admin_membership is None:
            admin_family = Family(name="García Family")
            session.add(admin_family)
            await session.flush()

            admin_membership = FamilyMembership(
                family_id=admin_family.id,
                user_id=admin_user.id,
                joined_at=datetime.now(timezone.utc),
            )
            session.add(admin_membership)

            consent = ConsentRecord(
                user_id=admin_user.id,
                policy_version="1.0",
                consented_at=datetime.now(timezone.utc),
                data_storage_consent=True,
                photo_processing_consent=True,
                location_consent=False,
            )
            session.add(consent)

            child = ChildProfile(
                family_id=admin_family.id,
                nickname="Maxi",
                date_of_birth=datetime(2019, 3, 15).date(),
                interests=["drawing", "football"],
            )
            session.add(child)

            print(f"✓  Created family 'García Family' for {admin_user.display_name}")
        else:
            admin_family_result = await session.execute(select(Family).where(Family.id == admin_membership.family_id))
            admin_family = admin_family_result.scalar_one()
            print(f"✓  Admin family: '{admin_family.name or 'Unnamed'}'")

        # ── Clean up existing seed groups ────────────────────────────────────
        result = await session.execute(select(Group).where(Group.name == "3B Class Parents"))
        existing_group = result.scalar_one_or_none()
        if existing_group:
            await session.execute(delete(GroupAdmin).where(GroupAdmin.group_id == existing_group.id))
            await session.execute(delete(GroupMembership).where(GroupMembership.group_id == existing_group.id))
            await session.delete(existing_group)
            await session.flush()
            print("✓  Removed existing '3B Class Parents' group")

        # ── Create group ─────────────────────────────────────────────────────
        group = Group(
            name="3B Class Parents",
            description="Parents of class 3B — Spring challenge 2026",
            created_by_user_id=admin_user.id,
        )
        session.add(group)
        await session.flush()

        session.add(
            GroupMembership(
                group_id=group.id,
                family_id=admin_family.id,
                joined_at=datetime.now(timezone.utc),
            )
        )
        session.add(
            GroupAdmin(
                group_id=group.id,
                user_id=admin_user.id,
                granted_at=datetime.now(timezone.utc),
            )
        )
        print(f"✓  Created group '3B Class Parents' with {admin_user.display_name} as admin")

        # ── Create mock families ─────────────────────────────────────────────
        mock_family_records: list[tuple[Family, User]] = []
        for mock in MOCK_FAMILIES:
            family = Family(name=mock["family_name"])
            session.add(family)
            await session.flush()

            first_user = None
            for parent_data in mock["parents"]:
                existing_user = await session.execute(select(User).where(User.email == parent_data["email"]))
                mock_user = existing_user.scalar_one_or_none()
                if mock_user is None:
                    mock_user = User(
                        google_sub=f"mock_{uuid.uuid4().hex}",
                        email=parent_data["email"],
                        display_name=parent_data["display_name"],
                        points_balance=0,
                    )
                    session.add(mock_user)
                    await session.flush()

                session.add(
                    FamilyMembership(
                        family_id=family.id,
                        user_id=mock_user.id,
                        joined_at=datetime.now(timezone.utc),
                    )
                )
                if first_user is None:
                    first_user = mock_user

            mock_family_records.append((family, first_user))
            session.add(
                GroupMembership(
                    group_id=group.id,
                    family_id=family.id,
                    joined_at=datetime.now(timezone.utc),
                )
            )
            print(f"  + Added mock family: {mock['family_name']}")

        # ── Fetch activities to use in challenges ────────────────────────────
        activity_result = await session.execute(select(Activity).where(Activity.cost_indicator != "paid").limit(18))
        all_activities = list(activity_result.scalars().all())
        if len(all_activities) < 6:
            print("⚠  Not enough activities to seed challenges — skipping")
        else:
            for challenge_title in [
                "Spring Outdoor Adventures",
                "Summer Family Challenge",
                "Winter Warmth Challenge",
            ]:
                result = await session.execute(select(Challenge).where(Challenge.title == challenge_title))
                existing = result.scalar_one_or_none()
                if existing:
                    await session.execute(
                        delete(ChallengeActivity).where(ChallengeActivity.challenge_id == existing.id)
                    )
                    await session.delete(existing)
            await session.flush()

            def _make_challenge(
                title, description, group_id, family_id, start_offset=None, end_offset=None, is_featured=False
            ):
                # Challenges no longer have dates; offsets kept for call-site compatibility.
                return Challenge(
                    title=title,
                    description=description,
                    group_id=group_id,
                    created_by_family_id=family_id,
                    display_mode="collage",
                    is_featured=is_featured,
                )

            async def _add_challenge(challenge, activities):
                session.add(challenge)
                await session.flush()
                for pos, activity in enumerate(activities):
                    session.add(
                        ChallengeActivity(
                            challenge_id=challenge.id,
                            activity_id=activity.id,
                            grid_position=pos,
                        )
                    )
                await session.flush()
                return challenge

            c1 = await _add_challenge(
                _make_challenge(
                    "Spring Outdoor Adventures",
                    "Explore nature and spend quality time together this spring!",
                    group.id,
                    admin_family.id,
                    -7,
                    14,
                    # featured challenge → visible +5 bonus-point path in the demo
                    is_featured=True,
                ),
                all_activities[:6],
            )
            print("✓  Created active group challenge: 'Spring Outdoor Adventures' (6 activities)")

            c2 = await _add_challenge(  # noqa: F841
                _make_challenge(
                    "Summer Family Challenge",
                    "Get ready for summer with these fun activities!",
                    None,
                    admin_family.id,
                    3,
                    24,
                ),
                all_activities[6:12],
            )
            print("✓  Created upcoming personal challenge: 'Summer Family Challenge' (6 activities)")

            c3 = await _add_challenge(
                _make_challenge(
                    "Winter Warmth Challenge",
                    "Cozy indoor activities to brighten the cold months.",
                    group.id,
                    admin_family.id,
                    -40,
                    -10,
                ),
                all_activities[12:18],
            )
            print("✓  Created completed group challenge: 'Winter Warmth Challenge' (6 activities)")

            ca_result = await session.execute(
                select(ChallengeActivity)
                .where(ChallengeActivity.challenge_id == c1.id)
                .order_by(ChallengeActivity.grid_position)
            )
            c1_slots = list(ca_result.scalars().all())

            ca_result = await session.execute(
                select(ChallengeActivity)
                .where(ChallengeActivity.challenge_id == c3.id)
                .order_by(ChallengeActivity.grid_position)
            )
            c3_slots = list(ca_result.scalars().all())

            # Map slot id → activity title for photo matching
            slot_activity_title: dict[uuid.UUID, str] = {}
            slot_activity: dict[uuid.UUID, Activity] = {}
            for i, ca in enumerate(c1_slots):
                slot_activity_title[ca.id] = all_activities[i].title
                slot_activity[ca.id] = all_activities[i]
            for i, ca in enumerate(c3_slots):
                slot_activity_title[ca.id] = all_activities[12 + i].title
                slot_activity[ca.id] = all_activities[12 + i]
            challenge_by_id: dict[uuid.UUID, Challenge] = {c1.id: c1, c3.id: c3}

            def _ts(days_ago: float) -> datetime:
                return datetime.now(timezone.utc) - timedelta(days=days_ago)

            schmidt, schmidt_user = mock_family_records[0]
            mueller, mueller_user = mock_family_records[1]
            bauer, bauer_user = mock_family_records[2]
            koch, koch_user = mock_family_records[3]

            # (family, user, slot, days_ago, shared, caption)
            # Shared completions automatically get a photo matched to the activity.
            completions_data = [
                # ── Spring Outdoor Adventures (c1, slots 0-5) ───────────────
                # Slot 0: Bake cookies
                (schmidt, schmidt_user, c1_slots[0], 6.1, True, "Backen mit den Kindern 🍪"),
                (bauer, bauer_user, c1_slots[0], 5.8, True, "Backen ist das Beste! 🧁"),
                (koch, koch_user, c1_slots[0], 3.7, True, "Die Kinder waren so begeistert!"),
                (admin_family, admin_user, c1_slots[0], 3.1, True, "Unsere besten Kekse! 🍪"),
                # Slot 1: Go to the park
                (schmidt, schmidt_user, c1_slots[1], 4.3, True, "Toller Nachmittag auf dem Spielplatz!"),
                (mueller, mueller_user, c1_slots[1], 3.9, True, "Wir haben so viel Spaß gehabt!"),
                (bauer, bauer_user, c1_slots[1], 6.5, True, "Schöner Ausflug in den Park ☀️"),
                # Slot 2: Build a pillow fort
                (schmidt, schmidt_user, c1_slots[2], 1.8, False, None),
                (mueller, mueller_user, c1_slots[2], 2.6, True, "Unsere Burg war uneinnehmbar! 🏰"),
                (bauer, bauer_user, c1_slots[2], 4.9, True, "Unsere Burg war riesig! 🏰"),
                (admin_family, admin_user, c1_slots[2], 1.2, True, "Bestes Fort aller Zeiten!"),
                # Slot 3: Draw and paint
                (mueller, mueller_user, c1_slots[3], 2.5, True, "Malerische Stunden mit Maxi!"),
                (bauer, bauer_user, c1_slots[3], 2.2, True, "Wir haben Kunstwerke geschaffen 🎨"),
                (admin_family, admin_user, c1_slots[3], 0.7, True, "Maxi malt wie ein Profi 🎨"),
                # Slot 4: Plant something
                (bauer, bauer_user, c1_slots[4], 0.9, True, "Unsere Pflanzen wachsen! 🌱"),
                (mueller, mueller_user, c1_slots[4], 2.1, True, "Miniatur-Garten auf dem Balkon!"),
                (admin_family, admin_user, c1_slots[4], 1.5, True, "Maxi's kleiner Garten 🌱"),
                # Slot 5: Make paper planes
                (schmidt, schmidt_user, c1_slots[5], 3.2, True, "Papierflugzeuge im Garten ✈️"),
                (bauer, bauer_user, c1_slots[5], 2.8, True, "Rekordwurf heute!"),
                (admin_family, admin_user, c1_slots[5], 0.6, True, "Wer fliegt am weitesten? ✈️"),
                # ── Winter Warmth Challenge (c3, slots 0-5) ─────────────────
                # Slot 0: Make hot chocolate
                (schmidt, schmidt_user, c3_slots[0], 35.0, True, "Heiße Schokolade selbst gemacht ☕"),
                (bauer, bauer_user, c3_slots[0], 38.0, True, "So lecker und warm!"),
                (admin_family, admin_user, c3_slots[0], 32.0, True, "Maxi's Lieblingsgetränk ☕"),
                # Slot 1: Star gazing
                (schmidt, schmidt_user, c3_slots[1], 29.0, True, "Sterne gucken im Garten ⭐"),
                (mueller, mueller_user, c3_slots[1], 27.0, True, "Wir haben neue Sternbilder erfunden!"),
                # Slot 2: Make a bird feeder
                (bauer, bauer_user, c3_slots[2], 31.5, True, "Vogelhaus für unseren Garten 🐦"),
                (admin_family, admin_user, c3_slots[2], 28.0, True, "Die Vögel lieben es!"),
                # Slot 3: Scavenger hunt
                (bauer, bauer_user, c3_slots[3], 24.0, True, "Schnitzeljagd im Park! 🗺️"),
                (schmidt, schmidt_user, c3_slots[3], 22.0, True, "Alles gefunden! 🏆"),
                # Slot 4: Shadow puppet theatre
                (koch, koch_user, c3_slots[4], 20.0, True, "Schattentheater für die ganze Familie!"),
                # Slot 5: Read a chapter book
                (mueller, mueller_user, c3_slots[5], 18.0, True, "Vorgelesen bis Maxi eingeschlafen ist 📚"),
                (bauer, bauer_user, c3_slots[5], 15.0, True, "Kapitel für Kapitel zusammen gelesen"),
            ]

            # Photo completions rotate through review outcomes so the demo shows
            # the whole verification loop: mostly verified (with ledger points +
            # audit rows), a few pending, a few rejected (with/without a reason).
            review_cycle = [
                "verified",
                "verified",
                "verified",
                "pending_verification",
                "verified",
                "rejected",
                "verified",
                "verified",
                "pending_verification",
                "verified",
                "rejected",
                "verified",
            ]
            # 20-minute entries demonstrate the casual 30-minute gate (0 points)
            durations = [45, 60, 20, 90, 35]
            rejection_reasons: list[str | None] = ["Das Foto zeigt die Aktivität leider nicht.", None]

            photo_count = 0
            reject_i = 0
            for fam, u, slot, days_ago, shared, caption in completions_data:
                photo_file: str | None = None
                if shared:
                    photo_file = _photo_for_activity(slot_activity_title.get(slot.id, ""))
                photo_key: str | None = None
                if photo_file:
                    photo_key = _upload_seed_photo(fam.id, photo_file)

                if photo_key:
                    status = review_cycle[photo_count % len(review_cycle)]
                    duration = durations[photo_count % len(durations)]
                    photo_count += 1
                else:
                    status = "self_reported"
                    duration = slot_activity[slot.id].estimated_duration_minutes

                completed_at = _ts(days_ago)
                completion = Completion(
                    challenge_activity_id=slot.id,
                    family_id=fam.id,
                    completed_by_user_id=u.id,
                    status=status,
                    photo_key=photo_key,
                    caption=caption,
                    duration_minutes=duration,
                    completed_on=completed_at.date(),
                    shared_to_feed=shared,
                    completed_at=completed_at,
                )
                session.add(completion)
                await session.flush()

                if status == "verified":
                    base, bonus = compute_points(slot_activity[slot.id], challenge_by_id[slot.challenge_id], duration)
                    session.add(
                        PointLedgerEntry(
                            family_id=fam.id,
                            completion_id=completion.id,
                            base_points=base,
                            bonus_points=bonus,
                            awarded_at=completed_at,
                        )
                    )
                    session.add(
                        PhotoVerification(
                            completion_id=completion.id,
                            reviewer_user_id=admin_user.id,
                            action="approved",
                            policy_type="manual",
                            reviewed_at=completed_at,
                        )
                    )
                elif status == "rejected":
                    session.add(
                        PhotoVerification(
                            completion_id=completion.id,
                            reviewer_user_id=admin_user.id,
                            action="rejected",
                            rejection_reason=rejection_reasons[reject_i % len(rejection_reasons)],
                            policy_type="manual",
                            reviewed_at=completed_at,
                        )
                    )
                    reject_i += 1

            await session.flush()
            shared_count = sum(1 for *_, shared, _ in completions_data if shared)
            print(f"✓  Seeded {len(completions_data)} completions ({shared_count} shared, {photo_count} with photos)")

        await session.commit()
        print("\n✅  Seed complete!")
        print(f"   Group: '3B Class Parents' ({group.id})")
        print(f"   Members: {1 + len(MOCK_FAMILIES)} families")
        if not settings.S3_ENDPOINT_URL:
            print("\n   ⚠  S3 not configured — completions seeded as self_reported (no photos).")
            print("      Run inside docker compose to use MinIO and get photo completions.")
        print("\n   Note: mock users have fake google_sub values and cannot sign in.")
        print("   Hint: clear the client's AsyncStorage to re-run onboarding if needed.")


if __name__ == "__main__":
    asyncio.run(seed())
