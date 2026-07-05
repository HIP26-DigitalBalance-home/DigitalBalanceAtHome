import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.auth import get_current_user, get_current_user_with_consent_check
from app.dependencies.database import get_db
from app.dependencies.language import get_request_language
from app.models.user import User
from app.schemas.generated import (
    Completion,
    CompletionHistoryItem,
    CreateCompletionRequest,
    ReuploadResponse,
)
from app.services import completion as completion_service

router = APIRouter()

_MAX_SIZE = 10 * 1024 * 1024  # 10 MB
_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg"}


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
    language: str = Depends(get_request_language),
) -> list[dict]:
    return await completion_service.get_my_history(session, current_user.id, limit, offset, language)


@router.get("/{completion_id}", response_model=Completion)
async def get_completion(
    completion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await completion_service.get_completion(session, current_user.id, completion_id)


@router.patch("/{completion_id}/photo", status_code=202, response_model=ReuploadResponse)
async def reupload_completion_photo(
    completion_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user_with_consent_check),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if image.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG and PNG images are accepted")

    photo_data = await image.read()
    if len(photo_data) > _MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image must be 10 MB or smaller")

    completion, raw_key, final_key, preserve_status, old_key = await completion_service.update_photo(
        session,
        current_user.id,
        completion_id,
        photo_data,
        image.content_type or "image/jpeg",
    )

    background_tasks.add_task(
        completion_service.compress_photo,
        completion.id,
        raw_key,
        final_key,
        settings.DATABASE_URL,
        preserve_status,
        False,  # re-uploads don't bump the streak again
        old_key,
    )

    return {"completion_id": completion.id, "status": completion.status}
