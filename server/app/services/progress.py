import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.family import FamilyRepository
from app.repositories.progress import ProgressRepository
from app.services.exceptions import NoFamilyError

# ── ISO week helpers ────────────────────────────────────────────────────────


def current_iso_week() -> str:
    iso = datetime.now(timezone.utc).isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


def previous_iso_week(week_str: str) -> str:
    year, w = week_str.split("-W")
    monday = datetime.strptime(f"{year}-W{w}-1", "%G-W%V-%u")
    prev = monday - timedelta(weeks=1)
    iso = prev.isocalendar()
    return f"{iso.year}-W{iso.week:02d}"


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
            "current_weeks": family.streak_weeks,
            "last_weeks": family.last_streak_weeks,
            "longest_weeks": family.longest_streak_weeks,
            "frozen_this_week": family.last_frozen_iso_week == current_iso_week(),
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

    week = current_iso_week()

    if family.last_activity_iso_week == week:
        # Already counted this week — no change needed
        return

    prev_week = previous_iso_week(week)

    # If a freeze was applied this week but the family completes anyway, void it
    freeze_voided = family.last_frozen_iso_week == week

    consecutive = family.last_activity_iso_week == prev_week or family.last_frozen_iso_week == prev_week

    if consecutive:
        family.streak_weeks += 1
        if freeze_voided:
            family.last_frozen_iso_week = None
    else:
        # Gap not covered by a freeze — reset and start over at 1
        family.last_streak_weeks = family.streak_weeks
        family.streak_weeks = 1
        if freeze_voided:
            family.last_frozen_iso_week = None

    family.last_activity_iso_week = week
    family.longest_streak_weeks = max(family.longest_streak_weeks, family.streak_weeks)


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
    """Run on Sunday evenings. For each family with an active streak:
    - If no activity this week and last week wasn't frozen → apply freeze.
    - If no activity this week and last week WAS frozen → reset streak.
    Families that completed an activity this week are unaffected."""
    from sqlalchemy import select

    from app.models.family import Family

    week = current_iso_week()
    prev_week = previous_iso_week(week)

    result = await session.execute(select(Family).where(Family.streak_weeks > 0))
    families = list(result.scalars().all())

    for family in families:
        if family.last_activity_iso_week == week:
            # Active this week — nothing to do
            continue

        if family.last_frozen_iso_week == prev_week:
            # Two consecutive empty weeks — reset streak
            family.last_streak_weeks = family.streak_weeks
            family.streak_weeks = 0
            family.last_frozen_iso_week = None
        else:
            # First empty week — apply freeze
            family.last_frozen_iso_week = week

    await session.commit()
