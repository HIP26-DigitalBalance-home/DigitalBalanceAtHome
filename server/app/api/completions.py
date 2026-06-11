import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user, get_current_user_with_consent_check
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.generated import Completion, CompletionHistoryItem, CreateCompletionRequest
from app.services import completion as completion_service

router = APIRouter()


@router.post("", status_code=201, response_model=Completion)
async def create_completion(
    payload: CreateCompletionRequest,
    current_user: User = Depends(get_current_user_with_consent_check),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await completion_service.create_self_reported(
        session,
        current_user.id,
        uuid.UUID(str(payload.challenge_activity_id)),
        payload.caption,
        payload.shared_to_feed or False,
    )


@router.delete("/{completion_id}", status_code=204)
async def delete_completion(
    completion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await completion_service.delete_completion(session, current_user.id, completion_id)


@router.get("/me", response_model=list[CompletionHistoryItem])
async def get_my_completions(
    limit: int = 20,
    offset: int = 0,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await completion_service.get_my_history(session, current_user.id, limit, offset)


@router.get("/{completion_id}", response_model=Completion)
async def get_completion(
    completion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await completion_service.get_completion(session, current_user.id, completion_id)
