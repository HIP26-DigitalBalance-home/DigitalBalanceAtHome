import uuid

from sqlalchemy import select
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
    ) -> list[Activity]:
        q = select(Activity)

        if exclude_paid:
            q = q.where(Activity.cost_indicator != "paid")
        if cost:
            q = q.where(Activity.cost_indicator == cost)
        if age is not None:
            q = q.where(Activity.age_min <= age, Activity.age_max >= age)
        if season:
            # season_relevance is null (year-round) OR contains the requested season
            from sqlalchemy import or_, func
            q = q.where(
                or_(
                    Activity.season_relevance.is_(None),
                    Activity.season_relevance.contains([season]),
                )
            )
        if weather:
            from sqlalchemy import or_
            q = q.where(
                or_(
                    Activity.weather_suitability.is_(None),
                    Activity.weather_suitability.contains([weather]),
                )
            )

        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def get_by_id(self, activity_id: uuid.UUID) -> Activity | None:
        result = await self.session.execute(
            select(Activity).where(Activity.id == activity_id)
        )
        return result.scalar_one_or_none()
