import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.journal_entry import JournalEntry
from app.repositories.journal import JournalRepository
from app.services.exceptions import InvalidDateRange, JournalEntryExists


async def create_entry(session: AsyncSession, user_id: uuid.UUID, entry_date: date, mood: str) -> JournalEntry:
    repo = JournalRepository(session)
    existing = await repo.get_by_user_and_date(user_id, entry_date)
    if existing is not None:
        raise JournalEntryExists("Journal entry already exists for this date")
    return await repo.create(user_id, entry_date, mood)


async def list_entries(
    session: AsyncSession, user_id: uuid.UUID, start_date: date, end_date: date
) -> list[JournalEntry]:
    if end_date < start_date:
        raise InvalidDateRange("end_date must be on or after start_date")
    repo = JournalRepository(session)
    return await repo.list_by_date_range(user_id, start_date, end_date)
