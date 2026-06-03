import uuid
from datetime import date, datetime, timezone
from unittest.mock import MagicMock

from app.services.exceptions import ChildNotFound, NoFamilyError, NotFamilyMember


def _fake_child(family_id: uuid.UUID | None = None) -> MagicMock:
    c = MagicMock()
    c.id = uuid.uuid4()
    c.family_id = family_id or uuid.uuid4()
    c.nickname = "Lena"
    c.date_of_birth = date(2019, 3, 15)
    c.interests = ["drawing", "music"]
    c.created_at = datetime.now(timezone.utc)
    c.updated_at = datetime.now(timezone.utc)
    return c


class TestCreateChild:
    async def test_success(self, auth_client, mocker):
        child = _fake_child()
        mocker.patch("app.api.children.child_service.create_child", return_value=child)

        response = await auth_client.post(
            "/children",
            json={
                "nickname": "Lena",
                "date_of_birth": "2019-03-15",
                "interests": ["drawing"],
            },
        )

        assert response.status_code == 201
        data = response.json()
        assert data["nickname"] == "Lena"
        assert data["date_of_birth"] == "2019-03-15"

    async def test_no_family_returns_400(self, auth_client, mocker):
        mocker.patch(
            "app.api.children.child_service.create_child",
            side_effect=NoFamilyError("No family"),
        )
        response = await auth_client.post(
            "/children",
            json={
                "nickname": "Lena",
                "date_of_birth": "2019-03-15",
            },
        )
        assert response.status_code == 400
        assert response.json()["code"] == "no_family"

    async def test_missing_required_fields_returns_422(self, auth_client):
        response = await auth_client.post("/children", json={"interests": []})
        assert response.status_code == 422

    async def test_requires_authentication(self, client):
        response = await client.post(
            "/children",
            json={
                "nickname": "Lena",
                "date_of_birth": "2019-03-15",
            },
        )
        assert response.status_code in (401, 403)


class TestGetChildren:
    async def test_returns_list(self, auth_client, mocker):
        children = [_fake_child(), _fake_child()]
        mocker.patch("app.api.children.child_service.get_children", return_value=children)

        response = await auth_client.get("/children")

        assert response.status_code == 200
        assert len(response.json()) == 2

    async def test_returns_empty_list_when_no_family(self, auth_client, mocker):
        mocker.patch("app.api.children.child_service.get_children", return_value=[])
        response = await auth_client.get("/children")
        assert response.status_code == 200
        assert response.json() == []


class TestUpdateChild:
    async def test_success(self, auth_client, mocker):
        child = _fake_child()
        child.nickname = "Elena"
        mocker.patch("app.api.children.child_service.update_child", return_value=child)

        response = await auth_client.patch(f"/children/{child.id}", json={"nickname": "Elena"})

        assert response.status_code == 200
        assert response.json()["nickname"] == "Elena"

    async def test_not_found_returns_404(self, auth_client, mocker):
        mocker.patch(
            "app.api.children.child_service.update_child",
            side_effect=ChildNotFound("Not found"),
        )
        response = await auth_client.patch(f"/children/{uuid.uuid4()}", json={"nickname": "X"})
        assert response.status_code == 404

    async def test_wrong_family_returns_403(self, auth_client, mocker):
        mocker.patch(
            "app.api.children.child_service.update_child",
            side_effect=NotFamilyMember("Wrong family"),
        )
        response = await auth_client.patch(f"/children/{uuid.uuid4()}", json={"nickname": "X"})
        assert response.status_code in (401, 403)


class TestDeleteChild:
    async def test_success(self, auth_client, mocker):
        mocker.patch("app.api.children.child_service.delete_child", return_value=None)
        response = await auth_client.delete(f"/children/{uuid.uuid4()}")
        assert response.status_code == 204

    async def test_not_found_returns_404(self, auth_client, mocker):
        mocker.patch(
            "app.api.children.child_service.delete_child",
            side_effect=ChildNotFound("Not found"),
        )
        response = await auth_client.delete(f"/children/{uuid.uuid4()}")
        assert response.status_code == 404
