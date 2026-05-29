from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.repositories.group import GroupRepository
from app.schemas.generated import (
    CreateGroupRequest,
    GrantAdminRequest,
    Group,
    GroupAdminEntry,
    GroupSummary,
    InviteResponse,
    JoinByTokenRequest,
)
from app.services import group as group_service

router = APIRouter()


def _group_schema(group, memberships, admins, is_admin: bool = False) -> dict:
    admin_user_ids = [a.user_id for a in admins]
    members = []
    seen_families: set = set()
    for m in memberships:
        if m.family_id not in seen_families:
            seen_families.add(m.family_id)
            family_admins = [a.user_id for a in admins if a.user_id]  # simplified
            members.append({
                "family_id": m.family_id,
                "family_name": None,
                "admin_user_ids": [],
                "joined_at": m.joined_at,
            })
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "is_admin": is_admin,
        "created_at": group.created_at,
        "members": members,
    }


def _summary_schema(group, is_admin: bool) -> dict:
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "is_admin": is_admin,
        "created_at": group.created_at,
    }


@router.post("", response_model=Group, status_code=201)
async def create_group(
    body: CreateGroupRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    group, membership, admin = await group_service.create_group(session, current_user.id, body)
    repo = GroupRepository(session)
    memberships = await repo.get_memberships_for_group(group.id)
    admins = await repo.get_admins_for_group(group.id)
    return _group_schema(group, memberships, admins, is_admin=True)


@router.get("/me", response_model=list[GroupSummary])
async def get_my_groups(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    groups = await group_service.get_groups_for_user(session, current_user.id)
    return [_summary_schema(g, is_admin) for g, _, is_admin in groups]


@router.post("/join", response_model=Group)
async def join_group(
    body: JoinByTokenRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    group, membership = await group_service.join_group(session, body.token, current_user.id)
    repo = GroupRepository(session)
    memberships = await repo.get_memberships_for_group(group.id)
    admins = await repo.get_admins_for_group(group.id)
    admin = await repo.get_admin(group.id, current_user.id)
    return _group_schema(group, memberships, admins, is_admin=admin is not None)


@router.get("/{group_id}", response_model=Group)
async def get_group(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    group, memberships, admins = await group_service.get_group(
        session, group_id, current_user.id
    )
    repo = GroupRepository(session)
    admin = await repo.get_admin(group_id, current_user.id)
    return _group_schema(group, memberships, admins, is_admin=admin is not None)


@router.post("/{group_id}/invites", response_model=InviteResponse, status_code=201)
async def create_group_invite(
    group_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    invite = await group_service.create_group_invite(session, group_id, current_user.id)
    invite_url = f"{settings.CLIENT_BASE_URL}/join-group?token={invite.token}"
    return {"invite_url": invite_url, "expires_at": invite.expires_at}


@router.delete("/{group_id}/members/{family_id}", status_code=204)
async def remove_group_member(
    group_id: UUID,
    family_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await group_service.remove_member(session, group_id, family_id, current_user.id)


@router.post("/{group_id}/admins", response_model=GroupAdminEntry, status_code=201)
async def grant_group_admin(
    group_id: UUID,
    body: GrantAdminRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    admin = await group_service.grant_admin(session, group_id, body.user_id, current_user.id)
    return {"group_id": admin.group_id, "user_id": admin.user_id, "granted_at": admin.granted_at}


@router.delete("/{group_id}/admins/{user_id}", status_code=204)
async def revoke_group_admin(
    group_id: UUID,
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await group_service.revoke_admin(session, group_id, user_id, current_user.id)


@router.get("/{group_id}/feed")
async def get_group_feed(group_id: UUID) -> None:
    raise HTTPException(status_code=501, detail="Not implemented")
