from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.uploads import read_image_upload
from app.dependencies.auth import get_current_user, get_current_user_allow_pending
from app.dependencies.database import get_db
from app.dependencies.rate_limit import profile_update_limiter
from app.models.user import User
from app.schemas.generated import DataExport, DeletionPendingResponse
from app.schemas.generated import User as UserSchema
from app.services import user as user_service

router = APIRouter()


@router.get("/me", response_model=UserSchema)
async def get_me(
    current_user: User = Depends(get_current_user_allow_pending),
) -> dict:
    return user_service.get_me(current_user)


@router.patch("/me", response_model=UserSchema, dependencies=[Depends(profile_update_limiter)])
async def update_me(
    request: Request,
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
        image_data, content_type = await read_image_upload(request, image, current_user.id)

    return await user_service.update_me(session, current_user, display_name, image_data, content_type)


@router.delete("/me", status_code=202, response_model=DeletionPendingResponse)
async def delete_me(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await user_service.delete_me(session, current_user)


@router.post("/me/cancel-deletion", response_model=UserSchema)
async def cancel_deletion(
    current_user: User = Depends(get_current_user_allow_pending),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await user_service.cancel_deletion(session, current_user)


@router.get("/me/export", response_model=DataExport)
async def export_data(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await user_service.export_data(session, current_user)
