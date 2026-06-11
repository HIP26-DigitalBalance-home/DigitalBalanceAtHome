import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.dependencies.auth import get_current_user_allow_pending
from app.dependencies.database import get_db
from app.main import app


def _deletion_pending_user() -> MagicMock:
    user = MagicMock()
    user.id = uuid.uuid4()
    user.email = "pending@example.com"
    user.display_name = "Pending User"
    user.profile_photo_key = None
    user.points_balance = 0
    user.deletion_pending_at = datetime.now(timezone.utc)
    user.created_at = datetime.now(timezone.utc)
    return user


@pytest.fixture
async def deletion_pending_client():
    """Client authenticated as a user with deletion_pending_at set."""
    mock_user = _deletion_pending_user()

    async def mock_get_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = mock_get_db
    app.dependency_overrides[get_current_user_allow_pending] = lambda: mock_user

    from httpx import ASGITransport, AsyncClient

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


class TestDeleteMe:
    async def test_schedules_deletion_returns_202(self, auth_client, mocker):
        deletion_at = datetime.now(timezone.utc)
        expected_date = deletion_at + timedelta(days=30)

        mocker.patch(
            "app.api.users.user_service.delete_me",
            return_value={"message": "Scheduled.", "deletion_date": expected_date},
        )

        response = await auth_client.delete("/users/me")

        assert response.status_code == 202
        data = response.json()
        assert "deletion_date" in data
        assert "message" in data

    async def test_requires_authentication(self, client):
        response = await client.delete("/users/me")
        assert response.status_code in (401, 403)


class TestCancelDeletion:
    async def test_cancels_pending_deletion(self, deletion_pending_client, mocker):
        user = app.dependency_overrides[get_current_user_allow_pending]()
        user.deletion_pending_at = None  # simulate post-cancel state

        mocker.patch(
            "app.api.users.user_service.cancel_deletion",
            return_value={
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "profile_photo_url": None,
                "points_balance": 0,
                "deletion_pending_at": None,
                "created_at": datetime.now(timezone.utc),
            },
        )

        response = await deletion_pending_client.post("/users/me/cancel-deletion")

        assert response.status_code == 200
        assert response.json()["deletion_pending_at"] is None

    async def test_requires_authentication(self, client):
        response = await client.post("/users/me/cancel-deletion")
        assert response.status_code in (401, 403)

    async def test_no_pending_deletion_returns_409(self, auth_client, mocker):
        from app.services.exceptions import NoDeletionPending

        mocker.patch("app.api.users.user_service.cancel_deletion", side_effect=NoDeletionPending())

        response = await auth_client.post("/users/me/cancel-deletion")

        assert response.status_code == 409

    async def test_deletion_pending_user_can_reach_cancel_endpoint(self, deletion_pending_client, mocker):
        """A user with deletion_pending_at set must be able to reach this endpoint (not 403'd)."""
        user = app.dependency_overrides[get_current_user_allow_pending]()

        mocker.patch(
            "app.api.users.user_service.cancel_deletion",
            return_value={
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "profile_photo_url": None,
                "points_balance": 0,
                "deletion_pending_at": None,
                "created_at": datetime.now(timezone.utc),
            },
        )

        response = await deletion_pending_client.post("/users/me/cancel-deletion")
        assert response.status_code == 200, (
            f"Expected 200 for deletion-pending user, got {response.status_code}: {response.text}"
        )


class TestExportData:
    async def test_returns_data_export_shape(self, auth_client, mocker):
        from app.dependencies.auth import get_current_user as _get_current_user

        user = app.dependency_overrides[_get_current_user]()

        mocker.patch(
            "app.api.users.user_service.export_data",
            return_value={
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "display_name": user.display_name,
                    "profile_photo_url": None,
                    "points_balance": 0,
                    "deletion_pending_at": None,
                    "created_at": datetime.now(timezone.utc),
                },
                "children": [],
                "consents": [],
                "group_memberships": [],
                "completions": [],
            },
        )

        response = await auth_client.get("/users/me/export")

        assert response.status_code == 200
        data = response.json()
        assert "user" in data
        assert "children" in data
        assert "consents" in data
        assert "group_memberships" in data
        assert "completions" in data

    async def test_requires_authentication(self, client):
        response = await client.get("/users/me/export")
        assert response.status_code in (401, 403)
