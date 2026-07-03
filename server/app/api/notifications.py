from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.dependencies.language import get_request_language
from app.models.user import User
from app.schemas.generated import NotificationItem
from app.services import notification as notification_service

router = APIRouter()


@router.get("", response_model=list[NotificationItem])
async def list_notifications(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    language: str = Depends(get_request_language),
) -> list[dict]:
    return await notification_service.get_notifications(session, current_user.id, language)


@router.post("/read", status_code=204)
async def mark_notifications_read(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await notification_service.mark_all_read(session, current_user.id)
