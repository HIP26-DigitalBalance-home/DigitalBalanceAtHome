"""Integration tests for upload size limits, image validation, rate limits,
and pagination clamps."""

import uuid
from unittest.mock import AsyncMock

from app.core.config import settings
from app.dependencies.rate_limit import photo_upload_limiter
from app.main import app
from app.repositories.rate_limit import RateLimitRepository


class TestUploadSizeLimit:
    async def test_oversized_upload_returns_413(self, auth_client, monkeypatch):
        monkeypatch.setattr(settings, "MAX_UPLOAD_BYTES", 1024)
        response = await auth_client.post(
            "/photos",
            data={"challenge_activity_id": str(uuid.uuid4()), "completed_on": "2026-07-09"},
            files={"image": ("big.jpg", b"x" * 4096, "image/jpeg")},
        )
        assert response.status_code == 413
        assert "smaller" in response.json()["detail"]

    async def test_oversized_resource_photo_returns_413(self, auth_client, monkeypatch):
        monkeypatch.setattr(settings, "MAX_UPLOAD_BYTES", 1024)
        response = await auth_client.post(
            f"/activities/{uuid.uuid4()}/resources/photos",
            files={"image": ("big.jpg", b"x" * 4096, "image/jpeg")},
        )
        assert response.status_code == 413

    async def test_oversized_avatar_returns_413(self, auth_client, monkeypatch):
        monkeypatch.setattr(settings, "MAX_UPLOAD_BYTES", 1024)
        response = await auth_client.patch(
            "/users/me",
            files={"image": ("big.jpg", b"x" * 4096, "image/jpeg")},
        )
        assert response.status_code == 413

    async def test_oversized_reupload_returns_413(self, auth_client, monkeypatch):
        monkeypatch.setattr(settings, "MAX_UPLOAD_BYTES", 1024)
        response = await auth_client.patch(
            f"/completions/{uuid.uuid4()}/photo",
            files={"image": ("big.jpg", b"x" * 4096, "image/jpeg")},
        )
        assert response.status_code == 413


class TestImageValidation:
    async def test_garbage_bytes_rejected(self, auth_client):
        response = await auth_client.post(
            "/photos",
            data={"challenge_activity_id": str(uuid.uuid4()), "completed_on": "2026-07-09"},
            files={"image": ("fake.jpg", b"not an image", "image/jpeg")},
        )
        assert response.status_code == 400
        assert "not a valid image" in response.json()["detail"]

    async def test_decompression_bomb_rejected(self, auth_client, bomb_png):
        response = await auth_client.post(
            "/photos",
            data={"challenge_activity_id": str(uuid.uuid4()), "completed_on": "2026-07-09"},
            files={"image": ("bomb.png", bomb_png, "image/png")},
        )
        assert response.status_code == 400
        assert "dimensions" in response.json()["detail"]

    async def test_wrong_content_type_rejected(self, auth_client):
        response = await auth_client.post(
            "/photos",
            data={"challenge_activity_id": str(uuid.uuid4()), "completed_on": "2026-07-09"},
            files={"image": ("doc.pdf", b"%PDF-1.4", "application/pdf")},
        )
        assert response.status_code == 400


class TestPerUserRateLimit:
    async def test_upload_over_rate_limit_returns_429(self, auth_client, mocker, tiny_jpeg):
        # Re-enable the real limiter for this test and force the counter over
        app.dependency_overrides.pop(photo_upload_limiter, None)
        mocker.patch.object(RateLimitRepository, "hit", AsyncMock(return_value=10_000))

        response = await auth_client.post(
            "/photos",
            data={"challenge_activity_id": str(uuid.uuid4()), "completed_on": "2026-07-09"},
            files={"image": ("activity.jpg", tiny_jpeg, "image/jpeg")},
        )
        assert response.status_code == 429
        assert response.json()["code"] == "rate_limited"

    async def test_upload_under_rate_limit_passes(self, auth_client, mocker, tiny_jpeg):
        app.dependency_overrides.pop(photo_upload_limiter, None)
        mocker.patch.object(RateLimitRepository, "hit", AsyncMock(return_value=1))
        mocker.patch(
            "app.api.photos.completion_service.start_photo_completion",
            AsyncMock(return_value=(mocker.MagicMock(id=uuid.uuid4()), "raw/k", "photos/k")),
        )
        mocker.patch("app.api.photos.completion_service.compress_photo")

        response = await auth_client.post(
            "/photos",
            data={"challenge_activity_id": str(uuid.uuid4()), "completed_on": "2026-07-09"},
            files={"image": ("activity.jpg", tiny_jpeg, "image/jpeg")},
        )
        assert response.status_code == 202


class TestPaginationClamps:
    async def test_completions_limit_above_max_rejected(self, auth_client):
        response = await auth_client.get("/completions/me?limit=1000")
        assert response.status_code == 422

    async def test_completions_negative_offset_rejected(self, auth_client):
        response = await auth_client.get("/completions/me?offset=-1")
        assert response.status_code == 422

    async def test_completions_limit_at_max_accepted(self, auth_client, mocker):
        mocker.patch("app.api.completions.completion_service.get_my_history", AsyncMock(return_value=[]))
        response = await auth_client.get("/completions/me?limit=100")
        assert response.status_code == 200

    async def test_group_feed_limit_clamped(self, auth_client):
        response = await auth_client.get(f"/groups/{uuid.uuid4()}/feed?limit=999")
        assert response.status_code == 422

    async def test_activities_limit_clamped(self, auth_client):
        response = await auth_client.get("/activities?limit=101")
        assert response.status_code == 422
