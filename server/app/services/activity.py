import random
import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.activity import Activity
from app.repositories.activity import ActivityRepository
from app.repositories.child_profile import ChildProfileRepository
from app.repositories.quota import lock_family_quota
from app.schemas.generated import CreateActivityRequest
from app.services.exceptions import ActivityLimitReached, ActivityNotFound, NoFamilyError
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
    limit: int | None = None,
    offset: int = 0,
) -> list[Activity]:
    repo = ActivityRepository(session)
    membership = await get_user_family(session, user_id)
    family_id = membership.family_id if membership else None
    return await repo.get_all(
        age=age,
        season=season,
        weather=weather,
        cost=cost,
        exclude_paid=True,
        family_id=family_id,
        limit=limit,
        offset=offset,
    )


async def create_activity(
    session: AsyncSession,
    user_id: uuid.UUID,
    req: CreateActivityRequest,
    language: str = "de",
) -> Activity:
    membership = await get_user_family(session, user_id)
    if not membership:
        raise NoFamilyError("You must create or join a family before adding activities")

    repo = ActivityRepository(session)
    # Advisory lock makes count-then-create atomic against parallel requests;
    # released when repo.create() commits
    await lock_family_quota(session, membership.family_id)
    if await repo.count_custom_for_family(membership.family_id) >= settings.CUSTOM_ACTIVITY_LIMIT:
        await session.rollback()
        raise ActivityLimitReached(
            f"Your family has reached the limit of {settings.CUSTOM_ACTIVITY_LIMIT} custom activities"
        )
    return await repo.create(
        created_by_user_id=user_id,
        family_id=membership.family_id,
        title=req.title,
        description=req.description,
        estimated_duration_minutes=req.estimated_duration_minutes or 30,
        cost_indicator=str(req.cost_indicator or "free"),
        language=language,
    )


async def get_suggestion(
    session: AsyncSession,
    user_id: uuid.UUID,
    child_id: uuid.UUID | None,
) -> Activity:
    """Return a random incomplete activity for the caller's family.

    This is the intentionally small first version of the suggestion engine.
    Its candidate/ranking stages are the extension points for weather,
    preferences, and LLM input later. For now it filters by age and season,
    boosts simple interest matches, and never returns an activity the family
    has already completed.
    """
    activity_repo = ActivityRepository(session)
    membership = await get_user_family(session, user_id)
    family_id = membership.family_id if membership else None
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
        family_id=family_id,
        exclude_completed_for_family_id=family_id,
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
    fallback = await activity_repo.get_all(
        age=child_age,
        exclude_paid=True,
        family_id=family_id,
        exclude_completed_for_family_id=family_id,
    )
    if fallback:
        return random.choice(fallback)

    raise ActivityNotFound("No incomplete activity is available for this family")
