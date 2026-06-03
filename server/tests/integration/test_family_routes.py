import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

from app.services.exceptions import (
    AlreadyFamilyMember,
    InviteExpired,
    InviteNotFound,
    NotFamilyMember,
)


def _fake_family_dict(family) -> dict:
    """Minimal dict that satisfies the Family response schema."""
    return {
        "id": str(family.id),
        "name": family.name,
        "members": [],
        "created_at": family.created_at.isoformat(),
    }


def _fake_family() -> MagicMock:
    f = MagicMock()
    f.id = uuid.uuid4()
    f.name = "Test Family"
    f.created_at = datetime.now(timezone.utc)
    f.updated_at = datetime.now(timezone.utc)
    return f


def _fake_membership(family_id: uuid.UUID | None = None, role: str = "admin") -> MagicMock:
    m = MagicMock()
    m.id = uuid.uuid4()
    m.family_id = family_id or uuid.uuid4()
    m.user_id = uuid.uuid4()
    m.role = MagicMock()
    m.role.value = role
    m.joined_at = datetime.now(timezone.utc)
    return m


def _fake_invite(family_id: uuid.UUID | None = None) -> MagicMock:
    inv = MagicMock()
    inv.id = uuid.uuid4()
    inv.family_id = family_id or uuid.uuid4()
    inv.token = uuid.uuid4()
    inv.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    return inv


def _mock_repo(mocker, members: list | None = None) -> MagicMock:
    repo = MagicMock()
    repo.get_memberships_for_family = AsyncMock(return_value=members or [])
    mocker.patch("app.api.families.FamilyRepository", return_value=repo)
    return repo


class TestCreateFamily:
    async def test_success(self, auth_client, mocker):
        family = _fake_family()
        membership = _fake_membership(family.id)
        mocker.patch("app.api.families.family_service.create_family", return_value=(family, membership))
        _mock_repo(mocker, [membership])
        mocker.patch("app.api.families._build_family_response", new=AsyncMock(return_value=_fake_family_dict(family)))

        response = await auth_client.post("/families", json={"name": "The Garcias"})

        assert response.status_code == 201
        data = response.json()
        assert "family" in data
        assert "membership" in data

    async def test_requires_authentication(self, client):
        response = await client.post("/families", json={"name": "test"})
        assert response.status_code in (401, 403)


class TestGetMyFamilies:
    async def test_returns_list(self, auth_client, mocker):
        family = _fake_family()
        membership = _fake_membership(family.id)
        mocker.patch("app.api.families.family_service.get_families_for_user", return_value=[(family, membership)])
        _mock_repo(mocker, [membership])
        mocker.patch("app.api.families._build_family_response", new=AsyncMock(return_value=_fake_family_dict(family)))

        response = await auth_client.get("/families/me")
        assert response.status_code == 200
        assert isinstance(response.json(), list)


class TestJoinFamily:
    async def test_success(self, auth_client, mocker):
        family = _fake_family()
        membership = _fake_membership(family.id, "member")
        mocker.patch("app.api.families.family_service.join_family", return_value=(family, membership))
        _mock_repo(mocker, [membership])
        mocker.patch("app.api.families._build_family_response", new=AsyncMock(return_value=_fake_family_dict(family)))

        response = await auth_client.post("/families/join", json={"token": str(uuid.uuid4())})
        assert response.status_code == 200

    async def test_expired_invite_returns_400(self, auth_client, mocker):
        mocker.patch("app.api.families.family_service.join_family", side_effect=InviteExpired("expired"))
        response = await auth_client.post("/families/join", json={"token": str(uuid.uuid4())})
        assert response.status_code == 400
        assert response.json()["code"] == "invite_expired"

    async def test_already_member_returns_409(self, auth_client, mocker):
        mocker.patch("app.api.families.family_service.join_family", side_effect=AlreadyFamilyMember("already"))
        response = await auth_client.post("/families/join", json={"token": str(uuid.uuid4())})
        assert response.status_code == 409

    async def test_invite_not_found_returns_404(self, auth_client, mocker):
        mocker.patch("app.api.families.family_service.join_family", side_effect=InviteNotFound("not found"))
        response = await auth_client.post("/families/join", json={"token": str(uuid.uuid4())})
        assert response.status_code == 404


class TestCreateFamilyInvite:
    async def test_success(self, auth_client, mocker):
        invite = _fake_invite()
        mocker.patch("app.api.families.family_service.create_family_invite", return_value=invite)
        response = await auth_client.post(f"/families/{uuid.uuid4()}/invites")
        assert response.status_code == 201
        assert "invite_url" in response.json()

    async def test_not_member_returns_403(self, auth_client, mocker):
        mocker.patch("app.api.families.family_service.create_family_invite", side_effect=NotFamilyMember("not member"))
        response = await auth_client.post(f"/families/{uuid.uuid4()}/invites")
        assert response.status_code == 403


class TestLeaveFamily:
    async def test_success(self, auth_client, mocker):
        from app.dependencies.auth import get_current_user
        from app.main import app

        current_user = app.dependency_overrides[get_current_user]()
        mocker.patch("app.api.families.family_service.leave_family", return_value=None)
        fid = str(uuid.uuid4())
        response = await auth_client.delete(f"/families/{fid}/members/{current_user.id}")
        assert response.status_code == 204

    async def test_cannot_remove_other_user_returns_403(self, auth_client, mocker):
        # User IDs that don't match current_user.id are rejected at the route level (403)
        fid, other_uid = str(uuid.uuid4()), str(uuid.uuid4())
        response = await auth_client.delete(f"/families/{fid}/members/{other_uid}")
        assert response.status_code == 403

    async def test_not_member_returns_403(self, auth_client, mocker):
        from app.dependencies.auth import get_current_user
        from app.main import app

        current_user = app.dependency_overrides[get_current_user]()
        mocker.patch("app.api.families.family_service.leave_family", side_effect=NotFamilyMember("not member"))
        fid = str(uuid.uuid4())
        response = await auth_client.delete(f"/families/{fid}/members/{current_user.id}")
        assert response.status_code == 403
