import uuid

from app.services.exceptions import (
    ActivityNotFound,
    InvalidResource,
    NotResourceOwner,
    ResourceLimitExceeded,
)


def _external_dict() -> dict:
    return {
        "id": str(uuid.uuid4()),
        "kind": "external",
        "position": 0,
        "label": "Unser Rezept",
        "url": "https://example.com/rezept",
        "note_text": None,
    }


def _internal_dict(photos=None) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "kind": "internal",
        "position": 0,
        "label": None,
        "url": None,
        "note_text": "Wir nehmen die Hälfte Zucker.",
        "photos": photos or [],
    }


class TestCreateExternalResource:
    async def test_requires_auth(self, client):
        response = await client.post(
            f"/activities/{uuid.uuid4()}/resources",
            json={"kind": "external", "url": "https://example.com"},
        )
        assert response.status_code in (401, 403)

    async def test_success(self, auth_client, mocker):
        spy = mocker.patch(
            "app.api.activities.resource_service.create_external_resource",
            return_value=_external_dict(),
        )
        response = await auth_client.post(
            f"/activities/{uuid.uuid4()}/resources",
            json={"kind": "external", "label": "Unser Rezept", "url": "https://example.com/rezept"},
        )
        assert response.status_code == 201
        assert response.json()["url"] == "https://example.com/rezept"
        spy.assert_awaited_once()

    async def test_bad_url_returns_400(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.create_external_resource",
            side_effect=InvalidResource("Link must be a valid http(s) web address"),
        )
        response = await auth_client.post(
            f"/activities/{uuid.uuid4()}/resources",
            json={"kind": "external", "url": "ftp://nope"},
        )
        assert response.status_code == 400
        assert response.json()["code"] == "invalid_resource"

    async def test_non_owner_returns_403(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.create_external_resource",
            side_effect=NotResourceOwner("nope"),
        )
        response = await auth_client.post(
            f"/activities/{uuid.uuid4()}/resources",
            json={"kind": "external", "url": "https://example.com"},
        )
        assert response.status_code == 403
        assert response.json()["code"] == "not_resource_owner"

    async def test_unknown_activity_returns_404(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.create_external_resource",
            side_effect=ActivityNotFound("Activity not found"),
        )
        response = await auth_client.post(
            f"/activities/{uuid.uuid4()}/resources",
            json={"kind": "external", "url": "https://example.com"},
        )
        assert response.status_code == 404


class TestCreateInternalTextResource:
    async def test_success(self, auth_client, mocker):
        spy = mocker.patch(
            "app.api.activities.resource_service.create_internal_text_resource",
            return_value=_internal_dict(),
        )
        response = await auth_client.post(
            f"/activities/{uuid.uuid4()}/resources",
            json={"kind": "internal", "note_text": "Wir nehmen die Hälfte Zucker."},
        )
        assert response.status_code == 201
        assert response.json()["note_text"].startswith("Wir nehmen")
        spy.assert_awaited_once()

    async def test_empty_note_returns_400(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.create_internal_text_resource",
            side_effect=InvalidResource("A note needs some text (or add a photo instead)"),
        )
        response = await auth_client.post(
            f"/activities/{uuid.uuid4()}/resources",
            json={"kind": "internal", "note_text": "   "},
        )
        assert response.status_code == 400
        assert response.json()["code"] == "invalid_resource"

    async def test_limit_returns_400(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.create_internal_text_resource",
            side_effect=ResourceLimitExceeded("too many"),
        )
        response = await auth_client.post(
            f"/activities/{uuid.uuid4()}/resources",
            json={"kind": "internal", "note_text": "hi"},
        )
        assert response.status_code == 400
        assert response.json()["code"] == "resource_limit_exceeded"


class TestCreatePhotoResource:
    async def test_photo_only_creates_resource(self, auth_client, mocker):
        photo = {"id": str(uuid.uuid4()), "status": "processing", "position": 0, "photo_url": None}
        service = mocker.patch(
            "app.api.activities.resource_service.create_photo_only_resource",
            return_value=(_internal_dict(photos=[photo]), "raw/key", "photos/key", uuid.uuid4()),
        )
        compress = mocker.patch("app.api.activities.resource_service.compress_resource_photo")

        response = await auth_client.post(
            f"/activities/{uuid.uuid4()}/resources/photos",
            data={"note_text": "Fertige Kekse"},
            files={"image": ("cookies.jpg", b"jpeg-data", "image/jpeg")},
        )
        assert response.status_code == 202
        assert response.json()["photos"][0]["status"] == "processing"
        service.assert_awaited_once()
        compress.assert_called_once()

    async def test_add_photo_to_existing_resource(self, auth_client, mocker):
        photo = {"id": str(uuid.uuid4()), "status": "processing", "position": 1, "photo_url": None}
        service = mocker.patch(
            "app.api.activities.resource_service.add_photo",
            return_value=(photo, "raw/key", "photos/key", uuid.uuid4()),
        )
        compress = mocker.patch("app.api.activities.resource_service.compress_resource_photo")

        response = await auth_client.post(
            f"/activities/{uuid.uuid4()}/resources/{uuid.uuid4()}/photos",
            files={"image": ("cookies.jpg", b"jpeg-data", "image/jpeg")},
        )
        assert response.status_code == 202
        assert response.json()["status"] == "processing"
        service.assert_awaited_once()
        compress.assert_called_once()

    async def test_photo_limit_returns_400(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.add_photo",
            side_effect=ResourceLimitExceeded("A note can have at most 5 photos"),
        )
        response = await auth_client.post(
            f"/activities/{uuid.uuid4()}/resources/{uuid.uuid4()}/photos",
            files={"image": ("cookies.jpg", b"jpeg-data", "image/jpeg")},
        )
        assert response.status_code == 400
        assert response.json()["code"] == "resource_limit_exceeded"
