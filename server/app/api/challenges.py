import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.generated import (
    ChallengeSummary,
    ChallengeWithProgress,
    CreateChallengeRequest,
)
from app.services import challenge as challenge_service

router = APIRouter()


@router.post("", status_code=201, response_model=ChallengeWithProgress)
async def create_challenge(
    payload: CreateChallengeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await challenge_service.create_challenge(session, current_user.id, payload)


@router.get("/active", response_model=ChallengeWithProgress)
async def get_active_challenge(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await challenge_service.get_active_challenge(session, current_user.id)


@router.get("/me", response_model=list[ChallengeSummary])
async def get_my_challenges(
    status: Optional[str] = Query(None, pattern="^(upcoming|active|completed)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await challenge_service.get_my_challenges(session, current_user.id, status)


@router.get("/{challenge_id}", response_model=ChallengeWithProgress)
async def get_challenge(
    challenge_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await challenge_service.get_challenge(session, current_user.id, challenge_id)
