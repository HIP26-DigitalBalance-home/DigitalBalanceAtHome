import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.family import FamilyRepository
from app.repositories.progress import ProgressRepository
from app.services.exceptions import NoFamilyError

# ── Date helpers ──────────────────────────────────────────────────────────────


def current_date() -> date:
    return datetime.now(timezone.utc).date()


# ── Progress read ───────────────────────────────────────────────────────────


async def get_progress(family_id: uuid.UUID, session: AsyncSession) -> dict:
    repo = FamilyRepository(session)
    family = await repo.get_by_id(family_id)
    if not family:
        raise NoFamilyError("Family not found")

    progress_repo = ProgressRepository(session)
    this_week = await progress_repo.get_this_week_stats(family_id)
    all_time = await progress_repo.get_all_time_stats(family_id)

    return {
        "weekly_goal": family.weekly_goal,
        "this_week": this_week,
        "streak": {
            "current_days": family.streak_days,
            "last_days": family.last_streak_days,
            "longest_days": family.longest_streak_days,
            "frozen_today": family.last_frozen_date == current_date(),
        },
        "all_time": all_time,
    }


# ── Streak update (called from completion service) ──────────────────────────


async def update_streak_on_completion(family_id: uuid.UUID, session: AsyncSession) -> None:
    """Update streak state for a family after a new completion. Must be called within
    an open transaction — uses SELECT FOR UPDATE to serialise concurrent writes."""
    repo = FamilyRepository(session)
    family = await repo.get_by_id_with_lock(family_id)
    if not family:
        return

    today = current_date()

    if family.last_activity_date == today:
        # Already counted today — no change needed
        return

    yesterday = today - timedelta(days=1)

    # If a freeze was applied today but the family completes anyway, void it
    freeze_voided = family.last_frozen_date == today

    consecutive = family.last_activity_date == yesterday or family.last_frozen_date == yesterday

    if consecutive:
        family.streak_days += 1
    else:
        # Gap not covered by a freeze — reset and start over at 1
        family.last_streak_days = family.streak_days
        family.streak_days = 1

    if freeze_voided:
        family.last_frozen_date = None

    family.last_activity_date = today
    family.longest_streak_days = max(family.longest_streak_days, family.streak_days)


# ── Settings update ─────────────────────────────────────────────────────────


async def update_settings(family_id: uuid.UUID, weekly_goal: int, session: AsyncSession) -> None:
    repo = FamilyRepository(session)
    family = await repo.get_by_id(family_id)
    if not family:
        raise NoFamilyError("Family not found")
    family.weekly_goal = weekly_goal
    await session.commit()


# ── Sunday auto-freeze job ──────────────────────────────────────────────────


async def run_freeze_job(session: AsyncSession) -> None:
    """Run daily. For each family with an active streak:
    - If no activity today and yesterday wasn't frozen → apply a one-day freeze.
    - If no activity today and yesterday WAS frozen → reset streak.
    Families that completed an activity today are unaffected."""
    from sqlalchemy import select

    from app.models.family import Family

    today = current_date()
    yesterday = today - timedelta(days=1)

    result = await session.execute(select(Family).where(Family.streak_days > 0))
    families = list(result.scalars().all())

    for family in families:
        if family.last_activity_date == today:
            # Active today — nothing to do
            continue

        if family.last_frozen_date == yesterday:
            # Two consecutive empty days — reset streak
            family.last_streak_days = family.streak_days
            family.streak_days = 0
            family.last_frozen_date = None
        else:
            # First empty day — apply freeze
            family.last_frozen_date = today

    await session.commit()
