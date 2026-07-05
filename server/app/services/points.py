"""Fixed-tier point computation and awarding.

Point values are system-wide constants from the BOND business model
(docs/reward-point-system.md) — deliberately not admin-configurable, since the
rewards budget is priced around these exact numbers.
"""

import uuid
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.challenge import Challenge, ChallengeActivity
from app.models.completion import Completion
from app.repositories.rewards import RewardsRepository

CASUAL_POINTS = 3
DEDICATED_POINTS = 6
MARKETPLACE_POINTS = 15
FEATURED_BONUS_POINTS = 5
# 30-minute gate: casual completions under this earn 0 points (anti-farming)
CASUAL_MIN_DURATION_MINUTES = 30

Tier = Literal["casual", "dedicated", "marketplace"]


def resolve_tier(activity: Activity) -> Tier:
    """Marketplace tier is derived from existing commerce fields; the stored
    effort_tier only distinguishes casual from dedicated."""
    if activity.cost_indicator == "paid" or activity.is_partner_content:
        return "marketplace"
    return "dedicated" if activity.effort_tier == "dedicated" else "casual"


def compute_points(activity: Activity, challenge: Challenge, duration_minutes: int | None) -> tuple[int, int]:
    """Return (base_points, bonus_points) for a verified completion."""
    tier = resolve_tier(activity)
    if tier == "marketplace":
        base = MARKETPLACE_POINTS
    elif tier == "dedicated":
        base = DEDICATED_POINTS
    elif duration_minutes is not None and duration_minutes >= CASUAL_MIN_DURATION_MINUTES:
        base = CASUAL_POINTS
    else:
        base = 0  # casual under the 30-minute gate: fills the collage, earns nothing
    bonus = FEATURED_BONUS_POINTS if challenge.is_featured else 0
    return base, bonus


async def get_completion_context(session: AsyncSession, completion: Completion) -> tuple[Activity, Challenge]:
    result = await session.execute(
        select(Activity, Challenge)
        .join(ChallengeActivity, ChallengeActivity.activity_id == Activity.id)
        .join(Challenge, ChallengeActivity.challenge_id == Challenge.id)
        .where(ChallengeActivity.id == completion.challenge_activity_id)
    )
    activity, challenge = result.tuples().one()
    return activity, challenge


async def award_points(session: AsyncSession, completion: Completion) -> int:
    """Create the ledger entry for a verified completion; returns total points
    awarded. Idempotent: a completion that already has a ledger entry (e.g. a
    replayed approval) awards nothing and returns 0. self_reported completions
    never earn points."""
    if completion.status == "self_reported":
        return 0

    activity, challenge = await get_completion_context(session, completion)
    base, bonus = compute_points(activity, challenge, completion.duration_minutes)

    repo = RewardsRepository(session)
    inserted = await repo.create_ledger_entry(
        family_id=completion.family_id,
        completion_id=completion.id,
        base_points=base,
        bonus_points=bonus,
        awarded_at=datetime.now(timezone.utc),
    )
    return (base + bonus) if inserted else 0


async def get_activity_for_slot(session: AsyncSession, challenge_activity_id: uuid.UUID) -> Activity | None:
    result = await session.execute(
        select(Activity)
        .join(ChallengeActivity, ChallengeActivity.activity_id == Activity.id)
        .where(ChallengeActivity.id == challenge_activity_id)
    )
    return result.scalar_one_or_none()
