import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.group import GroupRepository
from app.services.family import get_user_family


async def get_friends(session: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    """All parents whose family shares at least one group with the caller's family,
    sorted alphabetically by display name."""
    fm = await get_user_family(session, user_id)
    if not fm:
        return []

    rows = await GroupRepository(session).get_friend_rows(fm.family_id)

    friends: dict[uuid.UUID, dict] = {}
    for user, _family_id, group_name in rows:
        entry = friends.setdefault(
            user.id,
            {"user_id": user.id, "display_name": user.display_name, "shared_group_names": []},
        )
        if group_name not in entry["shared_group_names"]:
            entry["shared_group_names"].append(group_name)

    return sorted(friends.values(), key=lambda f: f["display_name"].lower())
