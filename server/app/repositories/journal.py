import uuid
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.journal_entry import JournalEntry


class JournalRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_user_and_date(self, user_id: uuid.UUID, entry_date: date) -> JournalEntry | None:
        result = await self.session.execute(
            select(JournalEntry).where(
                JournalEntry.user_id == user_id,
                JournalEntry.entry_date == entry_date,
            )
        )
        return result.scalar_one_or_none()

    async def list_by_date_range(self, user_id: uuid.UUID, start_date: date, end_date: date) -> list[JournalEntry]:
        result = await self.session.execute(
            select(JournalEntry)
            .where(
                JournalEntry.user_id == user_id,
                JournalEntry.entry_date >= start_date,
                JournalEntry.entry_date <= end_date,
            )
            .order_by(JournalEntry.entry_date)
        )
        return list(result.scalars().all())

    async def create(self, user_id: uuid.UUID, entry_date: date, mood: str) -> JournalEntry:
        entry = JournalEntry(user_id=user_id, entry_date=entry_date, mood=mood)
        self.session.add(entry)
        await self.session.commit()
        await self.session.refresh(entry)
        return entry
