import uuid

from app.services.exceptions import (
    InvalidResource,
    NotResourceOwner,
    ResourceNotFound,
)


def _external_dict(label: str = "Besseres Rezept") -> dict:
    return {
        "id": str(uuid.uuid4()),
        "kind": "external",
        "position": 0,
        "label": label,
        "url": "https://example.com/rezept",
        "note_text": None,
    }


class TestUpdateResource:
    async def test_requires_auth(self, client):
        response = await client.patch(
            f"/activities/{uuid.uuid4()}/resources/{uuid.uuid4()}",
            json={"label": "Besseres Rezept"},
        )
        assert response.status_code in (401, 403)

    async def test_update_label(self, auth_client, mocker):
        spy = mocker.patch(
            "app.api.activities.resource_service.update_resource",
            return_value=_external_dict(),
        )
        response = await auth_client.patch(
            f"/activities/{uuid.uuid4()}/resources/{uuid.uuid4()}",
            json={"label": "Besseres Rezept"},
        )
        assert response.status_code == 200
        assert response.json()["label"] == "Besseres Rezept"
        spy.assert_awaited_once()

    async def test_kind_mismatch_returns_400(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.update_resource",
            side_effect=InvalidResource("Only external resources have a link address"),
        )
        response = await auth_client.patch(
            f"/activities/{uuid.uuid4()}/resources/{uuid.uuid4()}",
            json={"url": "https://example.com"},
        )
        assert response.status_code == 400
        assert response.json()["code"] == "invalid_resource"

    async def test_non_owner_returns_403(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.update_resource",
            side_effect=NotResourceOwner("nope"),
        )
        response = await auth_client.patch(
            f"/activities/{uuid.uuid4()}/resources/{uuid.uuid4()}",
            json={"label": "x"},
        )
        assert response.status_code == 403

    async def test_missing_resource_returns_404(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.update_resource",
            side_effect=ResourceNotFound("Resource not found"),
        )
        response = await auth_client.patch(
            f"/activities/{uuid.uuid4()}/resources/{uuid.uuid4()}",
            json={"label": "x"},
        )
        assert response.status_code == 404
        assert response.json()["code"] == "resource_not_found"


class TestDeleteResource:
    async def test_success_returns_204(self, auth_client, mocker):
        spy = mocker.patch("app.api.activities.resource_service.delete_resource", return_value=None)
        response = await auth_client.delete(f"/activities/{uuid.uuid4()}/resources/{uuid.uuid4()}")
        assert response.status_code == 204
        spy.assert_awaited_once()

    async def test_non_owner_returns_403(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.delete_resource",
            side_effect=NotResourceOwner("nope"),
        )
        response = await auth_client.delete(f"/activities/{uuid.uuid4()}/resources/{uuid.uuid4()}")
        assert response.status_code == 403

    async def test_missing_returns_404(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.delete_resource",
            side_effect=ResourceNotFound("Resource not found"),
        )
        response = await auth_client.delete(f"/activities/{uuid.uuid4()}/resources/{uuid.uuid4()}")
        assert response.status_code == 404


class TestDeletePhoto:
    async def test_success_returns_204(self, auth_client, mocker):
        spy = mocker.patch("app.api.activities.resource_service.delete_photo", return_value=None)
        response = await auth_client.delete(
            f"/activities/{uuid.uuid4()}/resources/{uuid.uuid4()}/photos/{uuid.uuid4()}"
        )
        assert response.status_code == 204
        spy.assert_awaited_once()

    async def test_missing_photo_returns_404(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.delete_photo",
            side_effect=ResourceNotFound("Photo not found"),
        )
        response = await auth_client.delete(
            f"/activities/{uuid.uuid4()}/resources/{uuid.uuid4()}/photos/{uuid.uuid4()}"
        )
        assert response.status_code == 404
