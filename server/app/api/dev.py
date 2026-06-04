from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.services import seed as seed_service

router = APIRouter()


@router.post("/seed", status_code=200)
async def seed_demo(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if not settings.SEED_ENABLED:
        raise HTTPException(status_code=404, detail="Not found")
    await seed_service.seed_demo_data(session, current_user)
    return {"message": "Demo data seeded successfully"}
