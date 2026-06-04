"""
Development seed script.

Run AFTER signing in at least once so your User record exists:

    docker compose exec api sh -c "PYTHONPATH=/app python /app/scripts/seed_dev.py"

Creates:
  - A "3B Class Parents" group with your account as admin
  - 4 mock families (with display names) added to the group
  - Your family is the creator/admin family
  - 3 mock challenges: one active group, one upcoming personal, one completed group

Your email is detected from the SEED_ADMIN_EMAIL env var (default: ignacio.garcian15@gmail.com).
"""

import asyncio
import os
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select, delete
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
        admin_membership = result.scalar_one_or_none()

        if admin_membership is None:
            # Create family + membership + consent + child profile for admin
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

        # Admin family membership + admin record
        gm_admin = GroupMembership(
            group_id=group.id,
            family_id=admin_family.id,
            joined_at=datetime.now(timezone.utc),
        )
        session.add(gm_admin)

        ga = GroupAdmin(
            group_id=group.id,
            user_id=admin_user.id,
            granted_at=datetime.now(timezone.utc),
        )
        session.add(ga)
        print(f"✓  Created group '3B Class Parents' with {admin_user.display_name} as admin")

        # ── Create mock families ─────────────────────────────────────────────
        mock_family_records: list[tuple[Family, User]] = []  # (family, first_parent_user)
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

                fm = FamilyMembership(
                    family_id=family.id,
                    user_id=mock_user.id,
                    joined_at=datetime.now(timezone.utc),
                )
                session.add(fm)
                if first_user is None:
                    first_user = mock_user

            mock_family_records.append((family, first_user))
            gm = GroupMembership(
                group_id=group.id,
                family_id=family.id,
                joined_at=datetime.now(timezone.utc),
            )
            session.add(gm)
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

            # Clean up previously seeded challenges
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

            def _make_challenge(title, description, group_id, family_id, start_offset, end_offset, activities):
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

            # 1. Active group challenge (started 7 days ago, ends in 14 days)
            c1 = _make_challenge(
                title="Spring Outdoor Adventures",
                description="Explore nature and spend quality time together this spring!",
                group_id=group.id,
                family_id=admin_family.id,
                start_offset=-7,
                end_offset=14,
                activities=all_activities[:6],
            )
            c1 = await _add_challenge(c1, all_activities[:6])
            print(f"✓  Created active group challenge: 'Spring Outdoor Adventures' (6 activities)")

            # 2. Upcoming personal challenge (starts in 3 days, runs 3 weeks)
            c2 = _make_challenge(
                title="Summer Family Challenge",
                description="Get ready for summer with these fun activities!",
                group_id=None,
                family_id=admin_family.id,
                start_offset=3,
                end_offset=24,
                activities=all_activities[6:12],
            )
            c2 = await _add_challenge(c2, all_activities[6:12])
            print(f"✓  Created upcoming personal challenge: 'Summer Family Challenge' (6 activities)")

            # 3. Completed group challenge (ended 10 days ago)
            c3 = _make_challenge(
                title="Winter Warmth Challenge",
                description="Cozy indoor activities to brighten the cold months.",
                group_id=group.id,
                family_id=admin_family.id,
                start_offset=-40,
                end_offset=-10,
                activities=all_activities[12:18],
            )
            c3 = await _add_challenge(c3, all_activities[12:18])
            print(f"✓  Created completed group challenge: 'Winter Warmth Challenge' (6 activities)")

            # ── Seed mock completions for the feed ───────────────────────────
            # Fetch ChallengeActivity rows for c1 (active group) and c3 (completed group)
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

            def _ts(days_ago: float) -> datetime:
                return datetime.now(timezone.utc) - timedelta(days=days_ago)

            # schema: (family, user, challenge_slot, days_ago, shared, caption)
            schmidt, schmidt_user = mock_family_records[0]
            mueller, mueller_user = mock_family_records[1]
            bauer, bauer_user = mock_family_records[2]
            koch, koch_user = mock_family_records[3]

            mock_completions = [
                # Schmidt — active challenge (slots 0,1,2)
                (schmidt, schmidt_user, c1_slots[0], 6.1, True,  "Herrlicher Waldspaziergang heute! 🌳"),
                (schmidt, schmidt_user, c1_slots[1], 4.3, True,  "Thomas hat Maxi beim Fahrradfahren geholfen — so stolz!"),
                (schmidt, schmidt_user, c1_slots[2], 1.8, False, None),
                # Müller — active challenge (slots 0,3)
                (mueller, mueller_user, c1_slots[0], 5.2, False, None),
                (mueller, mueller_user, c1_slots[3], 2.5, True,  "Backen macht die Kinder so glücklich ☀️"),
                # Bauer — active challenge (slots 1,2,3,4)
                (bauer, bauer_user,   c1_slots[1], 6.5, True,  "Endlich mal wieder raus in die Natur!"),
                (bauer, bauer_user,   c1_slots[2], 4.9, True,  "Sabine und Klaus haben Picknick gemacht mit den Kids"),
                (bauer, bauer_user,   c1_slots[3], 2.2, True,  "Wir haben Blumen gepflanzt 🌻"),
                (bauer, bauer_user,   c1_slots[4], 0.9, False, None),
                # Koch — active challenge (slot 0)
                (koch,  koch_user,    c1_slots[0], 3.7, True,  "Tolle Aktivität, sehr empfehlenswert!"),
                # Admin family — active challenge (slots 0,1)
                (admin_family, admin_user, c1_slots[0], 3.1, True,  "Super Idee, die Kinder waren begeistert"),
                (admin_family, admin_user, c1_slots[1], 0.5, False, None),
                # Schmidt — completed challenge (slots 0,1)
                (schmidt, schmidt_user, c3_slots[0], 35.0, True,  "Winterabend mit Brettspielen — wunderschön 🎲"),
                (schmidt, schmidt_user, c3_slots[1], 29.0, False, None),
                # Bauer — completed challenge (slots 0,2,3)
                (bauer,  bauer_user,   c3_slots[0], 38.0, True,  "Gemeinsames Kochen in der Adventszeit"),
                (bauer,  bauer_user,   c3_slots[2], 31.5, True,  "Basteln mit den Kindern hat so viel Spaß gemacht!"),
                (bauer,  bauer_user,   c3_slots[3], 24.0, False, None),
            ]

            for family, user, slot, days_ago, shared, caption in mock_completions:
                session.add(Completion(
                    challenge_activity_id=slot.id,
                    family_id=family.id,
                    completed_by_user_id=user.id,
                    status="self_reported",
                    caption=caption,
                    shared_to_feed=shared,
                    completed_at=_ts(days_ago),
                ))

            await session.flush()
            shared_count = sum(1 for *_, shared, _ in mock_completions if shared)
            print(f"✓  Seeded {len(mock_completions)} completions ({shared_count} shared to feed)")

        await session.commit()
        print("\n✅  Seed complete!")
        print(f"   Group: '3B Class Parents' ({group.id})")
        print(f"   Members: {1 + len(MOCK_FAMILIES)} families")
        print(f"\n   Note: mock users have fake google_sub values and cannot sign in.")
        print(f"   Hint: clear the client's AsyncStorage to re-run onboarding if needed.")


if __name__ == "__main__":
    asyncio.run(seed())
