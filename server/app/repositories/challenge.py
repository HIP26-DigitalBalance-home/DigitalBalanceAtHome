import uuid
from datetime import datetime, timezone

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.challenge import Challenge, ChallengeActivity, ChallengeParticipant, ChallengeSharedGroup
from app.models.completion import Completion
from app.models.group import GroupMembership
from app.models.user import User


def _accessible_predicate(family_id: uuid.UUID):
    """SQLAlchemy filter: a family can see a challenge if it owns it (personal),
    if the family is a member of the challenge's group, or if a member of the
    family was invited as a participant."""
    return or_(
        and_(
            Challenge.group_id.is_(None),
            Challenge.created_by_family_id == family_id,
        ),
        and_(
            Challenge.group_id.isnot(None),
            exists(
                select(GroupMembership.id).where(
                    GroupMembership.group_id == Challenge.group_id,
                    GroupMembership.family_id == family_id,
                )
            ),
        ),
        exists(
            select(ChallengeParticipant.id).where(
                ChallengeParticipant.challenge_id == Challenge.id,
                ChallengeParticipant.family_id == family_id,
            )
        ),
    )


class ChallengeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        title: str,
        description: str | None,
        group_id: uuid.UUID | None,
        created_by_family_id: uuid.UUID,
        activity_ids: list[uuid.UUID],
        is_private: bool = True,
        shared_group_ids: list[uuid.UUID] | None = None,
    ) -> Challenge:
        challenge = Challenge(
            title=title,
            description=description,
            group_id=group_id,
            created_by_family_id=created_by_family_id,
            display_mode="collage",
            is_private=is_private,
        )
        self.session.add(challenge)
        await self.session.flush()

        for position, activity_id in enumerate(activity_ids):
            ca = ChallengeActivity(
                challenge_id=challenge.id,
                activity_id=activity_id,
                grid_position=position,
            )
            self.session.add(ca)

        for gid in shared_group_ids or []:
            self.session.add(ChallengeSharedGroup(challenge_id=challenge.id, group_id=gid))

        await self.session.flush()
        return challenge

    async def get_by_id(self, challenge_id: uuid.UUID) -> Challenge | None:
        result = await self.session.execute(select(Challenge).where(Challenge.id == challenge_id))
        return result.scalar_one_or_none()

    async def get_challenge_activities(self, challenge_id: uuid.UUID) -> list[ChallengeActivity]:
        result = await self.session.execute(
            select(ChallengeActivity)
            .where(ChallengeActivity.challenge_id == challenge_id)
            .order_by(ChallengeActivity.grid_position)
        )
        return list(result.scalars().all())

    async def get_activities_by_ids(self, activity_ids: list[uuid.UUID]) -> list[Activity]:
        if not activity_ids:
            return []
        result = await self.session.execute(select(Activity).where(Activity.id.in_(activity_ids)))
        return list(result.scalars().all())

    async def get_active_for_family(self, family_id: uuid.UUID) -> Challenge | None:
        result = await self.session.execute(
            select(Challenge).where(_accessible_predicate(family_id)).order_by(Challenge.created_at.desc()).limit(1)
        )
        return result.scalar_one_or_none()

    async def get_all_for_family(self, family_id: uuid.UUID) -> list[Challenge]:
        # Challenges have no dates — active vs completed is derived from slot
        # fills in the service layer.
        result = await self.session.execute(
            select(Challenge).where(_accessible_predicate(family_id)).order_by(Challenge.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_shared_group_ids(self, challenge_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self.session.execute(
            select(ChallengeSharedGroup.group_id).where(ChallengeSharedGroup.challenge_id == challenge_id)
        )
        return list(result.scalars().all())

    async def get_completions_for_family(
        self, family_id: uuid.UUID, challenge_activity_ids: list[uuid.UUID]
    ) -> list[Completion]:
        return await self.get_completions_for_families([family_id], challenge_activity_ids)

    async def get_completions_for_families(
        self, family_ids: list[uuid.UUID], challenge_activity_ids: list[uuid.UUID]
    ) -> list[Completion]:
        if not challenge_activity_ids or not family_ids:
            return []
        result = await self.session.execute(
            select(Completion).where(
                Completion.family_id.in_(family_ids),
                Completion.challenge_activity_id.in_(challenge_activity_ids),
            )
        )
        return list(result.scalars().all())

    async def get_participant_family_ids(self, challenge_id: uuid.UUID) -> list[uuid.UUID]:
        result = await self.session.execute(
            select(ChallengeParticipant.family_id.distinct()).where(ChallengeParticipant.challenge_id == challenge_id)
        )
        return list(result.scalars().all())

    async def get_participants_with_users(self, challenge_id: uuid.UUID) -> list[tuple[ChallengeParticipant, str]]:
        """(participant, display_name) ordered alphabetically."""
        result = await self.session.execute(
            select(ChallengeParticipant, User.display_name)
            .join(User, ChallengeParticipant.user_id == User.id)
            .where(ChallengeParticipant.challenge_id == challenge_id)
            .order_by(User.display_name)
        )
        return list(result.tuples().all())

    async def get_participant(self, challenge_id: uuid.UUID, user_id: uuid.UUID) -> ChallengeParticipant | None:
        result = await self.session.execute(
            select(ChallengeParticipant).where(
                ChallengeParticipant.challenge_id == challenge_id,
                ChallengeParticipant.user_id == user_id,
            )
        )
        return result.scalar_one_or_none()

    async def add_participant(
        self,
        challenge_id: uuid.UUID,
        user_id: uuid.UUID,
        family_id: uuid.UUID,
        invited_by_user_id: uuid.UUID,
    ) -> ChallengeParticipant:
        participant = ChallengeParticipant(
            challenge_id=challenge_id,
            user_id=user_id,
            family_id=family_id,
            invited_by_user_id=invited_by_user_id,
            created_at=datetime.now(timezone.utc),
        )
        self.session.add(participant)
        await self.session.flush()
        return participant

    async def get_families_completed_count_per_slot(
        self, challenge_activity_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, int]:
        if not challenge_activity_ids:
            return {}
        result = await self.session.execute(
            select(
                Completion.challenge_activity_id,
                func.count(Completion.family_id.distinct()).label("family_count"),
            )
            .where(Completion.challenge_activity_id.in_(challenge_activity_ids))
            .group_by(Completion.challenge_activity_id)
        )
        return {row.challenge_activity_id: row.family_count for row in result}

    async def get_group_family_count(self, group_id: uuid.UUID) -> int:
        result = await self.session.execute(select(func.count()).where(GroupMembership.group_id == group_id))
        return result.scalar_one()

    async def is_accessible(self, challenge: Challenge, family_id: uuid.UUID) -> bool:
        result = await self.session.execute(
            select(Challenge.id).where(
                Challenge.id == challenge.id,
                _accessible_predicate(family_id),
            )
        )
        return result.scalar_one_or_none() is not None

    async def is_fully_completed_by_families(self, challenge_id: uuid.UUID, family_ids: list[uuid.UUID]) -> bool:
        """True when every ChallengeActivity slot has a Completion by any of these families."""
        if not family_ids:
            return False
        total_result = await self.session.execute(
            select(func.count()).where(ChallengeActivity.challenge_id == challenge_id)
        )
        total_slots = total_result.scalar_one()
        if total_slots == 0:
            return False

        completed_result = await self.session.execute(
            select(func.count(Completion.challenge_activity_id.distinct())).where(
                Completion.family_id.in_(family_ids),
                Completion.challenge_activity_id.in_(
                    select(ChallengeActivity.id).where(ChallengeActivity.challenge_id == challenge_id)
                ),
            )
        )
        completed_count = completed_result.scalar_one()
        return completed_count >= total_slots
