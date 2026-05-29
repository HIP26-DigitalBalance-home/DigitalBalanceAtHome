from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.family import FamilyRole
from app.models.user import User
from app.schemas.generated import (
    CreateFamilyRequest,
    Family,
    FamilyCreatedResponse,
    FamilyMember,
    GrantAdminRequest,
    InviteResponse,
    JoinByTokenRequest,
    UpdateMemberRoleRequest,
)
from app.repositories.family import FamilyRepository
from app.services import family as family_service

router = APIRouter()


def _member_schema(m) -> dict:
    return {
        "user_id": m.user_id,
        "display_name": "",  # populated by join in full implementation; placeholder for now
        "profile_photo_url": None,
        "role": m.role.value,
        "joined_at": m.joined_at,
    }


def _family_schema(family, memberships) -> dict:
    return {
        "id": family.id,
        "name": family.name,
        "members": [_member_schema(m) for m in memberships],
        "created_at": family.created_at,
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
        "family": _family_schema(family, members),
        "membership": _member_schema(membership),
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
        result.append(_family_schema(family, members))
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
        "family": _family_schema(family, members),
        "membership": _member_schema(membership),
    }


@router.get("/{family_id}", response_model=Family)
async def get_family(
    family_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    family, members = await family_service.get_family(session, family_id, current_user.id)
    return _family_schema(family, members)


@router.post("/{family_id}/invites", response_model=InviteResponse, status_code=201)
async def create_family_invite(
    family_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    invite = await family_service.create_family_invite(session, family_id, current_user.id)
    invite_url = f"{settings.API_BASE_URL}/families/join?token={invite.token}"
    return {"invite_url": invite_url, "expires_at": invite.expires_at}


@router.patch("/{family_id}/members/{user_id}", response_model=FamilyMember)
async def update_family_member(
    family_id: UUID,
    user_id: UUID,
    body: UpdateMemberRoleRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    from app.models.family import FamilyRole as FR
    role = FR(body.role.value)
    membership = await family_service.update_member_role(
        session, family_id, user_id, role, current_user.id
    )
    return _member_schema(membership)


@router.delete("/{family_id}/members/{user_id}", status_code=204)
async def remove_family_member(
    family_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await family_service.remove_member(session, family_id, user_id, current_user.id)
