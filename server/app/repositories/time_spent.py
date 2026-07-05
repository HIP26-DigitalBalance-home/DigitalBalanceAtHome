import uuid
from datetime import date, datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.challenge import ChallengeActivity
from app.models.completion import Completion
from app.models.manual_time_entry import ManualTimeEntry


class TimeSpentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_activity_totals(self, user_id: uuid.UUID, start_date: date, end_date: date) -> dict[date, int]:
        result = await self.session.execute(
            select(
                Completion.completed_on,
                func.sum(func.coalesce(Completion.duration_minutes, Activity.estimated_duration_minutes)),
            )
            .join(ChallengeActivity, Completion.challenge_activity_id == ChallengeActivity.id)
            .join(Activity, ChallengeActivity.activity_id == Activity.id)
            .where(
                Completion.completed_by_user_id == user_id,
                Completion.completed_on >= start_date,
                Completion.completed_on <= end_date,
            )
            .group_by(Completion.completed_on)
        )
        return {entry_date: int(minutes or 0) for entry_date, minutes in result.all()}

    async def get_manual_totals(self, user_id: uuid.UUID, start_date: date, end_date: date) -> dict[date, int]:
        result = await self.session.execute(
            select(ManualTimeEntry.entry_date, ManualTimeEntry.minutes).where(
                ManualTimeEntry.user_id == user_id,
                ManualTimeEntry.entry_date >= start_date,
                ManualTimeEntry.entry_date <= end_date,
            )
        )
        return {entry_date: minutes for entry_date, minutes in result.all()}

    async def upsert_manual_time(self, user_id: uuid.UUID, entry_date: date, minutes: int) -> ManualTimeEntry:
        now = datetime.now(timezone.utc)
        statement = (
            insert(ManualTimeEntry)
            .values(
                id=uuid.uuid4(),
                user_id=user_id,
                entry_date=entry_date,
                minutes=minutes,
                created_at=now,
                updated_at=now,
            )
            .on_conflict_do_update(
                constraint="uq_manual_time_user_date",
                set_={"minutes": minutes, "updated_at": now},
            )
            .returning(ManualTimeEntry)
        )
        result = await self.session.execute(statement)
        return result.scalar_one()
