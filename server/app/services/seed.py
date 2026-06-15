"""Seed demo data for a given user (called via POST /dev/seed)."""

import asyncio
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import boto3
from botocore.config import Config
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.activity import Activity
from app.models.challenge import Challenge, ChallengeActivity
from app.models.child_profile import ChildProfile
from app.models.completion import Completion
from app.models.consent import ConsentRecord
from app.models.family import Family, FamilyMembership
from app.models.group import Group, GroupAdmin, GroupMembership
from app.models.user import User

_SEED_PHOTOS_DIR = Path(__file__).parent.parent.parent / "scripts" / "seed_photos"

# Maps activity title keywords to a bundled photo filename.
# First matching keyword wins; None means no photo for that activity.
# Activity titles are in German (translated by migration c3d4e5f6a7b8).
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
    ("papierflieger", "planes.jpg"),
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


# email_prefix is combined with a per-user tag so each demo user gets an
# isolated set of mock accounts that never collide across users.
_MOCK_FAMILIES: list[dict[str, Any]] = [
    {
        "family_name": "Schmidt Family",
        "parents": [
            {"display_name": "Maria Schmidt", "email_prefix": "maria.schmidt"},
            {"display_name": "Thomas Schmidt", "email_prefix": "thomas.schmidt"},
        ],
    },
    {
        "family_name": "Müller Family",
        "parents": [
            {"display_name": "Anna Müller", "email_prefix": "anna.mueller"},
        ],
    },
    {
        "family_name": "Bauer Family",
        "parents": [
            {"display_name": "Klaus Bauer", "email_prefix": "k.bauer"},
            {"display_name": "Sabine Bauer", "email_prefix": "s.bauer"},
        ],
    },
    {
        "family_name": "Koch Family",
        "parents": [
            {"display_name": "Lisa Koch", "email_prefix": "lisa.koch"},
        ],
    },
]


async def _upload_seed_photo(family_id: uuid.UUID, filename: str) -> str | None:
    """Upload a bundled seed photo to S3. Returns photo_key, or None if unavailable."""
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
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: client.put_object(
                Bucket=settings.S3_BUCKET_NAME,
                Key=key,
                Body=data,
                ContentType="image/jpeg",
            ),
        )
        return key
    except Exception:
        return None


async def _delete_s3_objects(keys: list[str]) -> None:
    """Delete a list of S3 objects. Silently ignores errors."""
    if not settings.S3_ENDPOINT_URL or not settings.S3_BUCKET_NAME or not keys:
        return
    try:
        client = boto3.client(
            "s3",
            endpoint_url=settings.S3_ENDPOINT_URL,
            aws_access_key_id=settings.S3_ACCESS_KEY,
            aws_secret_access_key=settings.S3_SECRET_KEY,
            region_name=settings.S3_REGION,
            config=Config(signature_version="s3v4"),
        )
        objects = [{"Key": k} for k in keys]
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: client.delete_objects(
                Bucket=settings.S3_BUCKET_NAME,
                Delete={"Objects": objects, "Quiet": True},
            ),
        )
    except Exception:
        pass


