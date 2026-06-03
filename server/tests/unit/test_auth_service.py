import uuid
from datetime import datetime, timezone

import pytest
from jose import jwt

from app.core.config import settings
from app.services.auth import (
    _ALGORITHM,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    extract_google_claims,
)

_USER_ID = uuid.uuid4()


class TestAccessTokens:
    def test_roundtrip(self):
        token = create_access_token(_USER_ID)
        result = decode_access_token(token)
        assert result == _USER_ID

    def test_expired_token_raises(self):
        expired = jwt.encode(
            {"sub": str(_USER_ID), "type": "access", "exp": 1},
            settings.JWT_SECRET,
            algorithm=_ALGORITHM,
        )
        with pytest.raises(ValueError, match="Invalid access token"):
            decode_access_token(expired)

    def test_wrong_type_raises(self):
        refresh = create_refresh_token(_USER_ID)
        with pytest.raises(ValueError, match="Not an access token"):
            decode_access_token(refresh)

    def test_tampered_token_raises(self):
        token = create_access_token(_USER_ID) + "tampered"
        with pytest.raises(ValueError):
            decode_access_token(token)


class TestRefreshTokens:
    def test_roundtrip(self):
        token = create_refresh_token(_USER_ID)
        result = decode_refresh_token(token)
        assert result == _USER_ID

    def test_each_token_has_unique_jti(self):
        t1 = jwt.decode(
            create_refresh_token(_USER_ID), settings.JWT_SECRET, algorithms=[_ALGORITHM]
        )
        t2 = jwt.decode(
            create_refresh_token(_USER_ID), settings.JWT_SECRET, algorithms=[_ALGORITHM]
        )
        assert t1["jti"] != t2["jti"]

    def test_wrong_type_raises(self):
        access = create_access_token(_USER_ID)
        with pytest.raises(ValueError, match="Not a refresh token"):
            decode_refresh_token(access)


class TestExtractGoogleClaims:
    def _make_id_token(self, aud: str, exp: int | None = None) -> str:
        payload = {
            "sub": "google_123",
            "email": "user@example.com",
            "name": "Test User",
            "aud": aud,
            "iss": "https://accounts.google.com",
            "exp": exp or int(datetime.now(timezone.utc).timestamp()) + 3600,
        }
        return jwt.encode(payload, "any-secret", algorithm=_ALGORITHM)

    def test_valid_claims_returned(self):
        token = self._make_id_token(aud=settings.GOOGLE_CLIENT_ID)
        claims = extract_google_claims(token, settings.GOOGLE_CLIENT_ID)
        assert claims["sub"] == "google_123"
        assert claims["email"] == "user@example.com"

    def test_wrong_audience_raises(self):
        token = self._make_id_token(aud="wrong-client-id")
        with pytest.raises(ValueError, match="audience mismatch"):
            extract_google_claims(token, settings.GOOGLE_CLIENT_ID)

    def test_expired_token_raises(self):
        token = self._make_id_token(aud=settings.GOOGLE_CLIENT_ID, exp=1)
        with pytest.raises(ValueError, match="expired"):
            extract_google_claims(token, settings.GOOGLE_CLIENT_ID)

    def test_audience_as_list_accepted(self):
        payload = {
            "sub": "google_123",
            "email": "user@example.com",
            "aud": [settings.GOOGLE_CLIENT_ID, "other-id"],
            "exp": int(datetime.now(timezone.utc).timestamp()) + 3600,
        }
        token = jwt.encode(payload, "any-secret", algorithm=_ALGORITHM)
        claims = extract_google_claims(token, settings.GOOGLE_CLIENT_ID)
        assert claims["sub"] == "google_123"
