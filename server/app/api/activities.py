import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.dependencies.language import get_request_language
from app.models.user import User
from app.schemas.generated import Activity, CreateActivityRequest
from app.services import activity as activity_service
from app.services.localization import pick

router = APIRouter()


def _activity_schema(a, language: str = "de") -> dict:
    return {
        "id": a.id,
        "title": pick(a.title, a.title_en, language),
        "description": pick(a.description, a.description_en, language),
        "estimated_duration_minutes": a.estimated_duration_minutes,
        "age_min": a.age_min,
        "age_max": a.age_max,
        "cost_indicator": a.cost_indicator,
        "season_relevance": a.season_relevance,
        "weather_suitability": a.weather_suitability,
        "is_partner_content": a.is_partner_content,
        "effort_tier": a.effort_tier,
        "language": a.language,
    }


@router.get("", response_model=list[Activity])
async def list_activities(
    age: Optional[int] = Query(None, ge=0, le=99, description="Child age in years"),
    season: Optional[str] = Query(None, pattern="^(spring|summer|autumn|winter)$"),
    weather: Optional[str] = Query(None, pattern="^(sunny|cloudy|rainy|any)$"),
    cost: Optional[str] = Query(None, pattern="^(free|low_cost)$"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    language: str = Depends(get_request_language),
) -> list[dict]:
    activities = await activity_service.list_activities(
        session, user_id=current_user.id, age=age, season=season, weather=weather, cost=cost
    )
    return [_activity_schema(a, language) for a in activities]


@router.post("", response_model=Activity, status_code=201)
async def create_activity(
    body: CreateActivityRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    activity = await activity_service.create_activity(
        session, current_user.id, body, language=current_user.preferred_language
    )
    return _activity_schema(activity)


@router.get("/suggestions", response_model=Activity)
async def get_suggestion(
    child_id: Optional[uuid.UUID] = Query(None, description="Derive age and interests from this child profile"),
    city: Optional[str] = Query(None, description="City name for weather-based suggestions (reserved for future use)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    language: str = Depends(get_request_language),
) -> dict:
    activity = await activity_service.get_suggestion(session, child_id=child_id)
    if not activity:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="No suitable activity found")
    return _activity_schema(activity, language)
