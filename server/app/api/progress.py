from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.repositories.family import FamilyRepository
from app.schemas.generated import FamilyProgress, FamilySettingsUpdate
from app.services import progress as progress_service
from app.services.exceptions import NoFamilyError

router = APIRouter()


async def _assert_family_member(family_id: UUID, user: User, session: AsyncSession) -> None:
    repo = FamilyRepository(session)
    membership = await repo.get_membership(family_id, user.id)
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this family")


@router.get("/{family_id}/progress", response_model=FamilyProgress)
async def get_family_progress(
    family_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    await _assert_family_member(family_id, current_user, session)
    try:
        return await progress_service.get_progress(family_id, session)
    except NoFamilyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.patch("/{family_id}/settings", status_code=204)
async def update_family_settings(
    family_id: UUID,
    body: FamilySettingsUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await _assert_family_member(family_id, current_user, session)
    if body.weekly_goal is not None:
        if body.weekly_goal < 1:
            raise HTTPException(status_code=400, detail="weekly_goal must be at least 1")
        try:
            await progress_service.update_settings(family_id, body.weekly_goal, session)
        except NoFamilyError as e:
            raise HTTPException(status_code=404, detail=str(e))
