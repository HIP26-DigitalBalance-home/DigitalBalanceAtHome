import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.dependencies.language import get_request_language
from app.models.user import User
from app.schemas.generated import (
    ChallengeParticipant,
    ChallengeSummary,
    ChallengeWithProgress,
    CreateChallengeRequest,
    InviteParticipantRequest,
    UpdateChallengeRequest,
)
from app.services import challenge as challenge_service

router = APIRouter()


@router.post("", status_code=201, response_model=ChallengeWithProgress)
async def create_challenge(
    payload: CreateChallengeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    language: str = Depends(get_request_language),
) -> dict:
    return await challenge_service.create_challenge(session, current_user.id, payload, language)


@router.get("/active", response_model=list[ChallengeWithProgress])
async def get_active_challenges(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    language: str = Depends(get_request_language),
) -> list[dict]:
    return await challenge_service.get_active_challenges(session, current_user.id, language)


@router.get("/me", response_model=list[ChallengeSummary])
async def get_my_challenges(
    status: Optional[str] = Query(None, pattern="^(active|completed)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    language: str = Depends(get_request_language),
) -> list[dict]:
    return await challenge_service.get_my_challenges(session, current_user.id, status, language)


@router.delete("/{challenge_id}", status_code=204)
async def delete_challenge(
    challenge_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await challenge_service.delete_challenge(session, current_user.id, challenge_id)


@router.get("/{challenge_id}", response_model=ChallengeWithProgress)
async def get_challenge(
    challenge_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    language: str = Depends(get_request_language),
) -> dict:
    return await challenge_service.get_challenge(session, current_user.id, challenge_id, language)


@router.patch("/{challenge_id}", response_model=ChallengeWithProgress)
async def update_challenge(
    challenge_id: uuid.UUID,
    payload: UpdateChallengeRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    language: str = Depends(get_request_language),
) -> dict:
    return await challenge_service.update_challenge(
        session, current_user.id, challenge_id, payload.is_private, language
    )


@router.get("/{challenge_id}/participants", response_model=list[ChallengeParticipant])
async def list_challenge_participants(
    challenge_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await challenge_service.get_participants(session, current_user.id, challenge_id)


@router.post("/{challenge_id}/participants", status_code=201, response_model=ChallengeParticipant)
async def invite_challenge_participant(
    challenge_id: uuid.UUID,
    payload: InviteParticipantRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await challenge_service.invite_participant(
        session, current_user.id, challenge_id, uuid.UUID(str(payload.user_id))
    )
