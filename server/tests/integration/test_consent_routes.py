import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.rate_limit import _windows


@pytest.fixture(autouse=True)
def clear_rate_limit():
    _windows.clear()
    yield
    _windows.clear()


def _fake_consent(user_id: uuid.UUID) -> MagicMock:
    c = MagicMock()
    c.id = uuid.uuid4()
    c.user_id = user_id
    c.policy_version = "1.0"
    c.consented_at = datetime.now(timezone.utc)
    c.data_storage_consent = True
    c.photo_processing_consent = True
    c.location_consent = False
    return c


class TestCreateConsent:
    async def test_creates_consent_record(self, auth_client, mocker):
        from app.dependencies.auth import get_current_user
        from app.main import app
        user = app.dependency_overrides[get_current_user]()

        fake = _fake_consent(user.id)
        mocker.patch("app.api.consents.consent_service.create_consent", return_value=fake)

        response = await auth_client.post("/consents", json={
            "policy_version": "1.0",
            "data_storage_consent": True,
            "photo_processing_consent": True,
            "location_consent": False,
        })

        assert response.status_code == 201
        data = response.json()
        assert data["policy_version"] == "1.0"
        assert data["data_storage_consent"] is True

    async def test_requires_authentication(self, client):
        response = await client.post("/consents", json={
            "policy_version": "1.0",
            "data_storage_consent": True,
            "photo_processing_consent": True,
        })
        assert response.status_code in (401, 403)  # no Bearer token

    async def test_missing_required_field_returns_422(self, auth_client):
        response = await auth_client.post("/consents", json={
            "policy_version": "1.0",
            # missing data_storage_consent
        })
        assert response.status_code == 422


class TestGetConsent:
    async def test_returns_latest_consent(self, auth_client, mocker):
        from app.dependencies.auth import get_current_user
        from app.main import app
        user = app.dependency_overrides[get_current_user]()

        fake = _fake_consent(user.id)
        mocker.patch("app.api.consents.consent_service.get_consent", return_value=fake)

        response = await auth_client.get("/consents")

        assert response.status_code == 200
        assert response.json()["policy_version"] == "1.0"

    async def test_returns_404_when_no_consent(self, auth_client, mocker):
        mocker.patch("app.api.consents.consent_service.get_consent", return_value=None)

        response = await auth_client.get("/consents")

        assert response.status_code == 404
