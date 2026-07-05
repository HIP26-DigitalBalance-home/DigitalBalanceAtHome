import uuid
from unittest.mock import MagicMock

from app.services.exceptions import NoFamilyError


def _fake_activity(family_id: uuid.UUID | None = None) -> MagicMock:
    a = MagicMock()
    a.id = uuid.uuid4()
    a.title = "Build a kite"
    a.description = "Make and fly a paper kite together."
    a.title_en = None
    a.description_en = None
    a.estimated_duration_minutes = 30
    a.age_min = 0
    a.age_max = 18
    a.cost_indicator = "free"
    a.season_relevance = None
    a.weather_suitability = None
    a.is_partner_content = False
    a.effort_tier = "casual"
    a.language = "de"
    a.created_by_user_id = uuid.uuid4()
    a.family_id = family_id or uuid.uuid4()
    return a


class TestListActivities:
    async def test_requires_auth(self, client):
        response = await client.get("/activities")
        assert response.status_code in (401, 403)

    async def test_returns_activities(self, auth_client, mocker):
        activities = [_fake_activity(), _fake_activity()]
        mocker.patch("app.api.activities.activity_service.list_activities", return_value=activities)

        response = await auth_client.get("/activities")

        assert response.status_code == 200
        assert len(response.json()) == 2


class TestActivityLocalization:
    async def test_english_requested_returns_english(self, auth_client, mocker):
        a = _fake_activity()
        a.title = "Drachen bauen"
        a.description = "Einen Papierdrachen bauen und steigen lassen."
        a.title_en = "Build a kite"
        a.description_en = "Make and fly a paper kite together."
        mocker.patch("app.api.activities.activity_service.list_activities", return_value=[a])

        response = await auth_client.get("/activities", headers={"Accept-Language": "en"})

        assert response.status_code == 200
        item = response.json()[0]
        assert item["title"] == "Build a kite"
        assert item["description"] == "Make and fly a paper kite together."

    async def test_default_is_german_base(self, auth_client, mocker):
        a = _fake_activity()
        a.title = "Drachen bauen"
        a.title_en = "Build a kite"
        mocker.patch("app.api.activities.activity_service.list_activities", return_value=[a])

        response = await auth_client.get("/activities")  # no Accept-Language

        assert response.json()[0]["title"] == "Drachen bauen"

    async def test_english_falls_back_when_untranslated(self, auth_client, mocker):
        a = _fake_activity()
        a.title = "Selbst erstellte Aktivität"
        a.title_en = None  # user-created content has no English translation
        mocker.patch("app.api.activities.activity_service.list_activities", return_value=[a])

        response = await auth_client.get("/activities", headers={"Accept-Language": "en"})

        assert response.json()[0]["title"] == "Selbst erstellte Aktivität"


class TestCreateActivity:
    async def test_success(self, auth_client, mocker):
        activity = _fake_activity()
        spy = mocker.patch("app.api.activities.activity_service.create_activity", return_value=activity)

        response = await auth_client.post(
            "/activities",
            json={"title": "Build a kite", "description": "Make and fly a paper kite together."},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Build a kite"
        assert data["age_min"] == 0
        assert data["age_max"] == 18
        spy.assert_awaited_once()

    async def test_no_family_returns_400(self, auth_client, mocker):
        mocker.patch(
            "app.api.activities.activity_service.create_activity",
            side_effect=NoFamilyError("No family"),
        )

        response = await auth_client.post("/activities", json={"title": "Build a kite"})

        assert response.status_code == 400
        assert response.json()["code"] == "no_family"

    async def test_missing_title_returns_422(self, auth_client):
        response = await auth_client.post("/activities", json={"description": "no title"})
        assert response.status_code == 422
