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
from datetime import date, datetime, timedelta, timezone
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
from app.models.user import User

ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "ignacio.garcian15@gmail.com")

_SEED_PHOTOS_DIR = Path(__file__).parent / "seed_photos"

_ACTIVITY_PHOTO_MAP: list[tuple[str, str | None]] = [
    ("bake", "baking.jpg"),
    ("cookie", "baking.jpg"),
    ("pancake", "baking.jpg"),
    ("cook", "cooking.jpg"),
    ("park", "park.jpg"),
    ("playground", "park.jpg"),
    ("scavenger", "park.jpg"),
    ("catch", "park.jpg"),
    ("frisbee", "park.jpg"),
    ("nature walk", "park.jpg"),
    ("pillow fort", "fort.jpg"),
    ("blanket", "fort.jpg"),
    ("draw", "drawing.jpg"),
    ("paint", "drawing.jpg"),
    ("collage", "drawing.jpg"),
    ("plant", "planting.jpg"),
    ("garden", "planting.jpg"),
    ("bird feeder", "planting.jpg"),
    ("library", "library.jpg"),
    ("book", "library.jpg"),
    ("playdough", "playdough.jpg"),
    ("dough", "playdough.jpg"),
    ("board game", "board_game.jpg"),
    ("jigsaw", "board_game.jpg"),
    ("puzzle", "board_game.jpg"),
    ("picnic", "picnic.jpg"),
    ("snowman", "park.jpg"),
    ("star gaz", "park.jpg"),
    ("cloud", "park.jpg"),
    ("bike", "park.jpg"),
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
        result = await session.execute(
            select(FamilyMembership).where(FamilyMembership.user_id == admin_user.id)
        )
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
            admin_family_result = await session.execute(
                select(Family).where(Family.id == admin_membership.family_id)
            )
            admin_family = admin_family_result.scalar_one()
            print(f"✓  Admin family: '{admin_family.name or 'Unnamed'}'")

        # ── Clean up existing seed groups ────────────────────────────────────
        result = await session.execute(
            select(Group).where(Group.name == "3B Class Parents")
        )
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

        session.add(GroupMembership(
            group_id=group.id,
            family_id=admin_family.id,
            joined_at=datetime.now(timezone.utc),
        ))
        session.add(GroupAdmin(
            group_id=group.id,
            user_id=admin_user.id,
            granted_at=datetime.now(timezone.utc),
        ))
        print(f"✓  Created group '3B Class Parents' with {admin_user.display_name} as admin")

        # ── Create mock families ─────────────────────────────────────────────
        mock_family_records: list[tuple[Family, User]] = []
        for mock in MOCK_FAMILIES:
            family = Family(name=mock["family_name"])
            session.add(family)
            await session.flush()

            first_user = None
            for parent_data in mock["parents"]:
                existing_user = await session.execute(
                    select(User).where(User.email == parent_data["email"])
                )
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

                session.add(FamilyMembership(
                    family_id=family.id,
                    user_id=mock_user.id,
                    joined_at=datetime.now(timezone.utc),
                ))
                if first_user is None:
                    first_user = mock_user

            mock_family_records.append((family, first_user))
            session.add(GroupMembership(
                group_id=group.id,
                family_id=family.id,
                joined_at=datetime.now(timezone.utc),
            ))
            print(f"  + Added mock family: {mock['family_name']}")

        # ── Fetch activities to use in challenges ────────────────────────────
        activity_result = await session.execute(
            select(Activity).where(Activity.cost_indicator != "paid").limit(18)
        )
        all_activities = list(activity_result.scalars().all())
        if len(all_activities) < 6:
            print("⚠  Not enough activities to seed challenges — skipping")
        else:
            today = date.today()

            for challenge_title in [
                "Spring Outdoor Adventures",
                "Summer Family Challenge",
                "Winter Warmth Challenge",
            ]:
                result = await session.execute(
                    select(Challenge).where(Challenge.title == challenge_title)
                )
                existing = result.scalar_one_or_none()
                if existing:
                    await session.execute(
                        delete(ChallengeActivity).where(ChallengeActivity.challenge_id == existing.id)
                    )
                    await session.delete(existing)
            await session.flush()

            def _make_challenge(title, description, group_id, family_id, start_offset, end_offset):
                return Challenge(
                    title=title,
                    description=description,
                    group_id=group_id,
                    created_by_family_id=family_id,
                    start_date=today + timedelta(days=start_offset),
                    end_date=today + timedelta(days=end_offset),
                    display_mode="collage",
                )

            async def _add_challenge(challenge, activities):
                session.add(challenge)
                await session.flush()
                for pos, activity in enumerate(activities):
                    session.add(ChallengeActivity(
                        challenge_id=challenge.id,
                        activity_id=activity.id,
                        grid_position=pos,
                    ))
                await session.flush()
                return challenge

            c1 = await _add_challenge(
                _make_challenge(
                    "Spring Outdoor Adventures",
                    "Explore nature and spend quality time together this spring!",
                    group.id, admin_family.id, -7, 14,
                ),
                all_activities[:6],
            )
            print("✓  Created active group challenge: 'Spring Outdoor Adventures' (6 activities)")

            c2 = await _add_challenge(  # noqa: F841
                _make_challenge(
                    "Summer Family Challenge",
                    "Get ready for summer with these fun activities!",
                    None, admin_family.id, 3, 24,
                ),
                all_activities[6:12],
            )
            print("✓  Created upcoming personal challenge: 'Summer Family Challenge' (6 activities)")

            c3 = await _add_challenge(
                _make_challenge(
                    "Winter Warmth Challenge",
                    "Cozy indoor activities to brighten the cold months.",
                    group.id, admin_family.id, -40, -10,
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
            for i, ca in enumerate(c1_slots):
                slot_activity_title[ca.id] = all_activities[i].title
            for i, ca in enumerate(c3_slots):
                slot_activity_title[ca.id] = all_activities[12 + i].title

            def _ts(days_ago: float) -> datetime:
                return datetime.now(timezone.utc) - timedelta(days=days_ago)

            schmidt, schmidt_user = mock_family_records[0]
            mueller, mueller_user = mock_family_records[1]
            bauer, bauer_user = mock_family_records[2]
            koch, koch_user = mock_family_records[3]

            # (family, user, slot, days_ago, shared, caption)
            # Shared completions automatically get a photo matched to the activity.
            completions_data = [
                # Schmidt — active challenge
                (schmidt, schmidt_user, c1_slots[0], 6.1, True, "Backen mit den Kindern 🍪"),
                (schmidt, schmidt_user, c1_slots[1], 4.3, True, "Toller Nachmittag auf dem Spielplatz!"),
                (schmidt, schmidt_user, c1_slots[2], 1.8, False, None),
                # Müller — active challenge
                (mueller, mueller_user, c1_slots[0], 5.2, False, None),
                (mueller, mueller_user, c1_slots[3], 2.5, True, "Malerische Stunden mit Maxi!"),
                # Bauer — active challenge
                (bauer, bauer_user, c1_slots[1], 6.5, True, "Schöner Ausflug in den Park ☀️"),
                (bauer, bauer_user, c1_slots[2], 4.9, True, "Unsere Burg war riesig! 🏰"),
                (bauer, bauer_user, c1_slots[3], 2.2, True, "Wir haben Kunstwerke geschaffen 🎨"),
                (bauer, bauer_user, c1_slots[4], 0.9, False, None),
                # Koch — active challenge
                (koch, koch_user, c1_slots[0], 3.7, True, "Die Kinder waren so begeistert!"),
                # Admin family — active challenge
                (admin_family, admin_user, c1_slots[0], 3.1, True, "Unsere besten Kekse! 🍪"),
                (admin_family, admin_user, c1_slots[1], 0.5, False, None),
                # Schmidt — completed winter challenge
                (schmidt, schmidt_user, c3_slots[0], 35.0, True, "Bücherei-Besuch — Maxi liebt Bücher! 📚"),
                (schmidt, schmidt_user, c3_slots[1], 29.0, False, None),
                # Bauer — completed winter challenge
                (bauer, bauer_user, c3_slots[0], 38.0, True, "So viele tolle Bücher entdeckt!"),
                (bauer, bauer_user, c3_slots[2], 31.5, True, "Kneten macht so viel Spaß! 🎨"),
                (bauer, bauer_user, c3_slots[3], 24.0, False, None),
            ]

            photo_count = 0
            for fam, u, slot, days_ago, shared, caption in completions_data:
                photo_file: str | None = None
                if shared:
                    photo_file = _photo_for_activity(slot_activity_title.get(slot.id, ""))
                photo_key: str | None = None
                if photo_file:
                    photo_key = _upload_seed_photo(fam.id, photo_file)
                    if photo_key:
                        photo_count += 1
                session.add(Completion(
                    challenge_activity_id=slot.id,
                    family_id=fam.id,
                    completed_by_user_id=u.id,
                    status="ready" if photo_key else "self_reported",
                    photo_key=photo_key,
                    caption=caption,
                    shared_to_feed=shared,
                    completed_at=_ts(days_ago),
                ))

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
