import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace


def _insight(period: str = "weekly") -> dict:
    return {
        "period": period,
        "range_start": date(2026, 7, 6),
        "range_end": date(2026, 7, 12),
        "elapsed_end": date(2026, 7, 6),
        "daily_totals": [
            {
                "date": date(2026, 7, 6),
                "activity_minutes": 30,
                "manual_minutes": 15,
                "total_minutes": 45,
            }
        ],
        "weekly_totals": [],
        "average_weekly_minutes": None,
    }


class TestGetTimeSpent:
    async def test_returns_personal_insight(self, auth_client, mocker):
        service = mocker.patch("app.api.time_spent.time_spent_service.get_insight", return_value=_insight())

        response = await auth_client.get("/time-spent", params={"period": "weekly", "anchor_date": "2026-07-06"})

        assert response.status_code == 200
        assert response.json()["daily_totals"][0]["total_minutes"] == 45
        assert service.await_args.args[1] is not None

    async def test_returns_monthly_insight(self, auth_client, mocker):
        service = mocker.patch(
            "app.api.time_spent.time_spent_service.get_insight",
            return_value=_insight("monthly"),
        )

        response = await auth_client.get(
            "/time-spent",
            params={"period": "monthly", "anchor_date": "2026-07-06"},
        )

        assert response.status_code == 200
        assert response.json()["period"] == "monthly"
        assert service.await_args.args[2] == "monthly"

    async def test_rejects_invalid_period(self, auth_client):
        response = await auth_client.get("/time-spent", params={"period": "yearly", "anchor_date": "2026-07-06"})
        assert response.status_code == 422

    async def test_requires_auth(self, client):
        response = await client.get("/time-spent", params={"period": "weekly", "anchor_date": "2026-07-06"})
        assert response.status_code == 401


class TestUpsertManualTime:
    async def test_upserts_for_current_user(self, auth_client, mocker):
        now = datetime.now(timezone.utc)
        entry = SimpleNamespace(
            id=uuid.uuid4(), entry_date=date(2026, 7, 5), minutes=30, created_at=now, updated_at=now
        )
        service = mocker.patch("app.api.time_spent.time_spent_service.upsert_manual_time", return_value=entry)

        response = await auth_client.put("/time-spent/manual", json={"entry_date": "2026-07-05", "minutes": 30})

        assert response.status_code == 200
        assert response.json()["minutes"] == 30
        assert service.await_args.args[1] is not None

    async def test_validates_minutes(self, auth_client):
        for minutes in (0, -1, 1441):
            response = await auth_client.put(
                "/time-spent/manual", json={"entry_date": "2026-07-05", "minutes": minutes}
            )
            assert response.status_code == 422

    async def test_requires_auth(self, client):
        response = await client.put("/time-spent/manual", json={"entry_date": "2026-07-05", "minutes": 30})
        assert response.status_code == 401
