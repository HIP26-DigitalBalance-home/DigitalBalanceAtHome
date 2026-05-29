from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.rate_limit import is_allowed
from app.dependencies.database import get_db
from app.models.user import User
from app.repositories.user import UserRepository
from app.schemas.generated import GoogleCallbackRequest, RefreshRequest, TokenResponse
from app.services import auth as auth_service

router = APIRouter()


def _user_schema(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "profile_photo_url": None,
        "points_balance": user.points_balance,
        "deletion_pending_at": user.deletion_pending_at,
        "created_at": user.created_at,
    }


def _token_response(user: User) -> dict:
    return {
        "access_token": auth_service.create_access_token(user.id),
        "refresh_token": auth_service.create_refresh_token(user.id),
        "token_type": "bearer",
        "user": _user_schema(user),
    }


async def _rate_limit(request: Request) -> None:
    ip = request.client.host if request.client else "unknown"
    if not await is_allowed(f"auth:{ip}"):
        raise HTTPException(status_code=429, detail="Too many authentication attempts")


@router.post("/google/callback", response_model=TokenResponse)
async def google_callback(
    body: GoogleCallbackRequest,
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> dict:
    await _rate_limit(request)

    if not body.id_token and not body.code:
        raise HTTPException(status_code=400, detail="Either 'id_token' (web) or 'code' (native) is required")

    try:
        if body.id_token:
            # Web flow: id_token received directly from the client
            claims = await auth_service.verify_google_id_token(body.id_token)
        else:
            # Native flow: exchange authorization code on the server
            token_data = await auth_service.exchange_google_code(
                code=body.code,
                redirect_uri=body.redirect_uri or "",
                code_verifier=body.code_verifier,
            )
            id_token = token_data.get("id_token")
            if not id_token:
                raise ValueError("No ID token in Google response")
            claims = auth_service.extract_google_claims(id_token, settings.GOOGLE_CLIENT_ID)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))

    repo = UserRepository(session)
    user = await repo.upsert_by_google_sub(
        google_sub=claims["sub"],
        email=claims["email"],
        display_name=claims.get("name") or claims["email"],
    )

    return _token_response(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(
    body: RefreshRequest,
    request: Request,
    session: AsyncSession = Depends(get_db),
) -> dict:
    await _rate_limit(request)

    try:
        user_id = auth_service.decode_refresh_token(body.refresh_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    repo = UserRepository(session)
    user = await repo.get_by_id(user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    return _token_response(user)


@router.delete("/logout", status_code=204)
async def logout() -> None:
    # Tokens are stateless JWTs; client discards them on receipt of 204
    return None
