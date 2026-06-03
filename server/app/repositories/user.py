import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def upsert_by_google_sub(
        self,
        google_sub: str,
        email: str,
        display_name: str,
    ) -> User:
        result = await self.session.execute(select(User).where(User.google_sub == google_sub))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(google_sub=google_sub, email=email, display_name=display_name)
            self.session.add(user)
        else:
            user.email = email
            user.display_name = display_name

        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def get_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
