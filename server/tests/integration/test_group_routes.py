import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.exceptions import (
    AlreadyGroupMember,
    GroupInviteAlreadyUsed,
    GroupInviteExpired,
    GroupInviteNotFound,
    LastGroupAdminError,
    NoFamilyError,
    NotGroupAdmin,
    NotGroupMember,
)


def _fake_group() -> MagicMock:
    g = MagicMock()
    g.id = uuid.uuid4()
    g.name = "Test Group"
    g.description = None
    g.created_by_user_id = uuid.uuid4()
    g.created_at = datetime.now(timezone.utc)
    g.updated_at = datetime.now(timezone.utc)
    return g


def _fake_membership(group_id: uuid.UUID | None = None) -> MagicMock:
    m = MagicMock()
    m.id = uuid.uuid4()
    m.group_id = group_id or uuid.uuid4()
    m.family_id = uuid.uuid4()
    m.joined_at = datetime.now(timezone.utc)
    return m


def _fake_admin(group_id: uuid.UUID | None = None) -> MagicMock:
    a = MagicMock()
    a.id = uuid.uuid4()
    a.group_id = group_id or uuid.uuid4()
    a.user_id = uuid.uuid4()
    a.granted_at = datetime.now(timezone.utc)
    return a


def _mock_repo(mocker, memberships=None, admins=None) -> MagicMock:
    repo = MagicMock()
    repo.get_memberships_for_group = AsyncMock(return_value=memberships or [])
    repo.get_admins_for_group = AsyncMock(return_value=admins or [])
    repo.get_admin = AsyncMock(return_value=None)
    # bulk-fetch helpers used by _build_group_response
    repo.get_families_by_ids = AsyncMock(return_value=[])
    repo.get_family_memberships_for_families = AsyncMock(return_value=[])
    repo.get_users_by_ids = AsyncMock(return_value=[])
    mocker.patch("app.api.groups.GroupRepository", return_value=repo)
    return repo


class TestCreateGroup:
    async def test_success(self, auth_client, mocker):
        group = _fake_group()
        membership = _fake_membership(group.id)
        admin = _fake_admin(group.id)
        mocker.patch(
            "app.api.groups.group_service.create_group",
            return_value=(group, membership, admin),
        )
        repo = _mock_repo(mocker, [membership], [admin])
        repo.get_admin = AsyncMock(return_value=admin)

        response = await auth_client.post("/groups", json={"name": "Study Group"})

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Test Group"
        assert data["is_admin"] is True

    async def test_no_family_returns_400(self, auth_client, mocker):
        mocker.patch(
            "app.api.groups.group_service.create_group",
            side_effect=NoFamilyError("No family"),
        )
        response = await auth_client.post("/groups", json={"name": "Study Group"})
        assert response.status_code == 400
        assert response.json()["code"] == "no_family"

    async def test_requires_authentication(self, client):
        response = await client.post("/groups", json={"name": "test"})
        assert response.status_code in (401, 403)


class TestGetMyGroups:
    async def test_returns_list_with_is_admin(self, auth_client, mocker):
        group = _fake_group()
        membership = _fake_membership(group.id)
        mocker.patch(
            "app.api.groups.group_service.get_groups_for_user",
            return_value=[(group, membership, True)],
        )
        response = await auth_client.get("/groups/me")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["is_admin"] is True

    async def test_returns_empty_list_when_no_groups(self, auth_client, mocker):
        mocker.patch("app.api.groups.group_service.get_groups_for_user", return_value=[])
        response = await auth_client.get("/groups/me")
        assert response.status_code == 200
        assert response.json() == []


