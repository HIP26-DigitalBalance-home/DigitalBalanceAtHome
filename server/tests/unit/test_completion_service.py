import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.services import completion
from app.services.exceptions import DurationRequired


@pytest.mark.asyncio
async def test_self_reported_persists_duration_and_local_date(monkeypatch):
    user_id = uuid.uuid4()
    family_id = uuid.uuid4()
    slot_id = uuid.uuid4()
    completed_on = date(2026, 7, 5)
    created = SimpleNamespace(
        id=uuid.uuid4(),
        challenge_activity_id=slot_id,
        family_id=family_id,
        completed_by_user_id=user_id,
        status="self_reported",
        photo_key=None,
        caption=None,
        duration_minutes=75,
        completed_on=completed_on,
        shared_to_feed=False,
        completed_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    repo = SimpleNamespace(create=AsyncMock(return_value=created))
    monkeypatch.setattr(completion, "get_user_family", AsyncMock(return_value=SimpleNamespace(family_id=family_id)))
    monkeypatch.setattr(completion, "_resolve_slot", AsyncMock())
    monkeypatch.setattr(completion, "CompletionRepository", lambda session: repo)
    monkeypatch.setattr("app.services.progress.update_streak_on_completion", AsyncMock())
    session = AsyncMock()

    result = await completion.create_self_reported(session, user_id, slot_id, None, False, 75, completed_on)

    assert result["duration_minutes"] == 75
    assert result["completed_on"] == completed_on
    assert repo.create.await_args.kwargs["duration_minutes"] == 75
    assert repo.create.await_args.kwargs["completed_on"] == completed_on


@pytest.mark.asyncio
async def test_self_reported_never_invokes_points(monkeypatch):
    user_id = uuid.uuid4()
    family_id = uuid.uuid4()
    slot_id = uuid.uuid4()
    created = SimpleNamespace(
        id=uuid.uuid4(),
        challenge_activity_id=slot_id,
        family_id=family_id,
        completed_by_user_id=user_id,
        status="self_reported",
        photo_key=None,
        caption=None,
        duration_minutes=30,
        completed_on=date(2026, 7, 5),
        shared_to_feed=False,
        completed_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    monkeypatch.setattr(completion, "get_user_family", AsyncMock(return_value=SimpleNamespace(family_id=family_id)))
    monkeypatch.setattr(completion, "_resolve_slot", AsyncMock())
    monkeypatch.setattr(
        completion,
        "CompletionRepository",
        lambda session: SimpleNamespace(create=AsyncMock(return_value=created)),
    )
    monkeypatch.setattr("app.services.progress.update_streak_on_completion", AsyncMock())
    award = AsyncMock()
    monkeypatch.setattr("app.services.points.award_points", award)

    await completion.create_self_reported(
        AsyncMock(),
        user_id,
        slot_id,
        None,
        False,
        30,
        date(2026, 7, 5),
    )

    award.assert_not_awaited()


@pytest.mark.asyncio
async def test_casual_photo_completion_still_requires_duration(monkeypatch):
    user_id = uuid.uuid4()
    family_id = uuid.uuid4()
    slot_id = uuid.uuid4()
    repo = SimpleNamespace(count_photo_completions=AsyncMock(return_value=0))
    monkeypatch.setattr(completion, "get_user_family", AsyncMock(return_value=SimpleNamespace(family_id=family_id)))
    monkeypatch.setattr(completion, "_resolve_slot", AsyncMock())
    monkeypatch.setattr(completion, "CompletionRepository", lambda session: repo)
    monkeypatch.setattr(
        "app.services.points.get_activity_for_slot",
        AsyncMock(
            return_value=SimpleNamespace(
                effort_tier="casual",
                cost_indicator="free",
                is_partner_content=False,
            )
        ),
    )

    with pytest.raises(DurationRequired):
        await completion.start_photo_completion(
            AsyncMock(),
            user_id,
            slot_id,
            b"jpeg-data",
            "image/jpeg",
            None,
            False,
            None,
            date(2026, 7, 5),
        )
