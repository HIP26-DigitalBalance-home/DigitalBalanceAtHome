"""Seed demo data for a given user (called via POST /dev/seed)."""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
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


async def _delete_family_photos(family_ids: set[uuid.UUID] | list[uuid.UUID]) -> None:
    """Delete every S3 object under each family's photo prefix.

    Deleting by ``photos/{family_id}/`` prefix (rather than by known completion
    keys) also sweeps up orphans from an interrupted upload — a photo written to
    S3 whose completion row never committed — so a reset leaves no stragglers.
    Best-effort: S3 errors never block the reset.
    """
    ids = [str(f) for f in family_ids]
    if not settings.S3_ENDPOINT_URL or not settings.S3_BUCKET_NAME or not ids:
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

        def _purge() -> None:
            paginator = client.get_paginator("list_objects_v2")
            batch: list[dict] = []

            def _flush() -> None:
                if batch:
                    client.delete_objects(
                        Bucket=settings.S3_BUCKET_NAME,
                        Delete={"Objects": batch, "Quiet": True},
                    )
                    batch.clear()

            for fid in ids:
                for page in paginator.paginate(Bucket=settings.S3_BUCKET_NAME, Prefix=f"photos/{fid}/"):
                    for obj in page.get("Contents", []):
                        batch.append({"Key": obj["Key"]})
                        if len(batch) >= 1000:  # delete_objects caps at 1000 keys
                            _flush()
            _flush()

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _purge)
    except Exception:
        pass


async def seed_demo_data(session: AsyncSession, user: User) -> None:
    """Reset `user` to a fixed demo state.

    This is a "reset", not an "append": it keeps the user account (id, email,
    login) but purges the user's entire dataset — family, children, groups,
    challenges, collages/completions — plus every mock account and S3 photo
    from a prior run, then rebuilds a known-good demo dataset. Because it tears
    everything down first it is fully idempotent and never collides with
    pre-existing data.

    Multi-user safe: mock accounts are tagged per real user, so concurrent demo
    users never touch each other's data.

    Note: if the user shares a family with a co-parent, that family is deleted
    too — this is a dev-only tool (gated by SEED_ENABLED).
    """
    now = datetime.now(timezone.utc)

    # 8-char hex tag scopes mock-user emails to this real user so accounts
    # never collide when multiple demo users seed concurrently.
    user_tag = str(user.id).replace("-", "")[:8]

    # ── Purge everything belonging to this user's demo state ──────────────────
    # Identify prior mock accounts (tagged per-user) and their families, plus
    # the user's own family — from a previous seed or from normal onboarding.
    mock_email_pattern = f"%.{user_tag}@demo.internal"
    mock_user_ids = list(
        (await session.execute(select(User.id).where(User.email.like(mock_email_pattern)))).scalars().all()
    )
    mock_family_ids: list[uuid.UUID] = []
    if mock_user_ids:
        mock_family_ids = list(
            (
                await session.execute(
                    select(FamilyMembership.family_id).where(FamilyMembership.user_id.in_(mock_user_ids))
                )
            )
            .scalars()
            .all()
        )

    old_family_id = (
        (await session.execute(select(FamilyMembership.family_id).where(FamilyMembership.user_id == user.id)))
        .scalars()
        .first()
    )

    families_to_delete = set(mock_family_ids)
    if old_family_id:
        families_to_delete.add(old_family_id)

    # Purge every S3 photo under the torn-down families' prefixes (best-effort).
    await _delete_family_photos(families_to_delete)

    # DB teardown. Leans on ON DELETE CASCADE (see FK definitions):
    #   Family → memberships, children, invites, completions, challenges
    #            (→ challenge_activities → completions), group_memberships
    #   Group  → memberships, admins, invites, shared_groups; challenges.group_id → NULL
    await session.execute(delete(Group).where(Group.created_by_user_id == user.id))
    await session.execute(delete(GroupAdmin).where(GroupAdmin.user_id == user.id))
    # Defensive: completions authored by a mock user but not covered by a family
    # cascade — keeps the mock-user delete below FK-safe under any prior state.
    if mock_user_ids:
        await session.execute(delete(Completion).where(Completion.completed_by_user_id.in_(mock_user_ids)))
    if old_family_id:
        await session.execute(delete(Family).where(Family.id == old_family_id))
    if mock_family_ids:
        await session.execute(delete(Family).where(Family.id.in_(mock_family_ids)))
    if mock_user_ids:
        await session.execute(delete(User).where(User.id.in_(mock_user_ids)))
    await session.flush()

    # ── Rebuild the user's baseline: fresh family, consent, one child ─────────
    user.points_balance = 0

    family = Family(name=f"{user.display_name.split()[0]}'s Family")
    session.add(family)
    await session.flush()
    session.add(FamilyMembership(family_id=family.id, user_id=user.id, joined_at=now))

    # Consent is an append-only GDPR log — keep any history, add one only if none.
    has_consent = (
        await session.execute(select(ConsentRecord.id).where(ConsentRecord.user_id == user.id).limit(1))
    ).first()
    if has_consent is None:
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

    def _ch(
        title, desc, group_id, start_offset=None, end_offset=None, title_en=None, desc_en=None, is_featured=False
    ) -> Challenge:
        # Base columns hold German; *_en hold English so content negotiation can
        # serve either language (see app/services/localization.py).
        # Challenges no longer have dates; offsets kept for call-site compatibility.
        return Challenge(
            title=title,
            description=desc,
            title_en=title_en,
            description_en=desc_en,
            group_id=group_id,
            created_by_family_id=family.id,
            display_mode="collage",
            is_featured=is_featured,
        )

    c1 = await _add_challenge(
        _ch(
            "Frühlingsabenteuer im Freien",
            "Entdeckt die Natur und verbringt diesen Frühling bewusst Zeit miteinander!",
            group.id,
            -7,
            14,
            title_en="Spring Outdoor Adventures",
            desc_en="Explore nature and spend quality time together this spring!",
            # featured challenge → visible +5 bonus-point path in the demo
            is_featured=True,
        ),
        activities[:9],
    )
    await _add_challenge(
        _ch(
            "Sommer-Familienchallenge",
            "Macht euch bereit für den Sommer mit diesen spaßigen Aktivitäten!",
            None,
            3,
            24,
            title_en="Summer Family Challenge",
            desc_en="Get ready for summer with these fun activities!",
        ),
        activities[9:18],
    )
    c3 = await _add_challenge(
        _ch(
            "Winterwärme-Challenge",
            "Gemütliche Indoor-Aktivitäten für die kalten Monate.",
            group.id,
            -40,
            -10,
            title_en="Winter Warmth Challenge",
            desc_en="Cozy indoor activities to brighten the cold months.",
        ),
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
                status="verified" if photo_key else "self_reported",
                photo_key=photo_key,
                caption=caption,
                duration_minutes=45 if photo_key else None,
                shared_to_feed=shared,
                completed_at=_ts(days_ago),
            )
        )

    await session.commit()
