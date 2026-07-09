import uuid
from datetime import date

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.uploads import read_image_upload
from app.dependencies.auth import get_current_user, get_current_user_with_consent_check
from app.dependencies.database import get_db
from app.dependencies.rate_limit import photo_proxy_limiter, photo_upload_limiter, photo_url_limiter
from app.models.user import User
from app.schemas.generated import PhotoUploadResponse, PhotoUrlResponse
from app.services import completion as completion_service

router = APIRouter()


@router.post("", status_code=202, response_model=PhotoUploadResponse, dependencies=[Depends(photo_upload_limiter)])
async def upload_photo(
    request: Request,
    background_tasks: BackgroundTasks,
    challenge_activity_id: uuid.UUID = Form(...),
    image: UploadFile = File(...),
    caption: str | None = Form(None),
    shared_to_feed: bool = Form(False),
    duration_minutes: int | None = Form(None, ge=1, le=1440),
    completed_on: date = Form(...),
    current_user: User = Depends(get_current_user_with_consent_check),
    session: AsyncSession = Depends(get_db),
) -> dict:
    photo_data, content_type = await read_image_upload(request, image, current_user.id)

    completion, raw_key, final_key = await completion_service.start_photo_completion(
        session,
        current_user.id,
        challenge_activity_id,
        photo_data,
        content_type,
        caption,
        shared_to_feed,
        duration_minutes,
        completed_on,
    )

    background_tasks.add_task(
        completion_service.compress_photo,
        completion.id,
        raw_key,
        final_key,
    )

    return {"completion_id": completion.id}


@router.get("/{completion_id}/url", response_model=PhotoUrlResponse, dependencies=[Depends(photo_url_limiter)])
async def get_photo_url(
    completion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await completion_service.get_photo_url(session, current_user.id, completion_id)


@router.get("/{completion_id}/image", dependencies=[Depends(photo_proxy_limiter)])
async def get_photo_image(
    completion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Proxy the photo bytes from S3 so the client can use them in a canvas (no CORS issues)."""
    from fastapi.responses import Response

    from app.core import storage

    photo_key = await completion_service.get_photo_key(session, current_user.id, completion_id)
    data = await storage.download_bytes_async(photo_key)
    return Response(content=data, media_type="image/jpeg")
