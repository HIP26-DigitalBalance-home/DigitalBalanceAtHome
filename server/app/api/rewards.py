import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.dependencies.language import get_request_language
from app.models.user import User
from app.schemas.generated import (
    RedeemPayload,
    RedemptionResult,
    RejectPayload,
    RewardsBalance,
    VerificationActionResponse,
    VerificationQueue,
)
from app.services import rewards as rewards_service
from app.services import verification as verification_service

router = APIRouter()


@router.get("/groups/{group_id}/verification-queue", response_model=VerificationQueue)
async def get_verification_queue(
    group_id: uuid.UUID,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    language: str = Depends(get_request_language),
) -> dict:
    return await verification_service.get_queue(session, current_user.id, group_id, limit, offset, language)


@router.post(
    "/groups/{group_id}/verification-queue/{completion_id}/approve",
    response_model=VerificationActionResponse,
)
async def approve_completion_photo(
    group_id: uuid.UUID,
    completion_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    return await verification_service.approve(session, current_user.id, completion_id, group_id)


@router.post(
    "/groups/{group_id}/verification-queue/{completion_id}/reject",
    response_model=VerificationActionResponse,
)
async def reject_completion_photo(
    group_id: uuid.UUID,
    completion_id: uuid.UUID,
    payload: RejectPayload | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    reason = payload.reason if payload else None
    return await verification_service.reject(session, current_user.id, completion_id, group_id, reason)


@router.get("/rewards/balance", response_model=RewardsBalance)
async def get_rewards_balance(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    language: str = Depends(get_request_language),
) -> dict:
    return await rewards_service.get_balance_and_progress(session, current_user.id, language)


@router.post("/rewards/levels/{level_id}/redeem", status_code=201, response_model=RedemptionResult)
async def redeem_reward_level(
    level_id: uuid.UUID,
    payload: RedeemPayload | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> dict:
    chosen = payload.chosen_option if payload else None
    return await rewards_service.redeem(session, current_user.id, level_id, chosen)
