"""
Development seed script.

Run AFTER signing in at least once so your User record exists:

    docker compose exec api sh -c "PYTHONPATH=/app python /app/scripts/seed_dev.py"

Creates:
  - A "3B Class Parents" group with your account as admin
  - 4 mock families (with display names) added to the group
  - Your family is the creator/admin family

Your email is detected from the SEED_ADMIN_EMAIL env var (default: ignacio.garcian15@gmail.com).
"""

import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import settings
from app.models.base import Base
from app.models.child_profile import ChildProfile
from app.models.consent import ConsentRecord
from app.models.family import Family, FamilyMembership, FamilyRole
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
                role=FamilyRole.admin,
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
        for mock in MOCK_FAMILIES:
            family = Family(name=mock["family_name"])
            session.add(family)
            await session.flush()

            for parent_data in mock["parents"]:
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
                    role=FamilyRole.admin if parent_data == mock["parents"][0] else FamilyRole.member,
                    joined_at=datetime.now(timezone.utc),
                )
                session.add(fm)

            gm = GroupMembership(
                group_id=group.id,
                family_id=family.id,
                joined_at=datetime.now(timezone.utc),
            )
            session.add(gm)
            print(f"  + Added mock family: {mock['family_name']}")

        await session.commit()
        print("\n✅  Seed complete!")
        print(f"   Group: '3B Class Parents' ({group.id})")
        print(f"   Members: {1 + len(MOCK_FAMILIES)} families")
        print(f"\n   Note: mock users have fake google_sub values and cannot sign in.")
        print(f"   Hint: clear the client's AsyncStorage to re-run onboarding if needed.")


if __name__ == "__main__":
    asyncio.run(seed())
