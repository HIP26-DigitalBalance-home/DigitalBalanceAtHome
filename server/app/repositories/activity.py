import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity


class ActivityRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_all(
        self,
        age: int | None = None,
        season: str | None = None,
        weather: str | None = None,
        cost: str | None = None,
        exclude_paid: bool = True,
        family_id: uuid.UUID | None = None,
    ) -> list[Activity]:
        q = select(Activity)

        # Visibility: global activities (family_id is null) plus the caller's own
        # family-created activities.
        q = q.where(or_(Activity.family_id.is_(None), Activity.family_id == family_id))

        if exclude_paid:
            q = q.where(Activity.cost_indicator != "paid")
        if cost:
            q = q.where(Activity.cost_indicator == cost)
        if age is not None:
            q = q.where(Activity.age_min <= age, Activity.age_max >= age)
        if season:
            # season_relevance is null (year-round) OR contains the requested season
            q = q.where(
                or_(
                    Activity.season_relevance.is_(None),
                    Activity.season_relevance.contains([season]),
                )
            )
        if weather:
            q = q.where(
                or_(
                    Activity.weather_suitability.is_(None),
                    Activity.weather_suitability.contains([weather]),
                )
            )

        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def get_by_id(self, activity_id: uuid.UUID) -> Activity | None:
        result = await self.session.execute(select(Activity).where(Activity.id == activity_id))
        return result.scalar_one_or_none()

    async def create(
        self,
        *,
        created_by_user_id: uuid.UUID,
        family_id: uuid.UUID,
        title: str,
        description: str | None,
        estimated_duration_minutes: int,
        cost_indicator: str,
        language: str = "de",
    ) -> Activity:
        activity = Activity(
            title=title,
            description=description or "",
            estimated_duration_minutes=estimated_duration_minutes,
            age_min=0,
            age_max=18,
            cost_indicator=cost_indicator,
            season_relevance=None,
            weather_suitability=None,
            is_partner_content=False,
            created_by_user_id=created_by_user_id,
            family_id=family_id,
            language=language,
        )
        self.session.add(activity)
        await self.session.commit()
        await self.session.refresh(activity)
        return activity
