import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from app.repositories.time_spent import TimeSpentRepository
from app.services import time_spent
from app.services.exceptions import InvalidDuration


def test_weekly_bounds_are_monday_to_sunday():
    assert time_spent.period_bounds("weekly", date(2026, 7, 8)) == (date(2026, 7, 6), date(2026, 7, 12))


def test_past_month_uses_full_month():
    assert time_spent.period_bounds("monthly", date(2026, 6, 14)) == (
        date(2026, 6, 1),
        date(2026, 6, 30),
    )


def test_current_month_still_uses_full_month_even_though_part_is_future():
    assert time_spent.period_bounds("monthly", date(2026, 7, 5)) == (
        date(2026, 7, 1),
        date(2026, 7, 31),
    )


def test_build_weekly_insight_merges_sources_and_zero_fills():
    result = time_spent.build_insight(
        "weekly",
        date(2026, 7, 8),
        {date(2026, 7, 6): 30, date(2026, 7, 7): 60},
        {date(2026, 7, 6): 15, date(2026, 7, 8): 20},
        today=date(2026, 7, 8),
    )

    assert len(result["daily_totals"]) == 7
    assert result["daily_totals"][0] == {
        "date": date(2026, 7, 6),
        "activity_minutes": 30,
        "manual_minutes": 15,
        "total_minutes": 45,
    }
    assert result["daily_totals"][3]["total_minutes"] == 0
    assert result["weekly_totals"] == []
    assert result["average_weekly_minutes"] is None
    assert result["elapsed_end"] == date(2026, 7, 8)


def test_build_monthly_insight_clips_buckets_and_rounds_half_up():
    result = time_spent.build_insight(
        "monthly",
        date(2026, 7, 31),
        {date(2026, 7, 1): 10, date(2026, 7, 7): 11},
        {},
        today=date(2026, 8, 1),
    )

    assert result["weekly_totals"][0]["start_date"] == date(2026, 7, 1)
    assert result["weekly_totals"][0]["end_date"] == date(2026, 7, 5)
    assert result["weekly_totals"][-1]["end_date"] == date(2026, 7, 31)
    assert result["average_weekly_minutes"] == 4  # 21 / 5 = 4.2


def test_build_monthly_insight_includes_future_weeks_for_the_current_month():
    result = time_spent.build_insight(
        "monthly",
        date(2026, 7, 5),
        {date(2026, 7, 1): 10},
        {},
        today=date(2026, 7, 5),
    )

    assert result["range_start"] == date(2026, 7, 1)
    assert result["range_end"] == date(2026, 7, 31)
    assert result["elapsed_end"] == date(2026, 7, 5)
    assert len(result["daily_totals"]) == 31
    assert len(result["weekly_totals"]) == 5
    assert result["weekly_totals"][-1]["start_date"] == date(2026, 7, 27)
    assert result["weekly_totals"][-1]["end_date"] == date(2026, 7, 31)
    assert result["weekly_totals"][-1]["total_minutes"] == 0


@pytest.mark.asyncio
async def test_get_insight_scopes_repository_to_current_user(monkeypatch):
    user_id = uuid.uuid4()
    repo = SimpleNamespace(
        get_activity_totals=AsyncMock(return_value={date(2026, 7, 6): 30}),
        get_manual_totals=AsyncMock(return_value={date(2026, 7, 6): 15}),
    )
    monkeypatch.setattr(time_spent, "TimeSpentRepository", lambda session: repo)

    result = await time_spent.get_insight(AsyncMock(), user_id, "weekly", date(2026, 7, 6))

    assert result["daily_totals"][0]["total_minutes"] == 45
    repo.get_activity_totals.assert_awaited_once_with(user_id, date(2026, 7, 6), date(2026, 7, 12))
    repo.get_manual_totals.assert_awaited_once_with(user_id, date(2026, 7, 6), date(2026, 7, 12))


@pytest.mark.asyncio
async def test_upsert_manual_time_commits_and_returns_entry(monkeypatch):
    entry = SimpleNamespace(
        id=uuid.uuid4(),
        entry_date=date(2026, 7, 5),
        minutes=45,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    repo = SimpleNamespace(upsert_manual_time=AsyncMock(return_value=entry))
    session = AsyncMock()
    monkeypatch.setattr(time_spent, "TimeSpentRepository", lambda session: repo)

    result = await time_spent.upsert_manual_time(session, uuid.uuid4(), date(2026, 7, 5), 45)

    assert result is entry
    session.commit.assert_awaited_once()


@pytest.mark.asyncio
@pytest.mark.parametrize("minutes", [0, -1, 1441])
async def test_upsert_manual_time_rejects_invalid_minutes(minutes):
    with pytest.raises(InvalidDuration):
        await time_spent.upsert_manual_time(
            AsyncMock(),
            uuid.uuid4(),
            date(2026, 7, 5),
            minutes,
        )


@pytest.mark.asyncio
async def test_activity_query_prefers_reported_duration_and_falls_back_to_estimate():
    query_result = MagicMock()
    query_result.all.return_value = [(date(2026, 7, 6), 90)]
    session = AsyncMock()
    session.execute.return_value = query_result

    totals = await TimeSpentRepository(session).get_activity_totals(
        uuid.uuid4(),
        date(2026, 7, 6),
        date(2026, 7, 12),
    )

    statement = session.execute.await_args.args[0]
    sql = str(statement.compile(dialect=postgresql.dialect())).lower()
    assert "coalesce(completions.duration_minutes, activities.estimated_duration_minutes)" in sql
    assert "completions.completed_by_user_id" in sql
    assert totals == {date(2026, 7, 6): 90}


@pytest.mark.asyncio
async def test_manual_upsert_is_atomic_on_parent_and_date_constraint():
    entry = SimpleNamespace(minutes=45)
    query_result = MagicMock()
    query_result.scalar_one.return_value = entry
    session = AsyncMock()
    session.execute.return_value = query_result

    result = await TimeSpentRepository(session).upsert_manual_time(
        uuid.uuid4(),
        date(2026, 7, 5),
        45,
    )

    statement = session.execute.await_args.args[0]
    sql = str(statement.compile(dialect=postgresql.dialect())).lower()
    assert "on conflict on constraint uq_manual_time_user_date do update" in sql
    assert result is entry
