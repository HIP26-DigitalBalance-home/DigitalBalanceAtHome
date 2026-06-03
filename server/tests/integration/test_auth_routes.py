import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.rate_limit import _windows
from app.services.auth import create_refresh_token


@pytest.fixture(autouse=True)
def clear_rate_limit():
    _windows.clear()
    yield
    _windows.clear()


def _fake_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.uuid4()
    user.email = "parent@example.com"
    user.display_name = "Test Parent"
    user.profile_photo_key = None
    user.points_balance = 0
    user.deletion_pending_at = None
    user.created_at = datetime.now(timezone.utc)
    return user


# ── /auth/google/callback ───────────────────────────────────────────────────


class TestGoogleCallback:
    async def test_success_returns_tokens_and_user(self, client, mocker):
        user = _fake_user()
        mocker.patch("app.api.auth.auth_service.exchange_google_code", return_value={"id_token": "fake.id.token"})
        mocker.patch(
            "app.api.auth.auth_service.extract_google_claims",
            return_value={
                "sub": "google_sub_123",
                "email": user.email,
                "name": user.display_name,
            },
        )
        mock_repo = AsyncMock()
        mock_repo.upsert_by_google_sub.return_value = user
        mocker.patch("app.api.auth.UserRepository", return_value=mock_repo)

        response = await client.post(
            "/auth/google/callback",
            json={
                "code": "auth_code_abc",
                "redirect_uri": "https://auth.expo.io/callback",
                "code_verifier": "pkce_verifier",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == user.email
        assert data["user"]["points_balance"] == 0

    async def test_google_exchange_failure_returns_401(self, client, mocker):
        mocker.patch(
            "app.api.auth.auth_service.exchange_google_code",
            side_effect=ValueError("Google token exchange failed"),
        )

        response = await client.post(
            "/auth/google/callback",
            json={
                "code": "bad_code",
                "redirect_uri": "https://auth.expo.io/callback",
            },
        )

        assert response.status_code == 401

    async def test_missing_id_token_in_google_response_returns_401(self, client, mocker):
        mocker.patch("app.api.auth.auth_service.exchange_google_code", return_value={})

        response = await client.post(
            "/auth/google/callback",
            json={
                "code": "auth_code",
                "redirect_uri": "https://auth.expo.io/callback",
            },
        )

        assert response.status_code == 401

    async def test_invalid_claims_returns_401(self, client, mocker):
        mocker.patch("app.api.auth.auth_service.exchange_google_code", return_value={"id_token": "fake"})
        mocker.patch(
            "app.api.auth.auth_service.extract_google_claims",
            side_effect=ValueError("audience mismatch"),
        )

        response = await client.post(
            "/auth/google/callback",
            json={
                "code": "auth_code",
                "redirect_uri": "https://auth.expo.io/callback",
            },
        )

        assert response.status_code == 401

    async def test_missing_both_code_and_id_token_returns_400(self, client):
        # Neither id_token (web flow) nor code (native flow) provided
        response = await client.post("/auth/google/callback", json={})
        assert response.status_code == 400

    async def test_rate_limit_after_10_requests(self, client, mocker):
        mocker.patch(
            "app.api.auth.auth_service.exchange_google_code",
            side_effect=ValueError("bad code"),
        )
        payload = {"code": "x", "redirect_uri": "https://auth.expo.io/callback"}

        for _ in range(10):
            await client.post("/auth/google/callback", json=payload)

        response = await client.post("/auth/google/callback", json=payload)
        assert response.status_code == 429


# ── /auth/refresh ───────────────────────────────────────────────────────────


class TestRefresh:
    async def test_valid_refresh_token_returns_new_tokens(self, client, mocker):
        user = _fake_user()
        refresh_token = create_refresh_token(user.id)

        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = user
        mocker.patch("app.api.auth.UserRepository", return_value=mock_repo)

        response = await client.post("/auth/refresh", json={"refresh_token": refresh_token})

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        # New refresh token should be a different value (rotation)
        assert data["refresh_token"] != refresh_token

    async def test_invalid_refresh_token_returns_401(self, client):
        response = await client.post("/auth/refresh", json={"refresh_token": "not.a.valid.token"})
        assert response.status_code == 401

    async def test_access_token_used_as_refresh_returns_401(self, client, mocker):
        user = _fake_user()
        from app.services.auth import create_access_token

        access_token = create_access_token(user.id)

        response = await client.post("/auth/refresh", json={"refresh_token": access_token})
        assert response.status_code == 401

    async def test_user_not_found_returns_401(self, client, mocker):
        refresh_token = create_refresh_token(uuid.uuid4())
        mock_repo = AsyncMock()
        mock_repo.get_by_id.return_value = None
        mocker.patch("app.api.auth.UserRepository", return_value=mock_repo)

        response = await client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert response.status_code == 401


# ── /auth/logout ─────────────────────────────────────────────────────────────


class TestLogout:
    async def test_logout_returns_204(self, client):
        response = await client.delete("/auth/logout")
        assert response.status_code == 204
        assert response.content == b""


# ── /healthz ─────────────────────────────────────────────────────────────────


class TestHealth:
    async def test_healthz_with_db(self, client):
        response = await client.get("/healthz")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
