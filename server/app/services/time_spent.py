import uuid
from calendar import monthrange
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.time_spent import TimeSpentRepository
from app.services.exceptions import InvalidDuration


def period_bounds(period: str, anchor_date: date) -> tuple[date, date]:
    """Full calendar week/month for the anchor date, regardless of today's date.

    The displayed range always covers the whole period — including any days
    still in the future — so the chart always shows 7 day-bars (weekly) or
    every calendar-week bucket in the month (monthly). Callers that need to
    exclude not-yet-happened days (e.g. for averages) should use the
    `elapsed_end` value returned by `build_insight` instead of clipping here.
    """
    if period == "weekly":
        start = anchor_date - timedelta(days=anchor_date.weekday())
        return start, start + timedelta(days=6)
    if period != "monthly":
        raise ValueError(f"Unsupported period: {period}")

    start = anchor_date.replace(day=1)
    end = anchor_date.replace(day=monthrange(anchor_date.year, anchor_date.month)[1])
    return start, end


def build_insight(
    period: str,
    anchor_date: date,
    activity_totals: dict[date, int],
    manual_totals: dict[date, int],
    today: date | None = None,
) -> dict:
    today = today or date.today()
    start_date, end_date = period_bounds(period, anchor_date)
    elapsed_end = min(end_date, today)
    daily_totals: list[dict] = []
    cursor = start_date
    while cursor <= end_date:
        activity_minutes = activity_totals.get(cursor, 0)
        manual_minutes = manual_totals.get(cursor, 0)
        daily_totals.append(
            {
                "date": cursor,
                "activity_minutes": activity_minutes,
                "manual_minutes": manual_minutes,
                "total_minutes": activity_minutes + manual_minutes,
            }
        )
        cursor += timedelta(days=1)

    weekly_totals: list[dict] = []
    average_weekly_minutes: int | None = None
    if period == "monthly":
        daily_by_date = {item["date"]: item["total_minutes"] for item in daily_totals}
        cursor = start_date
        while cursor <= end_date:
            days_until_sunday = 6 - cursor.weekday()
            bucket_end = min(end_date, cursor + timedelta(days=days_until_sunday))
            bucket_total = 0
            bucket_cursor = cursor
            while bucket_cursor <= bucket_end:
                bucket_total += daily_by_date[bucket_cursor]
                bucket_cursor += timedelta(days=1)
            weekly_totals.append({"start_date": cursor, "end_date": bucket_end, "total_minutes": bucket_total})
            cursor = bucket_end + timedelta(days=1)

        if weekly_totals:
            total = sum(item["total_minutes"] for item in weekly_totals)
            count = len(weekly_totals)
            average_weekly_minutes = (total + count // 2) // count

    return {
        "period": period,
        "range_start": start_date,
        "range_end": end_date,
        "elapsed_end": elapsed_end,
        "daily_totals": daily_totals,
        "weekly_totals": weekly_totals,
        "average_weekly_minutes": average_weekly_minutes,
    }


async def get_insight(session: AsyncSession, user_id: uuid.UUID, period: str, anchor_date: date) -> dict:
    start_date, end_date = period_bounds(period, anchor_date)
    repo = TimeSpentRepository(session)
    activity_totals = await repo.get_activity_totals(user_id, start_date, end_date)
    manual_totals = await repo.get_manual_totals(user_id, start_date, end_date)
    return build_insight(period, anchor_date, activity_totals, manual_totals)


async def upsert_manual_time(session: AsyncSession, user_id: uuid.UUID, entry_date: date, minutes: int):
    if minutes < 1 or minutes > 1440:
        raise InvalidDuration("Time spent must be between 1 and 1,440 minutes")
    repo = TimeSpentRepository(session)
    entry = await repo.upsert_manual_time(user_id, entry_date, minutes)
    await session.commit()
    return entry
