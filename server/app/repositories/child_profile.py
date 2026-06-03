import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.child_profile import ChildProfile
from app.schemas.generated import CreateChildRequest, UpdateChildRequest


class ChildProfileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, family_id: uuid.UUID, req: CreateChildRequest) -> ChildProfile:
        child = ChildProfile(
            family_id=family_id,
            nickname=req.nickname,
            date_of_birth=req.date_of_birth,
            interests=list(req.interests) if req.interests else [],
        )
        self.session.add(child)
        await self.session.commit()
        await self.session.refresh(child)
        return child

    async def get_by_family(self, family_id: uuid.UUID) -> list[ChildProfile]:
        result = await self.session.execute(select(ChildProfile).where(ChildProfile.family_id == family_id))
        return list(result.scalars().all())

    async def get_by_id(self, child_id: uuid.UUID) -> ChildProfile | None:
        result = await self.session.execute(select(ChildProfile).where(ChildProfile.id == child_id))
        return result.scalar_one_or_none()

    async def update(self, child: ChildProfile, req: UpdateChildRequest) -> ChildProfile:
        if req.nickname is not None:
            child.nickname = req.nickname
        if req.date_of_birth is not None:
            child.date_of_birth = req.date_of_birth
        if req.interests is not None:
            child.interests = list(req.interests)
        await self.session.commit()
        await self.session.refresh(child)
        return child

    async def delete(self, child: ChildProfile) -> None:
        await self.session.delete(child)
        await self.session.commit()
