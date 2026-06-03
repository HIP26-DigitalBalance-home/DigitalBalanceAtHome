import uuid
from datetime import date

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.challenge import Challenge, ChallengeActivity
from app.models.completion import Completion
from app.models.group import GroupMembership


def _accessible_predicate(family_id: uuid.UUID):
    """SQLAlchemy filter: a family can see a challenge if it owns it (personal)
    or if the family is a member of the challenge's group."""
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
    )


def _status_from_dates(c: Challenge, today: date) -> str:
    """Date-based status only: upcoming or active. Completion is determined by slot fills."""
    if c.start_date > today:
        return "upcoming"
    return "active"


class ChallengeRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(
        self,
        title: str,
        description: str | None,
        group_id: uuid.UUID | None,
        created_by_family_id: uuid.UUID,
        start_date: date,
        end_date: date,
        activity_ids: list[uuid.UUID],
    ) -> Challenge:
        challenge = Challenge(
            title=title,
            description=description,
            group_id=group_id,
            created_by_family_id=created_by_family_id,
            start_date=start_date,
            end_date=end_date,
            display_mode="collage",
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
        today = date.today()
        result = await self.session.execute(
            select(Challenge)
            .where(
                _accessible_predicate(family_id),
                Challenge.start_date <= today,
                Challenge.end_date >= today,
            )
            .order_by(Challenge.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def get_all_for_family(self, family_id: uuid.UUID, status_filter: str | None) -> list[Challenge]:
        today = date.today()
        q = select(Challenge).where(_accessible_predicate(family_id))

        if status_filter == "upcoming":
            q = q.where(Challenge.start_date > today)
        elif status_filter == "active" or status_filter == "completed":
            # Both active and completed challenges have start_date <= today.
            # We filter by completion state in the service layer.
            q = q.where(Challenge.start_date <= today)

        q = q.order_by(Challenge.created_at.desc())
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def get_completions_for_family(
        self, family_id: uuid.UUID, challenge_activity_ids: list[uuid.UUID]
    ) -> list[Completion]:
        if not challenge_activity_ids:
            return []
        result = await self.session.execute(
            select(Completion).where(
                Completion.family_id == family_id,
                Completion.challenge_activity_id.in_(challenge_activity_ids),
            )
        )
        return list(result.scalars().all())

    async def get_families_completed_count_per_slot(
        self, challenge_activity_ids: list[uuid.UUID]
    ) -> dict[uuid.UUID, int]:
        if not challenge_activity_ids:
            return {}
        result = await self.session.execute(
            select(
                Completion.challenge_activity_id,
                func.count(Completion.family_id.distinct()).label("count"),
            )
            .where(Completion.challenge_activity_id.in_(challenge_activity_ids))
            .group_by(Completion.challenge_activity_id)
        )
        return {row.challenge_activity_id: row.count for row in result}

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

    async def is_fully_completed_by_family(self, challenge_id: uuid.UUID, family_id: uuid.UUID) -> bool:
        """True when every ChallengeActivity slot has a Completion for this family."""
        total_result = await self.session.execute(
            select(func.count()).where(ChallengeActivity.challenge_id == challenge_id)
        )
        total_slots = total_result.scalar_one()
        if total_slots == 0:
            return False

        completed_result = await self.session.execute(
            select(func.count()).where(
                Completion.family_id == family_id,
                Completion.challenge_activity_id.in_(
                    select(ChallengeActivity.id).where(ChallengeActivity.challenge_id == challenge_id)
                ),
            )
        )
        completed_count = completed_result.scalar_one()
        return completed_count >= total_slots
