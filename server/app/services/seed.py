"""Seed demo data for a given user (called via POST /dev/seed)."""

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.challenge import Challenge, ChallengeActivity
from app.models.child_profile import ChildProfile
from app.models.completion import Completion
from app.models.consent import ConsentRecord
from app.models.family import Family, FamilyMembership
from app.models.group import Group, GroupAdmin, GroupMembership
from app.models.user import User

_MOCK_FAMILIES: list[dict[str, Any]] = [
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


async def seed_demo_data(session: AsyncSession, user: User) -> None:
    """Seed demo data scoped to `user`. Idempotent."""
    now = datetime.now(timezone.utc)
    today = date.today()

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

    # ── Remove previous demo group if present ────────────────────────────────
    result = await session.execute(select(Group).where(Group.name == "3B Class Parents"))
    existing = result.scalar_one_or_none()
    if existing:
        await session.execute(delete(GroupAdmin).where(GroupAdmin.group_id == existing.id))
        await session.execute(delete(GroupMembership).where(GroupMembership.group_id == existing.id))
        await session.delete(existing)
        await session.flush()

    # ── Create demo group ─────────────────────────────────────────────────────
    group = Group(
        name="3B Class Parents",
        description="Parents of class 3B — Spring challenge 2026",
        created_by_user_id=user.id,
    )
    session.add(group)
    await session.flush()

    session.add(GroupMembership(group_id=group.id, family_id=family.id, joined_at=now))
    session.add(GroupAdmin(group_id=group.id, user_id=user.id, granted_at=now))

    # ── Create mock families & add to group ───────────────────────────────────
    mock_family_records: list[tuple[Family, User]] = []
    for mock in _MOCK_FAMILIES:
        mf = Family(name=mock["family_name"])
        session.add(mf)
        await session.flush()

        first_user = None
        for p in mock["parents"]:
            res = await session.execute(select(User).where(User.email == p["email"]))
            mu = res.scalar_one_or_none()
            if mu is None:
                mu = User(
                    google_sub=f"mock_{uuid.uuid4().hex}",
                    email=p["email"],
                    display_name=p["display_name"],
                    points_balance=0,
                )
                session.add(mu)
                await session.flush()
            session.add(FamilyMembership(family_id=mf.id, user_id=mu.id, joined_at=now))
            if first_user is None:
                first_user = mu

        assert first_user is not None  # each mock family has at least one parent
        mock_family_records.append((mf, first_user))
        session.add(GroupMembership(group_id=group.id, family_id=mf.id, joined_at=now))

    # ── Remove previous demo challenges ──────────────────────────────────────
    for title in ["Spring Outdoor Adventures", "Summer Family Challenge", "Winter Warmth Challenge"]:
        res = await session.execute(select(Challenge).where(Challenge.title == title))
        ch = res.scalar_one_or_none()
        if ch:
            await session.execute(delete(ChallengeActivity).where(ChallengeActivity.challenge_id == ch.id))
            await session.delete(ch)
    await session.flush()

    # ── Fetch activities ──────────────────────────────────────────────────────
    act_result = await session.execute(select(Activity).where(Activity.cost_indicator != "paid").limit(18))
    activities = list(act_result.scalars().all())
    if len(activities) < 6:
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
        activities[:6],
    )
    c2 = await _add_challenge(  # noqa: F841
        _ch("Summer Family Challenge", "Get ready for summer with these fun activities!", None, 3, 24),
        activities[6:12],
    )
    c3 = await _add_challenge(
        _ch("Winter Warmth Challenge", "Cozy indoor activities to brighten the cold months.", group.id, -40, -10),
        activities[12:18],
    )

    # ── Seed mock completions ─────────────────────────────────────────────────
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

    def _ts(days_ago: float) -> datetime:
        return datetime.now(timezone.utc) - timedelta(days=days_ago)

    schmidt, schmidt_user = mock_family_records[0]
    mueller, mueller_user = mock_family_records[1]
    bauer, bauer_user = mock_family_records[2]
    koch, koch_user = mock_family_records[3]

    completions = [
        (schmidt, schmidt_user, c1_slots[0], 6.1, True, "Herrlicher Waldspaziergang heute! 🌳"),
        (schmidt, schmidt_user, c1_slots[1], 4.3, True, "Thomas hat Maxi beim Fahrradfahren geholfen — so stolz!"),
        (schmidt, schmidt_user, c1_slots[2], 1.8, False, None),
        (mueller, mueller_user, c1_slots[0], 5.2, False, None),
        (mueller, mueller_user, c1_slots[3], 2.5, True, "Backen macht die Kinder so glücklich ☀️"),
        (bauer, bauer_user, c1_slots[1], 6.5, True, "Endlich mal wieder raus in die Natur!"),
        (bauer, bauer_user, c1_slots[2], 4.9, True, "Sabine und Klaus haben Picknick gemacht mit den Kids"),
        (bauer, bauer_user, c1_slots[3], 2.2, True, "Wir haben Blumen gepflanzt 🌻"),
        (bauer, bauer_user, c1_slots[4], 0.9, False, None),
        (koch, koch_user, c1_slots[0], 3.7, True, "Tolle Aktivität, sehr empfehlenswert!"),
        (family, user, c1_slots[0], 3.1, True, "Super Idee, die Kinder waren begeistert"),
        (family, user, c1_slots[1], 0.5, False, None),
        (schmidt, schmidt_user, c3_slots[0], 35.0, True, "Winterabend mit Brettspielen — wunderschön 🎲"),
        (schmidt, schmidt_user, c3_slots[1], 29.0, False, None),
        (bauer, bauer_user, c3_slots[0], 38.0, True, "Gemeinsames Kochen in der Adventszeit"),
        (bauer, bauer_user, c3_slots[2], 31.5, True, "Basteln mit den Kindern hat so viel Spaß gemacht!"),
        (bauer, bauer_user, c3_slots[3], 24.0, False, None),
    ]

    for fam, u, slot, days_ago, shared, caption in completions:
        session.add(
            Completion(
                challenge_activity_id=slot.id,
                family_id=fam.id,
                completed_by_user_id=u.id,
                status="self_reported",
                caption=caption,
                shared_to_feed=shared,
                completed_at=_ts(days_ago),
            )
        )

    await session.commit()
