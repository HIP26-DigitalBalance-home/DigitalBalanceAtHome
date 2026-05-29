import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group, GroupAdmin, GroupInvite, GroupMembership
from app.repositories.group import GroupRepository
from app.schemas.generated import CreateGroupRequest
from app.services.exceptions import (
    AlreadyGroupMember,
    GroupInviteAlreadyUsed,
    GroupInviteExpired,
    GroupInviteNotFound,
    GroupNotFound,
    LastGroupAdminError,
    NoFamilyError,
    NotGroupAdmin,
    NotGroupMember,
)
from app.services.family import get_user_family


async def create_group(
    session: AsyncSession, user_id: uuid.UUID, req: CreateGroupRequest
) -> tuple[Group, GroupMembership, GroupAdmin]:
    membership = await get_user_family(session, user_id)
    if not membership:
        raise NoFamilyError("You must create or join a family before creating a group")

    repo = GroupRepository(session)
    group = await repo.create(
        name=req.name,
        description=req.description,
        created_by_user_id=user_id,
    )
    gm = await repo.add_membership(group.id, membership.family_id)
    ga = await repo.add_admin(group.id, user_id)
    await session.commit()
    await session.refresh(group)
    await session.refresh(gm)
    await session.refresh(ga)
    return group, gm, ga


async def get_groups_for_user(
    session: AsyncSession, user_id: uuid.UUID
) -> list[tuple[Group, GroupMembership, bool]]:
    family_membership = await get_user_family(session, user_id)
    if not family_membership:
        return []

    repo = GroupRepository(session)
    memberships = await repo.get_memberships_for_family(family_membership.family_id)
    result = []
    for gm in memberships:
        group = await repo.get_by_id(gm.group_id)
        if group:
            admin = await repo.get_admin(gm.group_id, user_id)
            result.append((group, gm, admin is not None))
    return result


async def get_group(
    session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID
) -> tuple[Group, list[GroupMembership], list[GroupAdmin]]:
    family_membership = await get_user_family(session, user_id)
    if not family_membership:
        raise NotGroupMember("You are not a member of any family")

    repo = GroupRepository(session)
    group = await repo.get_by_id(group_id)
    if not group:
        raise GroupNotFound(f"Group {group_id} not found")

    gm = await repo.get_membership(group_id, family_membership.family_id)
    if not gm:
        raise NotGroupMember("Your family is not a member of this group")

    memberships = await repo.get_memberships_for_group(group_id)
    admins = await repo.get_admins_for_group(group_id)
    return group, memberships, admins


async def create_group_invite(
    session: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID
) -> GroupInvite:
    repo = GroupRepository(session)
    group = await repo.get_by_id(group_id)
    if not group:
        raise GroupNotFound(f"Group {group_id} not found")

    admin = await repo.get_admin(group_id, user_id)
    if not admin:
        raise NotGroupAdmin("Only group admins can generate invite links")

    invite = await repo.create_invite(group_id, user_id)
    await session.commit()
    await session.refresh(invite)
    return invite


async def join_group(
    session: AsyncSession, token: uuid.UUID, user_id: uuid.UUID
) -> tuple[Group, GroupMembership]:
    family_membership = await get_user_family(session, user_id)
    if not family_membership:
        raise NoFamilyError("You must create or join a family before joining a group")

    repo = GroupRepository(session)
    invite = await repo.get_invite_by_token(token)
    if not invite:
        raise GroupInviteNotFound("Invite not found")
    if invite.used_at is not None:
        raise GroupInviteAlreadyUsed("This invite has already been used")
    if invite.expires_at < datetime.now(timezone.utc):
        raise GroupInviteExpired("This invite has expired")

    existing = await repo.get_membership(invite.group_id, family_membership.family_id)
    if existing:
        raise AlreadyGroupMember("Your family is already a member of this group")

    gm = await repo.add_membership(invite.group_id, family_membership.family_id)
    await repo.mark_invite_used(invite, user_id)

    group = await repo.get_by_id(invite.group_id)
    await session.commit()
    await session.refresh(group)
    await session.refresh(gm)
    return group, gm


async def remove_member(
    session: AsyncSession,
    group_id: uuid.UUID,
    family_id: uuid.UUID,
    requesting_user_id: uuid.UUID,
) -> None:
    repo = GroupRepository(session)
    group = await repo.get_by_id(group_id)
    if not group:
        raise GroupNotFound(f"Group {group_id} not found")

    admin = await repo.get_admin(group_id, requesting_user_id)
    if not admin:
        raise NotGroupAdmin("Only group admins can remove members")

    membership = await repo.get_membership(group_id, family_id)
    if not membership:
        raise NotGroupMember("This family is not a member of the group")

    # Collect admin rows belonging to this family's members
    # We need family member user IDs — get them from family_memberships
    from app.repositories.family import FamilyRepository
    family_repo = FamilyRepository(session)
    family_members = await family_repo.get_memberships_for_family(family_id)
    family_user_ids = [m.user_id for m in family_members]

    # Check if removing would leave group with no admins
    admins_in_family = await repo.get_admins_for_family_members(group_id, family_user_ids)
    if admins_in_family:
        remaining_admin_count = await repo.count_admins(group_id) - len(admins_in_family)
        if remaining_admin_count < 1:
            raise LastGroupAdminError("Cannot remove the last admin family from the group")
        for a in admins_in_family:
            await repo.delete_admin(a)

    await repo.delete_membership(membership)
    await session.commit()


async def grant_admin(
    session: AsyncSession,
    group_id: uuid.UUID,
    target_user_id: uuid.UUID,
    requesting_user_id: uuid.UUID,
) -> GroupAdmin:
    repo = GroupRepository(session)
    group = await repo.get_by_id(group_id)
    if not group:
        raise GroupNotFound(f"Group {group_id} not found")

    requester_admin = await repo.get_admin(group_id, requesting_user_id)
    if not requester_admin:
        raise NotGroupAdmin("Only group admins can grant admin rights")

    # Verify target user is in a member family
    from app.repositories.family import FamilyRepository
    family_repo = FamilyRepository(session)
    target_family = await get_user_family(session, target_user_id)
    if not target_family:
        raise NotGroupMember("Target user does not belong to any family")
    gm = await repo.get_membership(group_id, target_family.family_id)
    if not gm:
        raise NotGroupMember("Target user's family is not a member of this group")

    existing = await repo.get_admin(group_id, target_user_id)
    if existing:
        return existing

    ga = await repo.add_admin(group_id, target_user_id)
    await session.commit()
    await session.refresh(ga)
    return ga


async def revoke_admin(
    session: AsyncSession,
    group_id: uuid.UUID,
    target_user_id: uuid.UUID,
    requesting_user_id: uuid.UUID,
) -> None:
    repo = GroupRepository(session)
    group = await repo.get_by_id(group_id)
    if not group:
        raise GroupNotFound(f"Group {group_id} not found")

    requester_admin = await repo.get_admin(group_id, requesting_user_id)
    if not requester_admin:
        raise NotGroupAdmin("Only group admins can revoke admin rights")

    target_admin = await repo.get_admin(group_id, target_user_id)
    if not target_admin:
        raise NotGroupMember("User is not an admin of this group")

    admin_count = await repo.count_admins(group_id)
    if admin_count <= 1:
        raise LastGroupAdminError("Cannot revoke the last group admin")

    await repo.delete_admin(target_admin)
    await session.commit()
