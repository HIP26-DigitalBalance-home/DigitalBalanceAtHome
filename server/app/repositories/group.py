import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.family import Family, FamilyMembership
from app.models.group import Group, GroupAdmin, GroupInvite, GroupMembership
from app.models.user import User


class GroupRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, name: str, description: str | None, created_by_user_id: uuid.UUID) -> Group:
        group = Group(name=name, description=description, created_by_user_id=created_by_user_id)
        self.session.add(group)
        await self.session.flush()
        return group

    async def get_by_id(self, group_id: uuid.UUID) -> Group | None:
        result = await self.session.execute(select(Group).where(Group.id == group_id))
        return result.scalar_one_or_none()

    async def get_memberships_for_family(self, family_id: uuid.UUID) -> list[GroupMembership]:
        result = await self.session.execute(select(GroupMembership).where(GroupMembership.family_id == family_id))
        return list(result.scalars().all())

    async def get_memberships_for_group(self, group_id: uuid.UUID) -> list[GroupMembership]:
        result = await self.session.execute(select(GroupMembership).where(GroupMembership.group_id == group_id))
        return list(result.scalars().all())

    async def get_membership(self, group_id: uuid.UUID, family_id: uuid.UUID) -> GroupMembership | None:
        result = await self.session.execute(
            select(GroupMembership).where(
                GroupMembership.group_id == group_id,
                GroupMembership.family_id == family_id,
            )
        )
        return result.scalar_one_or_none()

    async def add_membership(self, group_id: uuid.UUID, family_id: uuid.UUID) -> GroupMembership:
        membership = GroupMembership(
            group_id=group_id,
            family_id=family_id,
            joined_at=datetime.now(timezone.utc),
        )
        self.session.add(membership)
        await self.session.flush()
        return membership

    async def delete_membership(self, membership: GroupMembership) -> None:
        await self.session.delete(membership)
        await self.session.flush()

    async def get_admins_for_group(self, group_id: uuid.UUID) -> list[GroupAdmin]:
        result = await self.session.execute(select(GroupAdmin).where(GroupAdmin.group_id == group_id))
        return list(result.scalars().all())

    async def get_admin(self, group_id: uuid.UUID, user_id: uuid.UUID) -> GroupAdmin | None:
        result = await self.session.execute(
            select(GroupAdmin).where(
                GroupAdmin.group_id == group_id,
                GroupAdmin.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def add_admin(self, group_id: uuid.UUID, user_id: uuid.UUID) -> GroupAdmin:
        admin = GroupAdmin(
            group_id=group_id,
            user_id=user_id,
            granted_at=datetime.now(timezone.utc),
        )
        self.session.add(admin)
        await self.session.flush()
        return admin

    async def delete_admin(self, admin: GroupAdmin) -> None:
        await self.session.delete(admin)
        await self.session.flush()

    async def count_admins(self, group_id: uuid.UUID) -> int:
        result = await self.session.execute(select(func.count()).where(GroupAdmin.group_id == group_id))
        return result.scalar_one()

    async def get_admins_for_family_members(self, group_id: uuid.UUID, user_ids: list[uuid.UUID]) -> list[GroupAdmin]:
        if not user_ids:
            return []
        result = await self.session.execute(
            select(GroupAdmin).where(
                GroupAdmin.group_id == group_id,
                GroupAdmin.user_id.in_(user_ids),
            )
        )
        return list(result.scalars().all())

    async def create_invite(self, group_id: uuid.UUID, created_by_user_id: uuid.UUID) -> GroupInvite:
        invite = GroupInvite(
            group_id=group_id,
            token=uuid.uuid4(),
            created_by_user_id=created_by_user_id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        self.session.add(invite)
        await self.session.flush()
        return invite

    async def get_invite_by_token(self, token: uuid.UUID) -> GroupInvite | None:
        result = await self.session.execute(select(GroupInvite).where(GroupInvite.token == token))
        return result.scalar_one_or_none()

    async def mark_invite_used(self, invite: GroupInvite, user_id: uuid.UUID) -> GroupInvite:
        invite.used_by_user_id = user_id
        invite.used_at = datetime.now(timezone.utc)
        await self.session.flush()
        return invite

    # ── Bulk-fetch helpers for enriched group responses ──────────────────────

    async def get_families_by_ids(self, ids: list[uuid.UUID]) -> list[Family]:
        if not ids:
            return []
        result = await self.session.execute(select(Family).where(Family.id.in_(ids)))
        return list(result.scalars().all())

    async def get_family_memberships_for_families(self, family_ids: list[uuid.UUID]) -> list[FamilyMembership]:
        if not family_ids:
            return []
        result = await self.session.execute(select(FamilyMembership).where(FamilyMembership.family_id.in_(family_ids)))
        return list(result.scalars().all())

    async def get_users_by_ids(self, ids: list[uuid.UUID]) -> list[User]:
        if not ids:
            return []
        result = await self.session.execute(select(User).where(User.id.in_(ids)))
        return list(result.scalars().all())
