import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.child_profile import ChildProfile
from app.repositories.child_profile import ChildProfileRepository
from app.schemas.generated import CreateChildRequest, UpdateChildRequest
from app.services.exceptions import ChildNotFound, NoFamilyError, NotFamilyMember
from app.services.family import get_user_family


async def create_child(
    session: AsyncSession, user_id: uuid.UUID, req: CreateChildRequest
) -> ChildProfile:
    membership = await get_user_family(session, user_id)
    if not membership:
        raise NoFamilyError("You must create or join a family before adding children")

    repo = ChildProfileRepository(session)
    return await repo.create(membership.family_id, req)


async def get_children(
    session: AsyncSession, user_id: uuid.UUID
) -> list[ChildProfile]:
    membership = await get_user_family(session, user_id)
    if not membership:
        return []

    repo = ChildProfileRepository(session)
    return await repo.get_by_family(membership.family_id)


async def update_child(
    session: AsyncSession,
    child_id: uuid.UUID,
    user_id: uuid.UUID,
    req: UpdateChildRequest,
) -> ChildProfile:
    membership = await get_user_family(session, user_id)
    if not membership:
        raise NoFamilyError("You must be in a family to manage children")

    repo = ChildProfileRepository(session)
    child = await repo.get_by_id(child_id)
    if not child:
        raise ChildNotFound(f"Child {child_id} not found")
    if child.family_id != membership.family_id:
        raise NotFamilyMember("This child does not belong to your family")

    return await repo.update(child, req)


async def delete_child(
    session: AsyncSession, child_id: uuid.UUID, user_id: uuid.UUID
) -> None:
    membership = await get_user_family(session, user_id)
    if not membership:
        raise NoFamilyError("You must be in a family to manage children")

    repo = ChildProfileRepository(session)
    child = await repo.get_by_id(child_id)
    if not child:
        raise ChildNotFound(f"Child {child_id} not found")
    if child.family_id != membership.family_id:
        raise NotFamilyMember("This child does not belong to your family")

    await repo.delete(child)
