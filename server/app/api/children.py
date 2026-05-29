from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.generated import ChildProfile, CreateChildRequest, UpdateChildRequest
from app.services import child_profile as child_service

router = APIRouter()


def _child_schema(child) -> dict:
    return {
        "id": child.id,
        "family_id": child.family_id,
        "nickname": child.nickname,
        "date_of_birth": child.date_of_birth,
        "interests": child.interests or [],
        "created_at": child.created_at,
        "updated_at": child.updated_at,
    }


@router.post("", response_model=ChildProfile, status_code=201)
async def create_child(
    body: CreateChildRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    child = await child_service.create_child(session, current_user.id, body)
    return _child_schema(child)


@router.get("", response_model=list[ChildProfile])
async def get_children(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    children = await child_service.get_children(session, current_user.id)
    return [_child_schema(c) for c in children]


@router.patch("/{child_id}", response_model=ChildProfile)
async def update_child(
    child_id: UUID,
    body: UpdateChildRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    child = await child_service.update_child(session, child_id, current_user.id, body)
    return _child_schema(child)


@router.delete("/{child_id}", status_code=204)
async def delete_child(
    child_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await child_service.delete_child(session, child_id, current_user.id)
