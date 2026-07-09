import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import activity as activity_service


async def test_suggestion_randomly_selects_from_incomplete_family_activities(mocker):
    family_id = uuid.uuid4()
    user_id = uuid.uuid4()
    membership = MagicMock(family_id=family_id)
    first = MagicMock()
    second = MagicMock()
    repository = MagicMock()
    repository.get_all = AsyncMock(return_value=[first, second])

    mocker.patch.object(activity_service, "get_user_family", AsyncMock(return_value=membership))
    mocker.patch.object(activity_service, "ActivityRepository", return_value=repository)
    choose = mocker.patch.object(activity_service.random, "choice", return_value=second)

    result = await activity_service.get_suggestion(
        AsyncMock(),
        user_id=user_id,
        child_id=None,
    )

    assert result is second
    choose.assert_called_once_with([first, second])
    repository.get_all.assert_awaited_once_with(
        age=None,
        season=activity_service._current_season(),
        exclude_paid=True,
        family_id=family_id,
        exclude_completed_for_family_id=family_id,
    )


async def test_create_activity_family_cap_reached(mocker):
    from app.services.exceptions import ActivityLimitReached

    membership = MagicMock(family_id=uuid.uuid4())
    repository = MagicMock()
    repository.count_custom_for_family = AsyncMock(return_value=200)
    mocker.patch.object(activity_service, "get_user_family", AsyncMock(return_value=membership))
    mocker.patch.object(activity_service, "ActivityRepository", return_value=repository)
    lock = mocker.patch.object(activity_service, "lock_family_quota", AsyncMock())

    with pytest.raises(ActivityLimitReached):
        await activity_service.create_activity(AsyncMock(), uuid.uuid4(), MagicMock())

    lock.assert_awaited_once()
    repository.create.assert_not_called()
