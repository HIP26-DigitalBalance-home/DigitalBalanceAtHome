from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.generated import (
    CreateFamilyRequest,
    Family,
    FamilyCreatedResponse,
    FamilyMember,
    InviteResponse,
    JoinByTokenRequest,
)
from app.repositories.family import FamilyRepository
from app.services import family as family_service

router = APIRouter()


async def _build_family_response(session: AsyncSession, family, memberships) -> dict:
    """Build a Family response dict with real User display names."""
    user_ids = [m.user_id for m in memberships]
    user_map: dict = {}
    if user_ids:
        result = await session.execute(select(User).where(User.id.in_(user_ids)))
        user_map = {u.id: u for u in result.scalars().all()}

    members = [
        {
            "user_id": m.user_id,
            "display_name": user_map[m.user_id].display_name if m.user_id in user_map else "",
            "profile_photo_url": None,
            "joined_at": m.joined_at,
        }
        for m in memberships
    ]
    return {
        "id": family.id,
        "name": family.name,
        "members": members,
        "created_at": family.created_at,
    }


def _member_schema(m, user: User | None = None) -> dict:
    return {
        "user_id": m.user_id,
        "display_name": user.display_name if user else "",
        "profile_photo_url": None,
        "joined_at": m.joined_at,
    }


@router.post("", response_model=FamilyCreatedResponse, status_code=201)
async def create_family(
    body: CreateFamilyRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    family, membership = await family_service.create_family(session, current_user.id, body)
    repo = FamilyRepository(session)
    members = await repo.get_memberships_for_family(family.id)
    return {
        "family": await _build_family_response(session, family, members),
        "membership": _member_schema(membership, current_user),
    }


@router.get("/me", response_model=list[Family])
async def get_my_families(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    pairs = await family_service.get_families_for_user(session, current_user.id)
    repo = FamilyRepository(session)
    result = []
    for family, _ in pairs:
        members = await repo.get_memberships_for_family(family.id)
        result.append(await _build_family_response(session, family, members))
    return result


@router.post("/join", response_model=FamilyCreatedResponse)
async def join_family(
    body: JoinByTokenRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    family, membership = await family_service.join_family(session, body.token, current_user.id)
    repo = FamilyRepository(session)
    members = await repo.get_memberships_for_family(family.id)
    return {
        "family": await _build_family_response(session, family, members),
        "membership": _member_schema(membership, current_user),
    }


@router.get("/{family_id}", response_model=Family)
async def get_family(
    family_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    family, members = await family_service.get_family(session, family_id, current_user.id)
    return await _build_family_response(session, family, members)


@router.post("/{family_id}/invites", response_model=InviteResponse, status_code=201)
async def create_family_invite(
    family_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    invite = await family_service.create_family_invite(session, family_id, current_user.id)
    invite_url = f"{settings.CLIENT_BASE_URL}/join-family?token={invite.token}"
    return {"invite_url": invite_url, "expires_at": invite.expires_at}


@router.delete("/{family_id}/members/{user_id}", status_code=204)
async def leave_family(
    family_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    if user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only remove yourself from a family")
    await family_service.leave_family(session, family_id, current_user.id)
