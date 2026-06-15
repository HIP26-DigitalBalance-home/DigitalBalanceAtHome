"""
Delete all demo/seed data from the database, leaving the admin user account intact.

Removes:
  - All completions
  - All challenge activities and challenges
  - All group admins, memberships, and groups
  - All mock users (fake google_sub) and their family memberships
  - All child profiles
  - All families (and their memberships) except the admin's family
  - Admin's family membership + family itself (so re-seeding creates a clean one)
  - Admin's consent records

The admin user row (users table) is preserved — they can sign in again normally.

Usage (inside Docker Compose):
    docker compose exec api sh -c "PYTHONPATH=/app python /app/scripts/reset_demo_data.py"

Usage (local):
    set -a && source server/.env && set +a
    PYTHONPATH=server python server/scripts/reset_demo_data.py
"""

import asyncio
import os

from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

DATABASE_URL = os.environ.get("DATABASE_URL", "")
ADMIN_EMAIL = os.environ.get("SEED_ADMIN_EMAIL", "ignacio.garcian15@gmail.com")

if not DATABASE_URL:
    raise SystemExit("❌  DATABASE_URL must be set.")


async def reset():
    engine = create_async_engine(DATABASE_URL, echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    # Import models inside the function to avoid requiring the full app context
    from app.models.challenge import Challenge, ChallengeActivity
    from app.models.child_profile import ChildProfile
    from app.models.completion import Completion
    from app.models.consent import ConsentRecord
    from app.models.family import Family, FamilyMembership
    from app.models.group import Group, GroupAdmin, GroupMembership
    from app.models.user import User

    async with Session() as session:
        # ── Find admin user (preserved) ──────────────────────────────────────
        result = await session.execute(select(User).where(User.email == ADMIN_EMAIL))
        admin_user = result.scalar_one_or_none()
        if admin_user:
            print(f"✓  Keeping admin user: {admin_user.display_name} ({admin_user.email})")
        else:
            print(f"⚠  Admin user {ADMIN_EMAIL} not found — proceeding with full wipe")

        # ── Completions ───────────────────────────────────────────────────────
        result = await session.execute(delete(Completion))
        print(f"✓  Deleted {result.rowcount} completions")

        # ── Challenge activities ──────────────────────────────────────────────
        result = await session.execute(delete(ChallengeActivity))
        print(f"✓  Deleted {result.rowcount} challenge activities")

        # ── Challenges ────────────────────────────────────────────────────────
        result = await session.execute(delete(Challenge))
        print(f"✓  Deleted {result.rowcount} challenges")

        # ── Group admins + memberships + groups ───────────────────────────────
        result = await session.execute(delete(GroupAdmin))
        print(f"✓  Deleted {result.rowcount} group admin records")

        result = await session.execute(delete(GroupMembership))
        print(f"✓  Deleted {result.rowcount} group memberships")

        result = await session.execute(delete(Group))
        print(f"✓  Deleted {result.rowcount} groups")

        # ── Child profiles ────────────────────────────────────────────────────
        result = await session.execute(delete(ChildProfile))
        print(f"✓  Deleted {result.rowcount} child profiles")

        # ── Family memberships ────────────────────────────────────────────────
        result = await session.execute(delete(FamilyMembership))
        print(f"✓  Deleted {result.rowcount} family memberships")

        # ── Families ──────────────────────────────────────────────────────────
        result = await session.execute(delete(Family))
        print(f"✓  Deleted {result.rowcount} families")

        # ── Mock users (fake google_sub starting with 'mock_') ────────────────
        result = await session.execute(
            delete(User).where(User.google_sub.like("mock_%"))
        )
        print(f"✓  Deleted {result.rowcount} mock users")

        # ── Consent records (will be recreated on next seed) ──────────────────
        if admin_user:
            result = await session.execute(
                delete(ConsentRecord).where(ConsentRecord.user_id == admin_user.id)
            )
            print(f"✓  Deleted {result.rowcount} consent records for admin")

        await session.commit()
        print("\n✅  Reset complete. Run seed_dev.py or POST /dev/seed to re-seed.")


if __name__ == "__main__":
    asyncio.run(reset())
