import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.rate_limit import RateLimitCounter


class RateLimitRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def hit(self, user_id: uuid.UUID, action: str, window_seconds: int) -> int:
        """Record one request and return the count in the current fixed window.

        The upsert is atomic (INSERT .. ON CONFLICT .. count + 1 RETURNING),
        so concurrent requests each see an accurate, monotonically increasing
        count. Committed immediately: a hit counts even if the request later
        fails.
        """
        epoch = int(datetime.now(timezone.utc).timestamp())
        window_start = datetime.fromtimestamp(epoch - (epoch % window_seconds), tz=timezone.utc)
        stmt = (
            insert(RateLimitCounter)
            .values(user_id=user_id, action=action, window_start=window_start, count=1)
            .on_conflict_do_update(
                index_elements=["user_id", "action", "window_start"],
                set_={"count": RateLimitCounter.count + 1},
            )
            .returning(RateLimitCounter.count)
        )
        result = await self.session.execute(stmt)
        await self.session.commit()
        return int(result.scalar_one())

    async def purge_expired(self, older_than: timedelta = timedelta(days=2)) -> None:
        cutoff = datetime.now(timezone.utc) - older_than
        await self.session.execute(delete(RateLimitCounter).where(RateLimitCounter.window_start < cutoff))
        await self.session.commit()
