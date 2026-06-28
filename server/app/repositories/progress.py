import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.challenge import ChallengeActivity
from app.models.completion import Completion


def _monday_of_current_week() -> datetime:
    now = datetime.now(timezone.utc)
    monday = now - timedelta(days=now.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


class ProgressRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_this_week_stats(self, family_id: uuid.UUID) -> dict:
        monday = _monday_of_current_week()
        result = await self.session.execute(
            select(
                func.count().label("activities"),
                func.count(Completion.photo_key).label("photos"),
            ).where(
                Completion.family_id == family_id,
                Completion.completed_at >= monday,
                Completion.status != "processing",
            )
        )
        row = result.one()
        return {"activities": row.activities, "photos": row.photos}

    async def get_all_time_stats(self, family_id: uuid.UUID) -> dict:
        result = await self.session.execute(
            select(
                func.count().label("activities"),
                func.count(Completion.photo_key).label("photos"),
            ).where(
                Completion.family_id == family_id,
                Completion.status != "processing",
            )
        )
        row = result.one()

        challenges_result = await self.session.execute(
            select(func.count(func.distinct(ChallengeActivity.challenge_id))).where(
                Completion.family_id == family_id,
                Completion.status != "processing",
                Completion.challenge_activity_id == ChallengeActivity.id,
            )
        )
        challenge_count = challenges_result.scalar() or 0

        return {
            "activities": row.activities,
            "photos": row.photos,
            "challenges": challenge_count,
        }
