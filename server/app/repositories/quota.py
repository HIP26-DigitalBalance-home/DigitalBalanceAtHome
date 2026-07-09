import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def lock_family_quota(session: AsyncSession, family_id: uuid.UUID) -> None:
    """Serialize quota check + insert for one family.

    Takes a transaction-scoped Postgres advisory lock so that concurrent
    count-then-create sequences cannot race past a quota. Released
    automatically at commit/rollback.
    """
    await session.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
        {"key": f"quota:{family_id}"},
    )
