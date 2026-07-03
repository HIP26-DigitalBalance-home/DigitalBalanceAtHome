import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.notification import NotificationRepository
from app.services.localization import pick


async def get_notifications(session: AsyncSession, user_id: uuid.UUID, language: str = "de") -> list[dict]:
    repo = NotificationRepository(session)
    rows = await repo.get_for_user(user_id)
    return [
        {
            "id": n.id,
            "type": n.type,
            "actor_user_id": n.actor_user_id,
            "actor_display_name": actor_name,
            "challenge_id": n.challenge_id,
            "challenge_title": pick(challenge_title, challenge_title_en, language) if challenge_title else None,
            "created_at": n.created_at,
            "read": n.read_at is not None,
        }
        for n, actor_name, challenge_title, challenge_title_en in rows
    ]


async def mark_all_read(session: AsyncSession, user_id: uuid.UUID) -> None:
    repo = NotificationRepository(session)
    await repo.mark_all_read(user_id)
    await session.commit()
