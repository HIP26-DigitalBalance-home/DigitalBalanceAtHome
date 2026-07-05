from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.generated import ManualTimeEntry, TimeSpentInsight, TimeSpentPeriod, UpsertManualTimeRequest
from app.services import time_spent as time_spent_service

router = APIRouter()


@router.get("", response_model=TimeSpentInsight)
async def get_time_spent_insight(
    period: TimeSpentPeriod,
    anchor_date: date,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await time_spent_service.get_insight(session, current_user.id, period.value, anchor_date)


@router.put("/manual", response_model=ManualTimeEntry)
async def upsert_manual_time(
    body: UpsertManualTimeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return await time_spent_service.upsert_manual_time(session, current_user.id, body.entry_date, body.minutes)
