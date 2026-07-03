import uuid
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.challenge import Challenge
from app.models.notification import Notification
from app.models.user import User


class NotificationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        user_id: uuid.UUID,
        type: str,
        actor_user_id: uuid.UUID | None = None,
        challenge_id: uuid.UUID | None = None,
    ) -> Notification:
        notification = Notification(
            user_id=user_id,
            type=type,
            actor_user_id=actor_user_id,
            challenge_id=challenge_id,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(notification)
        await self.session.flush()
        return notification

    async def get_for_user(
        self, user_id: uuid.UUID, limit: int = 50
    ) -> list[tuple[Notification, str | None, str | None, str | None]]:
        """Return (Notification, actor_display_name, challenge_title, challenge_title_en), newest first."""
        result = await self.session.execute(
            select(Notification, User.display_name, Challenge.title, Challenge.title_en)
            .outerjoin(User, Notification.actor_user_id == User.id)
            .outerjoin(Challenge, Notification.challenge_id == Challenge.id)
            .where(Notification.user_id == user_id)
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        return list(result.tuples().all())

    async def mark_all_read(self, user_id: uuid.UUID) -> None:
        await self.session.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.read_at.is_(None))
            .values(read_at=datetime.now(timezone.utc))
        )
