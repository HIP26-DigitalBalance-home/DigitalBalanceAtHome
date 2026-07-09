"""Recovery sweep for photos stuck in "processing".

Compression runs as an in-process background task and dies with the
container. This sweep re-runs it for any photo row that has been sitting in
"processing" too long. Rows whose raw photo turned out to be poisonous have
photo_key cleared by the compression task itself, so they are never retried.
"""

from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_resource_photo import ActivityResourcePhoto
from app.models.completion import Completion

logger = structlog.get_logger()

STUCK_AFTER = timedelta(minutes=15)
_BATCH_LIMIT = 20


def _final_key_for(raw_key: str) -> str:
    # raw/{family_id}/{photo_id}.jpg -> photos/{family_id}/{photo_id}.jpg
    return "photos/" + raw_key.removeprefix("raw/")


async def run_photo_recovery(session: AsyncSession) -> None:
    from app.repositories.rate_limit import RateLimitRepository
    from app.services import activity_resource
    from app.services import completion as completion_service

    cutoff = datetime.now(timezone.utc) - STUCK_AFTER

    result = await session.execute(
        select(Completion.id, Completion.photo_key)
        .where(
            Completion.status == "processing",
            Completion.photo_key.is_not(None),
            Completion.photo_key.like("raw/%"),
            Completion.updated_at < cutoff,
        )
        .limit(_BATCH_LIMIT)
    )
    for completion_id, raw_key in result.all():
        logger.info("photo_recovery_retry", completion_id=str(completion_id), raw_key=raw_key)
        # update_streak=False: recovery can run long after the upload day,
        # and re-uploads must never bump the streak twice
        await completion_service.compress_photo(completion_id, raw_key, _final_key_for(raw_key), update_streak=False)

    result = await session.execute(
        select(ActivityResourcePhoto.id, ActivityResourcePhoto.photo_key)
        .where(
            ActivityResourcePhoto.status == "processing",
            ActivityResourcePhoto.photo_key.is_not(None),
            ActivityResourcePhoto.photo_key.like("raw/%"),
            ActivityResourcePhoto.updated_at < cutoff,
        )
        .limit(_BATCH_LIMIT)
    )
    for photo_id, raw_key in result.all():
        logger.info("resource_photo_recovery_retry", photo_id=str(photo_id), raw_key=raw_key)
        await activity_resource.compress_resource_photo(photo_id, raw_key, _final_key_for(raw_key))

    # Housekeeping piggybacked on the sweep: drop expired rate-limit windows
    await RateLimitRepository(session).purge_expired()
