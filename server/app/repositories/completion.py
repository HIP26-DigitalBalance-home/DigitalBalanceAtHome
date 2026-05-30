import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.completion import Completion


class CompletionRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        challenge_activity_id: uuid.UUID,
        family_id: uuid.UUID,
        completed_by_user_id: uuid.UUID,
        status: str,
        caption: str | None = None,
        shared_to_feed: bool = False,
        photo_key: str | None = None,
    ) -> Completion:
        completion = Completion(
            challenge_activity_id=challenge_activity_id,
            family_id=family_id,
            completed_by_user_id=completed_by_user_id,
            status=status,
            caption=caption,
            shared_to_feed=shared_to_feed,
            photo_key=photo_key,
            completed_at=datetime.now(timezone.utc),
        )
        self.session.add(completion)
        await self.session.flush()
        return completion

    async def get_by_id(self, completion_id: uuid.UUID) -> Completion | None:
        result = await self.session.execute(
            select(Completion).where(Completion.id == completion_id)
        )
        return result.scalar_one_or_none()

    async def update(self, completion: Completion, **kwargs) -> Completion:
        for key, value in kwargs.items():
            setattr(completion, key, value)
        await self.session.flush()
        return completion
