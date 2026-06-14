import random
import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.repositories.activity import ActivityRepository
from app.repositories.child_profile import ChildProfileRepository
from app.schemas.generated import CreateActivityRequest
from app.services.exceptions import NoFamilyError
from app.services.family import get_user_family


def _current_season() -> str:
    month = date.today().month
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    if month in (9, 10, 11):
        return "autumn"
    return "winter"


def _child_age(date_of_birth: date) -> int:
    today = date.today()
    return today.year - date_of_birth.year - ((today.month, today.day) < (date_of_birth.month, date_of_birth.day))


async def list_activities(
    session: AsyncSession,
    user_id: uuid.UUID,
    age: int | None,
    season: str | None,
    weather: str | None,
    cost: str | None,
) -> list[Activity]:
    repo = ActivityRepository(session)
    membership = await get_user_family(session, user_id)
    family_id = membership.family_id if membership else None
    return await repo.get_all(
        age=age, season=season, weather=weather, cost=cost, exclude_paid=True, family_id=family_id
    )


async def create_activity(
    session: AsyncSession,
    user_id: uuid.UUID,
    req: CreateActivityRequest,
) -> Activity:
    membership = await get_user_family(session, user_id)
    if not membership:
        raise NoFamilyError("You must create or join a family before adding activities")

    repo = ActivityRepository(session)
    return await repo.create(
        created_by_user_id=user_id,
        family_id=membership.family_id,
        title=req.title,
        description=req.description,
        estimated_duration_minutes=req.estimated_duration_minutes or 30,
        cost_indicator=str(req.cost_indicator or "free"),
    )


async def get_suggestion(
    session: AsyncSession,
    child_id: uuid.UUID | None,
) -> Activity | None:
    """Return a single suggested activity.

    Filters by the child's age + current season.
    Interest matching is a simple keyword check against title/description.
    Falls back to a random age-appropriate free activity if no filtered matches found.
    """
    activity_repo = ActivityRepository(session)
    season = _current_season()

    child_age: int | None = None
    interests: list[str] = []

    if child_id:
        child_repo = ChildProfileRepository(session)
        child = await child_repo.get_by_id(child_id)
        if child:
            child_age = _child_age(child.date_of_birth)
            interests = [i.lower() for i in (child.interests or [])]

    # Filtered pool: age + season
    candidates = await activity_repo.get_all(
        age=child_age,
        season=season,
        exclude_paid=True,
    )

    # Boost activities that match any child interest keyword
    if interests and candidates:
        boosted = [
            a for a in candidates if any(kw in a.title.lower() or kw in a.description.lower() for kw in interests)
        ]
        if boosted:
            return random.choice(boosted)

    if candidates:
        return random.choice(candidates)

    # Hard fallback: anything free and age-appropriate (ignore season)
    fallback = await activity_repo.get_all(age=child_age, exclude_paid=True)
    return random.choice(fallback) if fallback else None