async def seed_demo_data(session: AsyncSession, user: User) -> None:
    """Seed a complete, isolated demo dataset for `user`.

    Multi-user safe: each caller gets their own group, mock families, and
    challenges. Re-seeding cleans up the previous dataset (DB rows + S3
    objects) before creating a fresh one.
    """
    now = datetime.now(timezone.utc)
    today = date.today()

    # 8-char hex tag scopes mock-user emails to this real user so accounts
    # never collide when multiple demo users seed concurrently.
    user_tag = str(user.id).replace("-", "")[:8]

    # ── Ensure user has a family ──────────────────────────────────────────────
    result = await session.execute(select(FamilyMembership).where(FamilyMembership.user_id == user.id))
    membership = result.scalars().first()

    if membership is None:
        family = Family(name=f"{user.display_name.split()[0]}'s Family")
        session.add(family)
        await session.flush()
        session.add(FamilyMembership(family_id=family.id, user_id=user.id, joined_at=now))
        session.add(
            ConsentRecord(
                user_id=user.id,
                policy_version="1.0",
                consented_at=now,
                data_storage_consent=True,
                photo_processing_consent=True,
                location_consent=False,
            )
        )
        session.add(
            ChildProfile(
                family_id=family.id,
                nickname="Maxi",
                date_of_birth=datetime(2019, 3, 15).date(),
                interests=["drawing", "football"],
            )
        )
        await session.flush()
    else:
        family_result = await session.execute(select(Family).where(Family.id == membership.family_id))
        family = family_result.scalar_one()

    # ── Tear down this user's previous demo data (idempotent re-seed) ────────
    prev_group_result = await session.execute(select(Group).where(Group.created_by_user_id == user.id))
    prev_group = prev_group_result.scalar_one_or_none()

    if prev_group:
        # Collect S3 keys before cascade-deleting completions.
        photo_result = await session.execute(
            select(Completion.photo_key)
            .join(ChallengeActivity, Completion.challenge_activity_id == ChallengeActivity.id)
            .join(Challenge, ChallengeActivity.challenge_id == Challenge.id)
            .where(
                Challenge.created_by_family_id == family.id,
                Completion.photo_key.isnot(None),
            )
        )
        photo_keys: list[str] = [k for k in photo_result.scalars().all() if k is not None]
        await _delete_s3_objects(photo_keys)

        # Delete this user's challenges (ChallengeActivity deletion cascades to Completion).
        ch_result = await session.execute(select(Challenge).where(Challenge.created_by_family_id == family.id))
        for ch in ch_result.scalars().all():
            await session.execute(delete(ChallengeActivity).where(ChallengeActivity.challenge_id == ch.id))
            await session.delete(ch)
        await session.flush()

        # Collect mock family IDs from this group before destroying it.
        mock_fm_result = await session.execute(
            select(GroupMembership.family_id).where(
                GroupMembership.group_id == prev_group.id,
                GroupMembership.family_id != family.id,
            )
        )
        mock_family_ids = list(mock_fm_result.scalars().all())

        # Destroy the group.
        await session.execute(delete(GroupAdmin).where(GroupAdmin.group_id == prev_group.id))
        await session.execute(delete(GroupMembership).where(GroupMembership.group_id == prev_group.id))
        await session.delete(prev_group)
        await session.flush()

        # Destroy mock families and their memberships.
        for fid in mock_family_ids:
            await session.execute(delete(FamilyMembership).where(FamilyMembership.family_id == fid))
            mf_result = await session.execute(select(Family).where(Family.id == fid))
            mf = mf_result.scalar_one_or_none()
            if mf:
                await session.delete(mf)
        await session.flush()

        # Destroy mock users scoped to this demo user.
        await session.execute(delete(User).where(User.email.like(f"%.{user_tag}@demo.internal")))
        await session.flush()

    # ── Create group ──────────────────────────────────────────────────────────
    group = Group(
        name="3B Class Parents",
        description="Parents of class 3B — Spring challenge 2026",
        created_by_user_id=user.id,
    )
    session.add(group)
    await session.flush()
    session.add(GroupMembership(group_id=group.id, family_id=family.id, joined_at=now))
    session.add(GroupAdmin(group_id=group.id, user_id=user.id, granted_at=now))

    # ── Create mock families ──────────────────────────────────────────────────
    mock_family_records: list[tuple[Family, User]] = []
    for mock in _MOCK_FAMILIES:
        mf = Family(name=mock["family_name"])
        session.add(mf)
        await session.flush()

        first_user: User | None = None
        for p in mock["parents"]:
            email = f"{p['email_prefix']}.{user_tag}@demo.internal"
            mu = User(
                google_sub=f"mock_{uuid.uuid4().hex}",
                email=email,
                display_name=p["display_name"],
                points_balance=0,
            )
            session.add(mu)
            await session.flush()
            session.add(FamilyMembership(family_id=mf.id, user_id=mu.id, joined_at=now))
            if first_user is None:
                first_user = mu

        assert first_user is not None
        mock_family_records.append((mf, first_user))
        session.add(GroupMembership(group_id=group.id, family_id=mf.id, joined_at=now))

    # ── Create challenges ─────────────────────────────────────────────────────
    act_result = await session.execute(select(Activity).where(Activity.cost_indicator != "paid").limit(27))
    activities = list(act_result.scalars().all())
    if len(activities) < 27:
        await session.commit()
        return

    async def _add_challenge(ch: Challenge, slots: list[Activity]) -> Challenge:
        session.add(ch)
        await session.flush()
        for pos, act in enumerate(slots):
            session.add(ChallengeActivity(challenge_id=ch.id, activity_id=act.id, grid_position=pos))
        await session.flush()
        return ch

    def _ch(title, desc, group_id, start_offset, end_offset) -> Challenge:
        return Challenge(
            title=title,
            description=desc,
            group_id=group_id,
            created_by_family_id=family.id,
            start_date=today + timedelta(days=start_offset),
            end_date=today + timedelta(days=end_offset),
            display_mode="collage",
        )

    c1 = await _add_challenge(
        _ch(
            "Spring Outdoor Adventures",
            "Explore nature and spend quality time together this spring!",
            group.id,
            -7,
            14,
        ),
        activities[:9],
    )
    await _add_challenge(
        _ch("Summer Family Challenge", "Get ready for summer with these fun activities!", None, 3, 24),
        activities[9:18],
    )
    c3 = await _add_challenge(
        _ch("Winter Warmth Challenge", "Cozy indoor activities to brighten the cold months.", group.id, -40, -10),
        activities[18:27],
    )

    # ── Seed completions ──────────────────────────────────────────────────────
    c1_slots = (
        (
            await session.execute(
                select(ChallengeActivity)
                .where(ChallengeActivity.challenge_id == c1.id)
                .order_by(ChallengeActivity.grid_position)
            )
        )
        .scalars()
        .all()
    )
    c3_slots = (
        (
            await session.execute(
                select(ChallengeActivity)
                .where(ChallengeActivity.challenge_id == c3.id)
                .order_by(ChallengeActivity.grid_position)
            )
        )
        .scalars()
        .all()
    )

    slot_activity_title: dict[uuid.UUID, str] = {}
    for i, ca in enumerate(c1_slots):
        slot_activity_title[ca.id] = activities[i].title
    for i, ca in enumerate(c3_slots):
        slot_activity_title[ca.id] = activities[18 + i].title

    def _ts(days_ago: float) -> datetime:
        return datetime.now(timezone.utc) - timedelta(days=days_ago)

    schmidt, schmidt_user = mock_family_records[0]
    mueller, mueller_user = mock_family_records[1]
    bauer, bauer_user = mock_family_records[2]
    koch, koch_user = mock_family_records[3]

    # (family, user, slot, days_ago, shared, caption)
    completions_data = [
        # ── Spring Outdoor Adventures (c1) ───────────────────────────────────
        # Slot 0: Bake cookies
        (schmidt, schmidt_user, c1_slots[0], 6.1, True, "Backen mit den Kindern 🍪"),
        (bauer, bauer_user, c1_slots[0], 5.8, True, "Backen ist das Beste! 🧁"),
        (koch, koch_user, c1_slots[0], 3.7, True, "Die Kinder waren so begeistert!"),
        (family, user, c1_slots[0], 3.1, True, "Unsere besten Kekse! 🍪"),
        # Slot 1: Go to the park
        (schmidt, schmidt_user, c1_slots[1], 4.3, True, "Toller Nachmittag auf dem Spielplatz!"),
        (mueller, mueller_user, c1_slots[1], 3.9, True, "Wir haben so viel Spaß gehabt!"),
        (bauer, bauer_user, c1_slots[1], 6.5, True, "Schöner Ausflug in den Park ☀️"),
        # Slot 2: Build a pillow fort
        (schmidt, schmidt_user, c1_slots[2], 1.8, False, None),
        (mueller, mueller_user, c1_slots[2], 2.6, True, "Unsere Burg war uneinnehmbar! 🏰"),
        (bauer, bauer_user, c1_slots[2], 4.9, True, "Unsere Burg war riesig! 🏰"),
        (family, user, c1_slots[2], 1.2, True, "Bestes Fort aller Zeiten!"),
        # Slot 3: Draw and paint
        (mueller, mueller_user, c1_slots[3], 2.5, True, "Malerische Stunden mit Maxi!"),
        (bauer, bauer_user, c1_slots[3], 2.2, True, "Wir haben Kunstwerke geschaffen 🎨"),
        (family, user, c1_slots[3], 0.7, True, "Maxi malt wie ein Profi 🎨"),
        # Slot 4: Plant something
        (bauer, bauer_user, c1_slots[4], 0.9, True, "Unsere Pflanzen wachsen! 🌱"),
        (mueller, mueller_user, c1_slots[4], 2.1, True, "Miniatur-Garten auf dem Balkon!"),
        (family, user, c1_slots[4], 1.5, True, "Maxi's kleiner Garten 🌱"),
        # Slot 5: Paper planes
        (schmidt, schmidt_user, c1_slots[5], 3.2, True, "Papierflugzeuge im Garten ✈️"),
        (bauer, bauer_user, c1_slots[5], 2.8, True, "Rekordwurf heute!"),
        (family, user, c1_slots[5], 0.6, True, "Wer fliegt am weitesten? ✈️"),
        # Slot 6: Invent a story
        (koch, koch_user, c1_slots[6], 1.9, True, "Wir haben Fantasia erfunden! 📚"),
        (family, user, c1_slots[6], 0.8, True, "Maxi's Geschichte war wunderschön 📖"),
        # Slot 7: Nature walk
        (mueller, mueller_user, c1_slots[7], 4.1, True, "So viele Dinge entdeckt!"),
        (family, user, c1_slots[7], 2.3, True, "10 bunte Dinge gefunden!"),
        (koch, koch_user, c1_slots[7], 3.0, True, "Naturspaziergang war toll! 🍂"),
        # Slot 8: Cook a meal
        (schmidt, schmidt_user, c1_slots[8], 1.2, True, "Maxi's erste Pasta!"),
        (bauer, bauer_user, c1_slots[8], 3.5, True, "Wir haben zusammen gekocht 🍳"),
        # ── Winter Warmth Challenge (c3) ─────────────────────────────────────
        # Slot 0: Hot chocolate
        (schmidt, schmidt_user, c3_slots[0], 35.0, True, "Heiße Schokolade selbst gemacht ☕"),
        (bauer, bauer_user, c3_slots[0], 38.0, True, "So lecker und warm!"),
        (family, user, c3_slots[0], 32.0, True, "Maxi's Lieblingsgetränk ☕"),
        # Slot 1: Star gazing
        (schmidt, schmidt_user, c3_slots[1], 29.0, True, "Sterne gucken im Garten ⭐"),
        (mueller, mueller_user, c3_slots[1], 27.0, True, "Wir haben neue Sternbilder erfunden!"),
        # Slot 2: Bird feeder
        (bauer, bauer_user, c3_slots[2], 31.5, True, "Vogelhaus für unseren Garten 🐦"),
        (family, user, c3_slots[2], 28.0, True, "Die Vögel lieben es!"),
        # Slot 3: Scavenger hunt
        (bauer, bauer_user, c3_slots[3], 24.0, True, "Schnitzeljagd im Park! 🗺️"),
        (schmidt, schmidt_user, c3_slots[3], 22.0, True, "Alles gefunden! 🏆"),
        # Slot 4: Shadow puppets
        (koch, koch_user, c3_slots[4], 20.0, True, "Schattentheater für die ganze Familie!"),
        # Slot 5: Chapter book
        (mueller, mueller_user, c3_slots[5], 18.0, True, "Vorgelesen bis Maxi eingeschlafen ist 📚"),
        (bauer, bauer_user, c3_slots[5], 15.0, True, "Kapitel für Kapitel zusammen gelesen"),
    ]

    for fam, u, slot, days_ago, shared, caption in completions_data:
        photo_file: str | None = None
        if shared:
            photo_file = _photo_for_activity(slot_activity_title.get(slot.id, ""))
        photo_key: str | None = None
        if photo_file:
            photo_key = await _upload_seed_photo(fam.id, photo_file)
        session.add(
            Completion(
                challenge_activity_id=slot.id,
                family_id=fam.id,
                completed_by_user_id=u.id,
                status="ready" if photo_key else "self_reported",
                photo_key=photo_key,
                caption=caption,
                shared_to_feed=shared,
                completed_at=_ts(days_ago),
            )
        )

    await session.commit()
