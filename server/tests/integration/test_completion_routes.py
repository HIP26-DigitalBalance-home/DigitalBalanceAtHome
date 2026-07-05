import uuid
from datetime import date, datetime, timezone
from types import SimpleNamespace


def _completion() -> dict:
    now = datetime.now(timezone.utc)
    return {
        "id": uuid.uuid4(),
        "challenge_activity_id": uuid.uuid4(),
        "family_id": uuid.uuid4(),
        "completed_by_user_id": uuid.uuid4(),
        "status": "self_reported",
        "photo_url": None,
        "caption": None,
        "rejection_reason": None,
        "duration_minutes": 75,
        "completed_on": date(2026, 7, 5),
        "shared_to_feed": False,
        "completed_at": now,
        "updated_at": now,
    }


class TestSelfReportedCompletionContract:
    async def test_requires_duration(self, auth_client):
        response = await auth_client.post(
            "/completions",
            json={"challenge_activity_id": str(uuid.uuid4()), "completed_on": "2026-07-05"},
        )
        assert response.status_code == 422

    async def test_requires_completed_on(self, auth_client):
        response = await auth_client.post(
            "/completions",
            json={"challenge_activity_id": str(uuid.uuid4()), "duration_minutes": 75},
        )
        assert response.status_code == 422

    async def test_passes_duration_and_date_to_service(self, auth_client, mocker):
        service = mocker.patch(
            "app.api.completions.completion_service.create_self_reported", return_value=_completion()
        )
        slot_id = uuid.uuid4()

        response = await auth_client.post(
            "/completions",
            json={
                "challenge_activity_id": str(slot_id),
                "duration_minutes": 75,
                "completed_on": "2026-07-05",
            },
        )

        assert response.status_code == 201
        assert response.json()["completed_on"] == "2026-07-05"
        assert service.await_args.args[-2:] == (75, date(2026, 7, 5))

    async def test_rejects_out_of_range_duration(self, auth_client):
        response = await auth_client.post(
            "/completions",
            json={
                "challenge_activity_id": str(uuid.uuid4()),
                "duration_minutes": 1441,
                "completed_on": "2026-07-05",
            },
        )
        assert response.status_code == 422


class TestPhotoCompletionContract:
    async def test_requires_completed_on(self, auth_client):
        response = await auth_client.post(
            "/photos",
            data={"challenge_activity_id": str(uuid.uuid4())},
            files={"image": ("activity.jpg", b"jpeg-data", "image/jpeg")},
        )

        assert response.status_code == 422

    async def test_passes_duration_and_date_to_service(self, auth_client, mocker):
        completion_id = uuid.uuid4()
        service = mocker.patch(
            "app.api.photos.completion_service.start_photo_completion",
            return_value=(SimpleNamespace(id=completion_id), "raw/key", "photos/key"),
        )
        mocker.patch("app.api.photos.completion_service.compress_photo")
        slot_id = uuid.uuid4()

        response = await auth_client.post(
            "/photos",
            data={
                "challenge_activity_id": str(slot_id),
                "duration_minutes": "75",
                "completed_on": "2026-07-05",
            },
            files={"image": ("activity.jpg", b"jpeg-data", "image/jpeg")},
        )

        assert response.status_code == 202
        assert response.json() == {"completion_id": str(completion_id)}
        assert service.await_args.args[-2:] == (75, date(2026, 7, 5))

    async def test_rejects_out_of_range_duration(self, auth_client):
        for duration in (0, 1441):
            response = await auth_client.post(
                "/photos",
                data={
                    "challenge_activity_id": str(uuid.uuid4()),
                    "duration_minutes": str(duration),
                    "completed_on": "2026-07-05",
                },
                files={"image": ("activity.jpg", b"jpeg-data", "image/jpeg")},
            )

            assert response.status_code == 422
