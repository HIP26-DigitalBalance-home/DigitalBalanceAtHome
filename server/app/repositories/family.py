import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.family import Family, FamilyInvite, FamilyMembership, FamilyRole


class FamilyRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, name: str | None) -> Family:
        family = Family(name=name)
        self.session.add(family)
        await self.session.flush()  # get the ID without committing
        return family

    async def get_by_id(self, family_id: uuid.UUID) -> Family | None:
        result = await self.session.execute(select(Family).where(Family.id == family_id))
        return result.scalar_one_or_none()

    async def get_memberships_for_user(self, user_id: uuid.UUID) -> list[FamilyMembership]:
        result = await self.session.execute(
            select(FamilyMembership).where(FamilyMembership.user_id == user_id)
        )
        return list(result.scalars().all())

    async def get_memberships_for_family(self, family_id: uuid.UUID) -> list[FamilyMembership]:
        result = await self.session.execute(
            select(FamilyMembership).where(FamilyMembership.family_id == family_id)
        )
        return list(result.scalars().all())

    async def get_membership(
        self, family_id: uuid.UUID, user_id: uuid.UUID
    ) -> FamilyMembership | None:
        result = await self.session.execute(
            select(FamilyMembership).where(
                FamilyMembership.family_id == family_id,
                FamilyMembership.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def add_membership(
        self, family_id: uuid.UUID, user_id: uuid.UUID, role: FamilyRole
    ) -> FamilyMembership:
        membership = FamilyMembership(
            family_id=family_id,
            user_id=user_id,
            role=role,
            joined_at=datetime.now(timezone.utc),
        )
        self.session.add(membership)
        await self.session.flush()
        return membership

    async def update_membership_role(
        self, membership: FamilyMembership, role: FamilyRole
    ) -> FamilyMembership:
        membership.role = role
        await self.session.flush()
        return membership

    async def delete_membership(self, membership: FamilyMembership) -> None:
        await self.session.delete(membership)
        await self.session.flush()

    async def count_admins(self, family_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(func.count()).where(
                FamilyMembership.family_id == family_id,
                FamilyMembership.role == FamilyRole.admin,
            )
        )
        return result.scalar_one()

    async def create_invite(
        self, family_id: uuid.UUID, created_by_user_id: uuid.UUID
    ) -> FamilyInvite:
        invite = FamilyInvite(
            family_id=family_id,
            token=uuid.uuid4(),
            created_by_user_id=created_by_user_id,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        self.session.add(invite)
        await self.session.flush()
        return invite

    async def get_invite_by_token(self, token: uuid.UUID) -> FamilyInvite | None:
        result = await self.session.execute(
            select(FamilyInvite).where(FamilyInvite.token == token)
        )
        return result.scalar_one_or_none()

    async def mark_invite_used(
        self, invite: FamilyInvite, user_id: uuid.UUID
    ) -> FamilyInvite:
        invite.used_by_user_id = user_id
        invite.used_at = datetime.now(timezone.utc)
        await self.session.flush()
        return invite
