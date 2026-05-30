import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.generated import Completion, CreateCompletionRequest
from app.services import completion as completion_service

router = APIRouter()

_501 = HTTPException(status_code=501, detail="Not implemented")


@router.post("", status_code=201, response_model=Completion)
async def create_completion(
    payload: CreateCompletionRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await completion_service.create_self_reported(
        session,
        current_user.id,
        uuid.UUID(str(payload.challenge_activity_id)),
        payload.caption,
        payload.shared_to_feed or False,
    )


@router.get("/me")
async def get_my_completions():
    raise _501


@router.get("/{completion_id}", response_model=Completion)
async def get_completion(
    completion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await completion_service.get_completion(session, current_user.id, completion_id)
