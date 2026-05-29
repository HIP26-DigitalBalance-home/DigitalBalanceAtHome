import uuid
from datetime import datetime, timedelta, timezone

import httpx
from jose import JWTError, jwt

from app.core.config import settings

_ALGORITHM = "HS256"
_ACCESS_EXPIRE_MINUTES = 15
_REFRESH_EXPIRE_DAYS = 7


async def verify_google_id_token(id_token: str) -> dict:
    """Verify a Google ID token via the tokeninfo endpoint (used in the web flow)."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": id_token},
        )
    if response.status_code != 200:
        raise ValueError(f"Invalid Google ID token: {response.text}")
    claims = response.json()
    aud = claims.get("aud")
    if isinstance(aud, list):
        if settings.GOOGLE_CLIENT_ID not in aud:
            raise ValueError("Token audience mismatch")
    elif aud != settings.GOOGLE_CLIENT_ID:
        raise ValueError("Token audience mismatch")
    return claims


async def exchange_google_code(
    code: str,
    redirect_uri: str,
    code_verifier: str | None,
) -> dict:
    """Exchange an authorization code with Google and return the token response."""
    payload: dict = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    if code_verifier:
        payload["code_verifier"] = code_verifier

    async with httpx.AsyncClient() as client:
        response = await client.post("https://oauth2.googleapis.com/token", data=payload)

    if response.status_code != 200:
        raise ValueError(f"Google token exchange failed: {response.text}")

    return response.json()


def extract_google_claims(id_token: str, expected_client_id: str) -> dict:
    """Decode and validate claims from a Google ID token.

    Safe to call without signature verification because the token was obtained
    directly from Google's token endpoint using our client_secret.
    """
    claims = jwt.get_unverified_claims(id_token)

    aud = claims.get("aud")
    if isinstance(aud, list):
        if expected_client_id not in aud:
            raise ValueError("Token audience mismatch")
    elif aud != expected_client_id:
        raise ValueError("Token audience mismatch")

    exp = claims.get("exp", 0)
    if exp < datetime.now(timezone.utc).timestamp():
        raise ValueError("ID token expired")

    return claims


def create_access_token(user_id: uuid.UUID) -> str:
    payload = {
        "sub": str(user_id),
        "type": "access",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=_ACCESS_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=_ALGORITHM)


def create_refresh_token(user_id: uuid.UUID) -> str:
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "jti": str(uuid.uuid4()),
        "exp": datetime.now(timezone.utc) + timedelta(days=_REFRESH_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=_ALGORITHM)


def decode_access_token(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[_ALGORITHM])
    except JWTError:
        raise ValueError("Invalid access token")
    if payload.get("type") != "access":
        raise ValueError("Not an access token")
    return uuid.UUID(payload["sub"])


def decode_refresh_token(token: str) -> uuid.UUID:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[_ALGORITHM])
    except JWTError:
        raise ValueError("Invalid refresh token")
    if payload.get("type") != "refresh":
        raise ValueError("Not a refresh token")
    return uuid.UUID(payload["sub"])
