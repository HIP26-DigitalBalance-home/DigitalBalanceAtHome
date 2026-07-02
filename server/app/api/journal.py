from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.journal_entry import JournalEntry as JournalEntryModel
from app.models.user import User
from app.schemas.generated import CreateJournalEntryRequest, JournalEntry
from app.services import journal as journal_service

router = APIRouter()


def _to_response(entry: JournalEntryModel) -> dict:
    return {
        "id": entry.id,
        "entry_date": entry.entry_date,
        "mood": entry.mood,
        "created_at": entry.created_at,
    }


@router.post("/entries", response_model=JournalEntry, status_code=201)
async def create_journal_entry(
    body: CreateJournalEntryRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    entry = await journal_service.create_entry(session, current_user.id, body.entry_date, body.mood.value)
    return _to_response(entry)


@router.get("/entries", response_model=list[JournalEntry])
async def get_journal_entries(
    start_date: date = Query(...),
    end_date: date = Query(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    entries = await journal_service.list_entries(session, current_user.id, start_date, end_date)
    return [_to_response(e) for e in entries]