class TestJoinGroup:
    async def test_success(self, auth_client, mocker):
        group = _fake_group()
        membership = _fake_membership(group.id)
        mocker.patch(
            "app.api.groups.group_service.join_group",
            return_value=(group, membership),
        )
        _mock_repo(mocker, [membership], [])

        response = await auth_client.post("/groups/join", json={"token": str(uuid.uuid4())})
        assert response.status_code == 200

    async def test_expired_token_returns_400(self, auth_client, mocker):
        mocker.patch(
            "app.api.groups.group_service.join_group",
            side_effect=GroupInviteExpired("expired"),
        )
        response = await auth_client.post("/groups/join", json={"token": str(uuid.uuid4())})
        assert response.status_code == 400
        assert response.json()["code"] == "group_invite_expired"

    async def test_already_member_returns_409(self, auth_client, mocker):
        mocker.patch(
            "app.api.groups.group_service.join_group",
            side_effect=AlreadyGroupMember("already member"),
        )
        response = await auth_client.post("/groups/join", json={"token": str(uuid.uuid4())})
        assert response.status_code == 409

    async def test_no_family_returns_400(self, auth_client, mocker):
        mocker.patch(
            "app.api.groups.group_service.join_group",
            side_effect=NoFamilyError("no family"),
        )
        response = await auth_client.post("/groups/join", json={"token": str(uuid.uuid4())})
        assert response.status_code == 400
        assert response.json()["code"] == "no_family"

    async def test_invite_not_found_returns_404(self, auth_client, mocker):
        mocker.patch(
            "app.api.groups.group_service.join_group",
            side_effect=GroupInviteNotFound("not found"),
        )
        response = await auth_client.post("/groups/join", json={"token": str(uuid.uuid4())})
        assert response.status_code == 404


class TestCreateGroupInvite:
    async def test_success_returns_invite_url(self, auth_client, mocker):
        invite = MagicMock()
        invite.token = uuid.uuid4()
        invite.expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        mocker.patch(
            "app.api.groups.group_service.create_group_invite",
            return_value=invite,
        )
        response = await auth_client.post(f"/groups/{uuid.uuid4()}/invites")
        assert response.status_code == 201
        data = response.json()
        assert "invite_url" in data
        assert str(invite.token) in data["invite_url"]

    async def test_not_admin_returns_403(self, auth_client, mocker):
        mocker.patch(
            "app.api.groups.group_service.create_group_invite",
            side_effect=NotGroupAdmin("not admin"),
        )
        response = await auth_client.post(f"/groups/{uuid.uuid4()}/invites")
        assert response.status_code == 403


class TestRemoveGroupMember:
    async def test_success(self, auth_client, mocker):
        mocker.patch("app.api.groups.group_service.remove_member", return_value=None)
        response = await auth_client.delete(f"/groups/{uuid.uuid4()}/members/{uuid.uuid4()}")
        assert response.status_code == 204

    async def test_last_admin_returns_400(self, auth_client, mocker):
        mocker.patch(
            "app.api.groups.group_service.remove_member",
            side_effect=LastGroupAdminError("last admin"),
        )
        response = await auth_client.delete(f"/groups/{uuid.uuid4()}/members/{uuid.uuid4()}")
        assert response.status_code == 400
        assert response.json()["code"] == "last_group_admin"

    async def test_not_admin_returns_403(self, auth_client, mocker):
        mocker.patch(
            "app.api.groups.group_service.remove_member",
            side_effect=NotGroupAdmin("not admin"),
        )
        response = await auth_client.delete(f"/groups/{uuid.uuid4()}/members/{uuid.uuid4()}")
        assert response.status_code == 403


class TestGrantAdmin:
    async def test_success(self, auth_client, mocker):
        admin = _fake_admin()
        mocker.patch("app.api.groups.group_service.grant_admin", return_value=admin)
        response = await auth_client.post(
            f"/groups/{uuid.uuid4()}/admins",
            json={"user_id": str(uuid.uuid4())},
        )
        assert response.status_code == 201

    async def test_not_admin_returns_403(self, auth_client, mocker):
        mocker.patch(
            "app.api.groups.group_service.grant_admin",
            side_effect=NotGroupAdmin("not admin"),
        )
        response = await auth_client.post(
            f"/groups/{uuid.uuid4()}/admins",
            json={"user_id": str(uuid.uuid4())},
        )
        assert response.status_code == 403


class TestRevokeAdmin:
    async def test_success(self, auth_client, mocker):
        mocker.patch("app.api.groups.group_service.revoke_admin", return_value=None)
        response = await auth_client.delete(f"/groups/{uuid.uuid4()}/admins/{uuid.uuid4()}")
        assert response.status_code == 204

    async def test_last_admin_returns_400(self, auth_client, mocker):
        mocker.patch(
            "app.api.groups.group_service.revoke_admin",
            side_effect=LastGroupAdminError("last admin"),
        )
        response = await auth_client.delete(f"/groups/{uuid.uuid4()}/admins/{uuid.uuid4()}")
        assert response.status_code == 400
        assert response.json()["code"] == "last_group_admin"
