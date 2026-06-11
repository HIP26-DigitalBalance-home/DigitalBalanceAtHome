import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.challenge import Challenge, ChallengeActivity
from app.models.child_profile import ChildProfile
from app.models.completion import Completion
from app.models.consent import ConsentRecord
from app.models.family import FamilyMembership
from app.models.group import Group, GroupMembership
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

    async def update(self, user: User, **kwargs) -> User:
        for k, v in kwargs.items():
            setattr(user, k, v)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def set_deletion_pending(self, user: User) -> User:
        user.deletion_pending_at = datetime.now(timezone.utc)
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def cancel_deletion(self, user: User) -> User:
        user.deletion_pending_at = None
        await self.session.commit()
        await self.session.refresh(user)
        return user

    async def get_all_data_for_export(self, user_id: uuid.UUID) -> dict:
        fm_result = await self.session.execute(
            select(FamilyMembership.family_id).where(FamilyMembership.user_id == user_id)
        )
        family_ids = [row[0] for row in fm_result.all()]

        children: list[ChildProfile] = []
        group_rows: list[tuple[GroupMembership, Group]] = []
        comp_rows: list[tuple[Completion, str, str]] = []

        if family_ids:
            child_result = await self.session.execute(
                select(ChildProfile).where(ChildProfile.family_id.in_(family_ids))
            )
            children = list(child_result.scalars().all())

            gm_result = await self.session.execute(
                select(GroupMembership, Group)
                .join(Group, GroupMembership.group_id == Group.id)
                .where(GroupMembership.family_id.in_(family_ids))
            )
            group_rows = list(gm_result.all())  # type: ignore[arg-type]

            comp_result = await self.session.execute(
                select(Completion, Activity.title, Challenge.title)
                .join(ChallengeActivity, Completion.challenge_activity_id == ChallengeActivity.id)
                .join(Challenge, ChallengeActivity.challenge_id == Challenge.id)
                .join(Activity, ChallengeActivity.activity_id == Activity.id)
                .where(Completion.family_id.in_(family_ids))
                .order_by(Completion.completed_at.desc())
            )
            comp_rows = list(comp_result.tuples().all())

        consent_result = await self.session.execute(
            select(ConsentRecord).where(ConsentRecord.user_id == user_id).order_by(ConsentRecord.consented_at.asc())
        )
        consents = list(consent_result.scalars().all())

        return {
            "children": children,
            "consents": consents,
            "group_rows": group_rows,
            "comp_rows": comp_rows,
        }
