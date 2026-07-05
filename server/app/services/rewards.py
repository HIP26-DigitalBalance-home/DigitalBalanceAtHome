"""Quarter balance, reward-level progress, and milestone redemption.

Balances derive from the point ledger for the current calendar quarter (UTC);
nothing carries over. Redemption is a milestone action — it never debits the
balance (uq_redemption_family_level_quarter caps it at once per quarter).
"""

import secrets
import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.rewards import RewardsRepository
from app.services.exceptions import (
    AlreadyRedeemedThisQuarter,
    AnnualCapReached,
    ChoiceRequired,
    LevelLocked,
    NoFamilyError,
    RewardLevelNotFound,
)
from app.services.family import get_user_family
from app.services.localization import pick

# Unambiguous alphabet for voucher codes (no 0/O, 1/I/L)
_VOUCHER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"


def quarter_bounds(now: datetime) -> tuple[datetime, datetime, str]:
    """Return (start, end, key) of the calendar quarter containing `now` (UTC)."""
    quarter = (now.month - 1) // 3 + 1
    start = datetime(now.year, 3 * quarter - 2, 1, tzinfo=timezone.utc)
    if quarter == 4:
        end = datetime(now.year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(now.year, 3 * quarter + 1, 1, tzinfo=timezone.utc)
    return start, end, f"{now.year}-Q{quarter}"


def year_bounds(now: datetime) -> tuple[datetime, datetime]:
    return (
        datetime(now.year, 1, 1, tzinfo=timezone.utc),
        datetime(now.year + 1, 1, 1, tzinfo=timezone.utc),
    )


def _generate_voucher_code() -> str:
    return "BOND-" + "".join(secrets.choice(_VOUCHER_ALPHABET) for _ in range(6))


async def _require_family_id(session: AsyncSession, user_id: uuid.UUID) -> uuid.UUID:
    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must be in a family to view rewards")
    return fm.family_id


async def get_balance_and_progress(session: AsyncSession, user_id: uuid.UUID, language: str = "de") -> dict:
    family_id = await _require_family_id(session, user_id)
    now = datetime.now(timezone.utc)
    quarter_start, quarter_end, quarter_key = quarter_bounds(now)
    year_start, year_end = year_bounds(now)

    repo = RewardsRepository(session)
    balance = await repo.get_quarter_balance(family_id, quarter_start, quarter_end)
    levels = await repo.list_reward_levels()
    redemptions = await repo.list_family_redemptions_quarter(family_id, quarter_key)
    redeemed_level_ids = {r.reward_level_id for r in redemptions}

    level_items = []
    for level in levels:
        if level.id in redeemed_level_ids:
            state = "redeemed_this_quarter"
        elif balance >= level.points_threshold:
            state = "unlocked"
        else:
            state = "locked"

        redemptions_this_year = None
        if level.annual_redemption_cap is not None:
            redemptions_this_year = await repo.count_family_redemptions_year(family_id, level.id, year_start, year_end)

        level_items.append(
            {
                "id": level.id,
                "level_number": level.level_number,
                "points_threshold": level.points_threshold,
                "title": pick(level.title, level.title_en, language),
                "description": pick(level.description, level.description_en, language),
                "choice_options": level.choice_options,
                "annual_redemption_cap": level.annual_redemption_cap,
                "state": state,
                "redemptions_this_year": redemptions_this_year,
            }
        )

    return {"quarter_key": quarter_key, "balance": balance, "levels": level_items}


async def redeem(
    session: AsyncSession,
    user_id: uuid.UUID,
    level_id: uuid.UUID,
    chosen_option: str | None = None,
) -> dict:
    family_id = await _require_family_id(session, user_id)
    now = datetime.now(timezone.utc)
    quarter_start, quarter_end, quarter_key = quarter_bounds(now)

    repo = RewardsRepository(session)
    level = await repo.get_reward_level(level_id)
    if not level:
        raise RewardLevelNotFound(f"Reward level {level_id} not found")

    balance = await repo.get_quarter_balance(family_id, quarter_start, quarter_end)
    if balance < level.points_threshold:
        raise LevelLocked(f"Level {level.level_number} requires {level.points_threshold} points this quarter")

    quarter_redemptions = await repo.list_family_redemptions_quarter(family_id, quarter_key)
    if any(r.reward_level_id == level.id for r in quarter_redemptions):
        raise AlreadyRedeemedThisQuarter("This level has already been redeemed this quarter")

    if level.annual_redemption_cap is not None:
        year_start, year_end = year_bounds(now)
        year_count = await repo.count_family_redemptions_year(family_id, level.id, year_start, year_end)
        if year_count >= level.annual_redemption_cap:
            raise AnnualCapReached(f"This level can only be redeemed {level.annual_redemption_cap} times per year")

    if level.choice_options:
        if not chosen_option:
            raise ChoiceRequired("Please choose one of the reward options")
        if chosen_option not in level.choice_options:
            raise ChoiceRequired(f"Invalid option; choose one of: {', '.join(level.choice_options)}")
    else:
        chosen_option = None

    redemption = await repo.create_redemption(
        family_id=family_id,
        reward_level_id=level.id,
        quarter_key=quarter_key,
        chosen_option=chosen_option,
        points_at_redemption=balance,
        voucher_code=_generate_voucher_code(),
        redeemed_at=now,
    )
    await session.commit()
    return {
        "redemption_id": redemption.id,
        "reward_level_id": redemption.reward_level_id,
        "chosen_option": redemption.chosen_option,
        "voucher_code": redemption.voucher_code,
        "redeemed_at": redemption.redeemed_at,
    }
