import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.family import Family, FamilyInvite, FamilyMembership, FamilyRole
from app.repositories.family import FamilyRepository
from app.schemas.generated import CreateFamilyRequest
from app.services.exceptions import (
    AlreadyFamilyMember,
    FamilyNotFound,
    InviteAlreadyUsed,
    InviteExpired,
    InviteNotFound,
    LastAdminError,
    MemberNotFound,
    NotFamilyAdmin,
    NotFamilyMember,
)


async def create_family(
    session: AsyncSession, user_id: uuid.UUID, req: CreateFamilyRequest
) -> tuple[Family, FamilyMembership]:
    repo = FamilyRepository(session)
    family = await repo.create(name=req.name)
    membership = await repo.add_membership(family.id, user_id, FamilyRole.admin)
    await session.commit()
    await session.refresh(family)
    await session.refresh(membership)
    return family, membership


async def get_families_for_user(
    session: AsyncSession, user_id: uuid.UUID
) -> list[tuple[Family, FamilyMembership]]:
    repo = FamilyRepository(session)
    memberships = await repo.get_memberships_for_user(user_id)
    results = []
    for m in memberships:
        family = await repo.get_by_id(m.family_id)
        if family:
            results.append((family, m))
    return results


async def get_family(
    session: AsyncSession, family_id: uuid.UUID, requesting_user_id: uuid.UUID
) -> tuple[Family, list[FamilyMembership]]:
    repo = FamilyRepository(session)
    family = await repo.get_by_id(family_id)
    if not family:
        raise FamilyNotFound(f"Family {family_id} not found")

    membership = await repo.get_membership(family_id, requesting_user_id)
    if not membership:
        raise NotFamilyMember("You are not a member of this family")

    members = await repo.get_memberships_for_family(family_id)
    return family, members


async def create_family_invite(
    session: AsyncSession, family_id: uuid.UUID, requesting_user_id: uuid.UUID
) -> FamilyInvite:
    repo = FamilyRepository(session)
    membership = await repo.get_membership(family_id, requesting_user_id)
    if not membership:
        raise NotFamilyMember("You are not a member of this family")
    if membership.role != FamilyRole.admin:
        raise NotFamilyAdmin("Only family admins can generate invite links")

    invite = await repo.create_invite(family_id, requesting_user_id)
    await session.commit()
    await session.refresh(invite)
    return invite


async def join_family(
    session: AsyncSession, token: uuid.UUID, user_id: uuid.UUID
) -> tuple[Family, FamilyMembership]:
    repo = FamilyRepository(session)
    invite = await repo.get_invite_by_token(token)
    if not invite:
        raise InviteNotFound("Invite not found or already used")
    if invite.used_at is not None:
        raise InviteAlreadyUsed("This invite has already been used")
    if invite.expires_at < datetime.now(timezone.utc):
        raise InviteExpired("This invite has expired")

    existing = await repo.get_membership(invite.family_id, user_id)
    if existing:
        raise AlreadyFamilyMember("You are already a member of this family")

    membership = await repo.add_membership(invite.family_id, user_id, FamilyRole.member)
    await repo.mark_invite_used(invite, user_id)

    family = await repo.get_by_id(invite.family_id)
    await session.commit()
    await session.refresh(family)
    await session.refresh(membership)
    return family, membership


async def update_member_role(
    session: AsyncSession,
    family_id: uuid.UUID,
    target_user_id: uuid.UUID,
    new_role: FamilyRole,
    requesting_user_id: uuid.UUID,
) -> FamilyMembership:
    repo = FamilyRepository(session)

    requester = await repo.get_membership(family_id, requesting_user_id)
    if not requester:
        raise NotFamilyMember("You are not a member of this family")
    if requester.role != FamilyRole.admin:
        raise NotFamilyAdmin("Only family admins can change roles")

    target = await repo.get_membership(family_id, target_user_id)
    if not target:
        raise MemberNotFound("Member not found in this family")

    if target.role == FamilyRole.admin and new_role == FamilyRole.member:
        admin_count = await repo.count_admins(family_id)
        if admin_count <= 1:
            raise LastAdminError("Cannot demote the last admin")

    updated = await repo.update_membership_role(target, new_role)
    await session.commit()
    await session.refresh(updated)
    return updated


async def remove_member(
    session: AsyncSession,
    family_id: uuid.UUID,
    target_user_id: uuid.UUID,
    requesting_user_id: uuid.UUID,
) -> None:
    repo = FamilyRepository(session)

    requester = await repo.get_membership(family_id, requesting_user_id)
    if not requester:
        raise NotFamilyMember("You are not a member of this family")
    if requester.role != FamilyRole.admin:
        raise NotFamilyAdmin("Only family admins can remove members")

    target = await repo.get_membership(family_id, target_user_id)
    if not target:
        raise MemberNotFound("Member not found in this family")

    if target.role == FamilyRole.admin:
        admin_count = await repo.count_admins(family_id)
        if admin_count <= 1:
            raise LastAdminError("Cannot remove the last admin")

    await repo.delete_membership(target)
    await session.commit()


async def get_user_family(
    session: AsyncSession, user_id: uuid.UUID
) -> FamilyMembership | None:
    """Return the user's first family membership, or None."""
    repo = FamilyRepository(session)
    memberships = await repo.get_memberships_for_user(user_id)
    return memberships[0] if memberships else None
