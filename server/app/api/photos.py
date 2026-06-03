import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.generated import PhotoUploadResponse, PhotoUrlResponse
from app.services import completion as completion_service

router = APIRouter()

_MAX_SIZE = 10 * 1024 * 1024  # 10 MB
_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg"}


@router.post("", status_code=202, response_model=PhotoUploadResponse)
async def upload_photo(
    background_tasks: BackgroundTasks,
    challenge_activity_id: uuid.UUID = Form(...),
    image: UploadFile = File(...),
    caption: str | None = Form(None),
    shared_to_feed: bool = Form(False),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if image.content_type not in _ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG and PNG images are accepted")

    photo_data = await image.read()
    if len(photo_data) > _MAX_SIZE:
        raise HTTPException(status_code=400, detail="Image must be 10 MB or smaller")

    completion, raw_key, final_key = await completion_service.start_photo_completion(
        session,
        current_user.id,
        challenge_activity_id,
        photo_data,
        image.content_type or "image/jpeg",
        caption,
        shared_to_feed,
    )

    background_tasks.add_task(
        completion_service.compress_photo,
        completion.id,
        raw_key,
        final_key,
        settings.DATABASE_URL,
    )

    return {"completion_id": completion.id}


@router.get("/{completion_id}/url", response_model=PhotoUrlResponse)
async def get_photo_url(
    completion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await completion_service.get_photo_url(session, current_user.id, completion_id)


@router.get("/{completion_id}/image")
async def get_photo_image(
    completion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Proxy the photo bytes from S3 so the client can use them in a canvas (no CORS issues)."""
    from fastapi.responses import Response
    from app.core import storage

    photo_key = await completion_service.get_photo_key(session, current_user.id, completion_id)
    data = storage.download_bytes(photo_key)
    return Response(content=data, media_type="image/jpeg")
