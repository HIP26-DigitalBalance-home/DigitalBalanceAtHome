import uuid
from datetime import date, datetime, timezone
from unittest.mock import MagicMock


def _fake_entry(user_id: uuid.UUID, entry_date: str = "2026-07-02", mood: str = "good") -> MagicMock:
    e = MagicMock()
    e.id = uuid.uuid4()
    e.user_id = user_id
    e.entry_date = date.fromisoformat(entry_date)
    e.mood = mood
    e.created_at = datetime.now(timezone.utc)
    return e


class TestCreateJournalEntry:
    async def test_creates_entry(self, auth_client, mocker):
        from app.dependencies.auth import get_current_user
        from app.main import app

        user = app.dependency_overrides[get_current_user]()
        fake = _fake_entry(user.id)
        mocker.patch("app.api.journal.journal_service.create_entry", return_value=fake)

        response = await auth_client.post("/journal/entries", json={"entry_date": "2026-07-02", "mood": "good"})

        assert response.status_code == 201
        data = response.json()
        assert data["mood"] == "good"
        assert data["entry_date"] == "2026-07-02"

    async def test_conflict_when_already_answered(self, auth_client, mocker):
        from app.services.exceptions import JournalEntryExists

        mocker.patch(
            "app.api.journal.journal_service.create_entry",
            side_effect=JournalEntryExists("Journal entry already exists for this date"),
        )

        response = await auth_client.post("/journal/entries", json={"entry_date": "2026-07-02", "mood": "good"})

        assert response.status_code == 409
        assert response.json()["code"] == "journal_entry_exists"

    async def test_rejects_unknown_mood(self, auth_client):
        response = await auth_client.post("/journal/entries", json={"entry_date": "2026-07-02", "mood": "amazing"})
        assert response.status_code == 422

    async def test_requires_auth(self, client):
        response = await client.post("/journal/entries", json={"entry_date": "2026-07-02", "mood": "good"})
        assert response.status_code == 401


class TestGetJournalEntries:
    async def test_returns_entries_in_range(self, auth_client, mocker):
        from app.dependencies.auth import get_current_user
        from app.main import app

        user = app.dependency_overrides[get_current_user]()
        fakes = [
            _fake_entry(user.id, "2026-06-29", "okay"),
            _fake_entry(user.id, "2026-07-01", "super"),
        ]
        mocker.patch("app.api.journal.journal_service.list_entries", return_value=fakes)

        response = await auth_client.get(
            "/journal/entries", params={"start_date": "2026-06-29", "end_date": "2026-07-05"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["entry_date"] == "2026-06-29"
        assert data[1]["mood"] == "super"

    async def test_invalid_range_returns_400(self, auth_client, mocker):
        from app.services.exceptions import InvalidDateRange

        mocker.patch(
            "app.api.journal.journal_service.list_entries",
            side_effect=InvalidDateRange("end_date must be on or after start_date"),
        )

        response = await auth_client.get(
            "/journal/entries", params={"start_date": "2026-07-05", "end_date": "2026-06-29"}
        )

        assert response.status_code == 400

    async def test_missing_params_rejected(self, auth_client):
        response = await auth_client.get("/journal/entries")
        assert response.status_code == 422

    async def test_requires_auth(self, client):
        response = await client.get("/journal/entries", params={"start_date": "2026-06-29", "end_date": "2026-07-05"})
        assert response.status_code == 401
