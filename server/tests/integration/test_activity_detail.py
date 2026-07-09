import uuid
from unittest.mock import MagicMock

from app.services.exceptions import ActivityNotFound


def _make_activity() -> MagicMock:
    activity = MagicMock()
    activity.id = uuid.uuid4()
    activity.title = "Plätzchen backen"
    activity.title_en = "Bake cookies"
    activity.description = "Kekse"
    activity.description_en = "Cookies"
    activity.estimated_duration_minutes = 60
    activity.age_min = 3
    activity.age_max = 12
    activity.cost_indicator = "free"
    activity.season_relevance = None
    activity.weather_suitability = None
    activity.is_partner_content = False
    activity.effort_tier = "casual"
    activity.language = "de"
    return activity


def _resources() -> list[dict]:
    return [
        {
            "id": str(uuid.uuid4()),
            "kind": "external",
            "position": 0,
            "label": "Unser Rezept",
            "url": "https://example.com/rezept",
            "note_text": None,
        },
        {
            "id": str(uuid.uuid4()),
            "kind": "internal",
            "position": 1,
            "label": None,
            "url": None,
            "note_text": "Wir nehmen die Hälfte Zucker.",
            "photos": [
                {
                    "id": str(uuid.uuid4()),
                    "status": "ready",
                    "position": 0,
                    "photo_url": "https://s3.example.com/signed",
                },
                {
                    "id": str(uuid.uuid4()),
                    "status": "processing",
                    "position": 1,
                    "photo_url": None,
                },
            ],
        },
    ]


class TestGetActivityDetail:
    async def test_requires_auth(self, client):
        response = await client.get(f"/activities/{uuid.uuid4()}")
        assert response.status_code in (401, 403)

    async def test_owner_sees_resources_in_order_with_can_edit(self, auth_client, mocker):
        activity = _make_activity()
        mocker.patch(
            "app.api.activities.resource_service.get_activity_with_resources",
            return_value=(activity, True, _resources()),
        )
        response = await auth_client.get(f"/activities/{activity.id}")
        assert response.status_code == 200
        body = response.json()
        assert body["can_edit"] is True
        assert [r["position"] for r in body["resources"]] == [0, 1]
        assert body["resources"][0]["url"] == "https://example.com/rezept"

    async def test_ready_photo_has_url_processing_does_not(self, auth_client, mocker):
        activity = _make_activity()
        mocker.patch(
            "app.api.activities.resource_service.get_activity_with_resources",
            return_value=(activity, True, _resources()),
        )
        response = await auth_client.get(f"/activities/{activity.id}")
        photos = response.json()["resources"][1]["photos"]
        assert photos[0]["status"] == "ready"
        assert photos[0]["photo_url"] == "https://s3.example.com/signed"
        assert photos[1]["status"] == "processing"
        assert photos[1]["photo_url"] is None

    async def test_accessible_non_owner_cannot_edit(self, auth_client, mocker):
        activity = _make_activity()
        mocker.patch(
            "app.api.activities.resource_service.get_activity_with_resources",
            return_value=(activity, False, _resources()),
        )
        response = await auth_client.get(f"/activities/{activity.id}")
        assert response.status_code == 200
        assert response.json()["can_edit"] is False

    async def test_inaccessible_activity_returns_404(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.resource_service.get_activity_with_resources",
            side_effect=ActivityNotFound("Activity not found"),
        )
        response = await auth_client.get(f"/activities/{uuid.uuid4()}")
        assert response.status_code == 404

    async def test_empty_resources(self, auth_client, mocker):
        activity = _make_activity()
        mocker.patch(
            "app.api.activities.resource_service.get_activity_with_resources",
            return_value=(activity, True, []),
        )
        response = await auth_client.get(f"/activities/{activity.id}")
        assert response.status_code == 200
        assert response.json()["resources"] == []
