from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.generated import Friend
from app.services import friend as friend_service

router = APIRouter()


@router.get("", response_model=list[Friend])
async def list_friends(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    return await friend_service.get_friends(session, current_user.id)
