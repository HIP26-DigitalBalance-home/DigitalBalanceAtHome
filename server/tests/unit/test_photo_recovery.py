import uuid
from unittest.mock import AsyncMock, MagicMock

from app.repositories.rate_limit import RateLimitRepository
from app.services import photo_recovery


def _result(rows: list) -> MagicMock:
    result = MagicMock()
    result.all.return_value = rows
    return result


async def test_stuck_completion_recompressed_with_derived_final_key(mocker):
    completion_id = uuid.uuid4()
    raw_key = "raw/fam-1/photo-1.jpg"
    session = MagicMock()
    session.execute = AsyncMock(side_effect=[_result([(completion_id, raw_key)]), _result([])])

    compress_photo = mocker.patch("app.services.completion.compress_photo", AsyncMock())
    mocker.patch.object(RateLimitRepository, "purge_expired", AsyncMock())

    await photo_recovery.run_photo_recovery(session)

    compress_photo.assert_awaited_once_with(completion_id, raw_key, "photos/fam-1/photo-1.jpg", update_streak=False)


async def test_stuck_resource_photo_recompressed(mocker):
    photo_id = uuid.uuid4()
    raw_key = "raw/fam-2/resource-abc.jpg"
    session = MagicMock()
    session.execute = AsyncMock(side_effect=[_result([]), _result([(photo_id, raw_key)])])

    compress_resource = mocker.patch("app.services.activity_resource.compress_resource_photo", AsyncMock())
    mocker.patch.object(RateLimitRepository, "purge_expired", AsyncMock())

    await photo_recovery.run_photo_recovery(session)

    compress_resource.assert_awaited_once_with(photo_id, raw_key, "photos/fam-2/resource-abc.jpg")


async def test_purges_expired_rate_limit_windows(mocker):
    session = MagicMock()
    session.execute = AsyncMock(side_effect=[_result([]), _result([])])
    purge = mocker.patch.object(RateLimitRepository, "purge_expired", AsyncMock())

    await photo_recovery.run_photo_recovery(session)

    purge.assert_awaited_once()
