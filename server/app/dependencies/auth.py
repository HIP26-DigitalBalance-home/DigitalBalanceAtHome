import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.database import get_db
from app.models.user import User
from app.repositories.user import UserRepository
from app.services.auth import decode_access_token
from app.services.consent import check_consent_current

_bearer = HTTPBearer()


async def _resolve_user(credentials: HTTPAuthorizationCredentials, session: AsyncSession) -> User:
    try:
        user_id: uuid.UUID = decode_access_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    session: AsyncSession = Depends(get_db),
) -> User:
    user = await _resolve_user(credentials, session)
    if user.deletion_pending_at is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account scheduled for deletion")
    return user


async def get_current_user_allow_pending(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    session: AsyncSession = Depends(get_db),
) -> User:
    """Like get_current_user but allows users with a pending deletion through.
    Use only for the cancel-deletion endpoint."""
    return await _resolve_user(credentials, session)


async def get_current_user_with_consent_check(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    session: AsyncSession = Depends(get_db),
) -> User:
    """Like get_current_user but also verifies the user has accepted the current policy version.
    Use on mutation endpoints where fresh consent is required (completions, photo uploads)."""
    user = await _resolve_user(credentials, session)
    if user.deletion_pending_at is not None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account scheduled for deletion")
    await check_consent_current(session, user.id)
    return user
