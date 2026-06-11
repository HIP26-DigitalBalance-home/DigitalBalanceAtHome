from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.generated import User as UserSchema
from app.services import user as user_service

router = APIRouter()

_MAX_SIZE = 10 * 1024 * 1024
_ALLOWED_TYPES = {"image/jpeg", "image/png", "image/jpg"}


@router.get("/me", response_model=UserSchema)
async def get_me(
    current_user: User = Depends(get_current_user),
) -> dict:
    return user_service.get_me(current_user)


@router.patch("/me", response_model=UserSchema)
async def update_me(
    display_name: str | None = Form(None),
    image: UploadFile | None = File(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if display_name is None and image is None:
        raise HTTPException(status_code=400, detail="Provide at least display_name or image")

    image_data: bytes | None = None
    content_type: str | None = None

    if image is not None:
        if image.content_type not in _ALLOWED_TYPES:
            raise HTTPException(status_code=400, detail="Only JPEG and PNG images are accepted")
        image_data = await image.read()
        if len(image_data) > _MAX_SIZE:
            raise HTTPException(status_code=400, detail="Image must be 10 MB or smaller")
        content_type = image.content_type

    return await user_service.update_me(session, current_user, display_name, image_data, content_type)


@router.delete("/me", status_code=202)
async def delete_me():
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/me/cancel-deletion")
async def cancel_deletion():
    raise HTTPException(status_code=501, detail="Not implemented")


@router.get("/me/export")
async def export_data():
    raise HTTPException(status_code=501, detail="Not implemented")
