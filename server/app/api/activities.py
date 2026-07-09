import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.dependencies.language import get_request_language
from app.models.user import User
from app.schemas.generated import (
    Activity,
    ActivityDetail,
    ActivityResource,
    ActivityResourcePhoto,
    CreateActivityRequest,
    CreateResourceRequest,
    UpdateResourceRequest,
)
from app.services import activity as activity_service
from app.services import activity_resource as resource_service
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
    activity = await activity_service.get_suggestion(
        session,
        user_id=current_user.id,
        child_id=child_id,
    )
    return _activity_schema(activity, language)


# ── Activity resources ───────────────────────────────────────────


@router.get("/{activity_id}", response_model=ActivityDetail)
async def get_activity_detail(
    activity_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    language: str = Depends(get_request_language),
) -> dict:
    activity, can_edit, resources = await resource_service.get_activity_with_resources(
        session, current_user.id, activity_id
    )
    data = _activity_schema(activity, language)
    data["can_edit"] = can_edit
    data["resources"] = resources
    return data


@router.post("/{activity_id}/resources", response_model=ActivityResource, status_code=201)
async def create_activity_resource(
    activity_id: uuid.UUID,
    body: CreateResourceRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    if body.kind == "external":
        return await resource_service.create_external_resource(
            session, current_user.id, activity_id, url=body.url, label=body.label
        )
    return await resource_service.create_internal_text_resource(
        session, current_user.id, activity_id, note_text=body.note_text, label=body.label
    )


@router.post("/{activity_id}/resources/photos", response_model=ActivityResource, status_code=202)
async def create_activity_resource_photo(
    activity_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    note_text: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    photo_data = await image.read()
    resource, raw_key, final_key, photo_id = await resource_service.create_photo_only_resource(
        session,
        current_user.id,
        activity_id,
        photo_data=photo_data,
        content_type=image.content_type or "image/jpeg",
        note_text=note_text,
    )
    background_tasks.add_task(
        resource_service.compress_resource_photo, photo_id, raw_key, final_key, settings.DATABASE_URL
    )
    return resource


@router.post(
    "/{activity_id}/resources/{resource_id}/photos",
    response_model=ActivityResourcePhoto,
    status_code=202,
)
async def add_activity_resource_photo(
    activity_id: uuid.UUID,
    resource_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    photo_data = await image.read()
    photo, raw_key, final_key, photo_id = await resource_service.add_photo(
        session,
        current_user.id,
        activity_id,
        resource_id,
        photo_data=photo_data,
        content_type=image.content_type or "image/jpeg",
    )
    background_tasks.add_task(
        resource_service.compress_resource_photo, photo_id, raw_key, final_key, settings.DATABASE_URL
    )
    return photo


@router.patch("/{activity_id}/resources/{resource_id}", response_model=ActivityResource)
async def update_activity_resource(
    activity_id: uuid.UUID,
    resource_id: uuid.UUID,
    body: UpdateResourceRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await resource_service.update_resource(
        session,
        current_user.id,
        activity_id,
        resource_id,
        label=body.label,
        url=body.url,
        note_text=body.note_text,
    )


@router.delete("/{activity_id}/resources/{resource_id}", status_code=204)
async def delete_activity_resource(
    activity_id: uuid.UUID,
    resource_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await resource_service.delete_resource(session, current_user.id, activity_id, resource_id)


@router.delete("/{activity_id}/resources/{resource_id}/photos/{photo_id}", status_code=204)
async def delete_activity_resource_photo(
    activity_id: uuid.UUID,
    resource_id: uuid.UUID,
    photo_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> None:
    await resource_service.delete_photo(session, current_user.id, activity_id, resource_id, photo_id)
