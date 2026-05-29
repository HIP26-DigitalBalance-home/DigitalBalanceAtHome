import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.generated import Activity
from app.services import activity as activity_service

router = APIRouter()


def _activity_schema(a) -> dict:
    return {
        "id": a.id,
        "title": a.title,
        "description": a.description,
        "estimated_duration_minutes": a.estimated_duration_minutes,
        "age_min": a.age_min,
        "age_max": a.age_max,
        "cost_indicator": a.cost_indicator,
        "season_relevance": a.season_relevance,
        "weather_suitability": a.weather_suitability,
        "is_partner_content": a.is_partner_content,
    }


@router.get("", response_model=list[Activity])
async def list_activities(
    age: Optional[int] = Query(None, ge=0, le=18, description="Child age in years"),
    season: Optional[str] = Query(None, pattern="^(spring|summer|autumn|winter)$"),
    weather: Optional[str] = Query(None, pattern="^(sunny|cloudy|rainy|any)$"),
    cost: Optional[str] = Query(None, pattern="^(free|low_cost)$"),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    activities = await activity_service.list_activities(
        session, age=age, season=season, weather=weather, cost=cost
    )
    return [_activity_schema(a) for a in activities]


@router.get("/suggestions", response_model=Activity)
async def get_suggestion(
    child_id: Optional[uuid.UUID] = Query(None, description="Derive age and interests from this child profile"),
    city: Optional[str] = Query(None, description="City name for weather-based suggestions (reserved for future use)"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    activity = await activity_service.get_suggestion(session, child_id=child_id)
    if not activity:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="No suitable activity found")
    return _activity_schema(activity)
