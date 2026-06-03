from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.schemas.generated import ConsentRecord, CreateConsentRequest
from app.services import consent as consent_service

router = APIRouter()


@router.post("", response_model=ConsentRecord, status_code=201)
async def create_consent(
    body: CreateConsentRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    record = await consent_service.create_consent(session, current_user.id, body)
    return {
        "id": record.id,
        "user_id": record.user_id,
        "policy_version": record.policy_version,
        "consented_at": record.consented_at,
        "data_storage_consent": record.data_storage_consent,
        "photo_processing_consent": record.photo_processing_consent,
        "location_consent": record.location_consent,
    }


@router.get("", response_model=ConsentRecord)
async def get_consent(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    record = await consent_service.get_consent(session, current_user.id)
    if not record:
        raise HTTPException(status_code=404, detail="No consent record found")
    return {
        "id": record.id,
        "user_id": record.user_id,
        "policy_version": record.policy_version,
        "consented_at": record.consented_at,
        "data_storage_consent": record.data_storage_consent,
        "photo_processing_consent": record.photo_processing_consent,
        "location_consent": record.location_consent,
    }
