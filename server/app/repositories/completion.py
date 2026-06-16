import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.challenge import Challenge, ChallengeActivity
from app.models.completion import Completion
from app.models.family import Family


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

    async def count_photo_completions(self, family_id: uuid.UUID) -> int:
        """Count completions with a photo (processing or ready) for a family."""
        result = await self.session.execute(
            select(func.count())
            .select_from(Completion)
            .where(
                Completion.family_id == family_id,
                Completion.status.in_(["processing", "ready"]),
            )
        )
        return result.scalar_one()

    async def get_by_id(self, completion_id: uuid.UUID) -> Completion | None:
        result = await self.session.execute(select(Completion).where(Completion.id == completion_id))
        return result.scalar_one_or_none()

    async def update(self, completion: Completion, **kwargs) -> Completion:
        for key, value in kwargs.items():
            setattr(completion, key, value)
        await self.session.flush()
        return completion

    async def get_by_family(
        self, family_id: uuid.UUID, limit: int = 20, offset: int = 0
    ) -> list[tuple["Completion", str, str | None, str, str | None]]:
        """Return (Completion, activity_title, activity_title_en, challenge_title, challenge_title_en)."""
        stmt = (
            select(Completion, Activity.title, Activity.title_en, Challenge.title, Challenge.title_en)
            .join(ChallengeActivity, Completion.challenge_activity_id == ChallengeActivity.id)
            .join(Challenge, ChallengeActivity.challenge_id == Challenge.id)
            .join(Activity, ChallengeActivity.activity_id == Activity.id)
            .where(Completion.family_id == family_id)
            .order_by(Completion.completed_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.tuples().all())

    async def get_group_feed(
        self, group_id: uuid.UUID, limit: int = 20, offset: int = 0
    ) -> list[tuple[Completion, str, str | None, str | None]]:
        """Return (Completion, activity_title, activity_title_en, family_name) for shared feed entries."""
        stmt = (
            select(Completion, Activity.title, Activity.title_en, Family.name)
            .join(ChallengeActivity, Completion.challenge_activity_id == ChallengeActivity.id)
            .join(Challenge, ChallengeActivity.challenge_id == Challenge.id)
            .join(Activity, ChallengeActivity.activity_id == Activity.id)
            .join(Family, Completion.family_id == Family.id)
            .where(
                Challenge.group_id == group_id,
                Completion.shared_to_feed.is_(True),
            )
            .order_by(Completion.completed_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.tuples().all())
