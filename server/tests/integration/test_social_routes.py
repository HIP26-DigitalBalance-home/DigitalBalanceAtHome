import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock


def _fake_user(name: str = "Anna Beispiel") -> MagicMock:
    u = MagicMock()
    u.id = uuid.uuid4()
    u.display_name = name
    return u


def _fake_challenge(is_private: bool = True) -> MagicMock:
    c = MagicMock()
    c.id = uuid.uuid4()
    c.title = "Sommer Challenge"
    c.title_en = None
    c.description = None
    c.description_en = None
    c.group_id = None
    c.created_by_family_id = uuid.uuid4()
    c.display_mode = "collage"
    c.is_private = is_private
    c.created_at = datetime.now(timezone.utc)
    return c


def _fake_membership(family_id: uuid.UUID | None = None) -> MagicMock:
    fm = MagicMock()
    fm.family_id = family_id or uuid.uuid4()
    return fm


def _fake_participant(challenge_id: uuid.UUID, user_id: uuid.UUID) -> MagicMock:
    p = MagicMock()
    p.challenge_id = challenge_id
    p.user_id = user_id
    p.family_id = uuid.uuid4()
    p.invited_by_user_id = uuid.uuid4()
    p.created_at = datetime.now(timezone.utc)
    return p


def _mock_challenge_repo(mocker, challenge) -> MagicMock:
    repo = MagicMock()
    repo.get_by_id = AsyncMock(return_value=challenge)
    repo.is_accessible = AsyncMock(return_value=True)
    repo.get_challenge_activities = AsyncMock(return_value=[])
    repo.get_activities_by_ids = AsyncMock(return_value=[])
    repo.get_participant_family_ids = AsyncMock(return_value=[])
    repo.get_completions_for_families = AsyncMock(return_value=[])
    repo.get_families_completed_count_per_slot = AsyncMock(return_value={})
    repo.get_shared_group_ids = AsyncMock(return_value=[])
    repo.get_participants_with_users = AsyncMock(return_value=[])
    repo.get_participant = AsyncMock(return_value=None)
    mocker.patch("app.services.challenge.ChallengeRepository", return_value=repo)
    return repo


class TestUpdateChallenge:
    async def test_set_public(self, auth_client, mocker):
        challenge = _fake_challenge(is_private=True)
        mocker.patch("app.services.challenge.get_user_family", AsyncMock(return_value=_fake_membership()))
        _mock_challenge_repo(mocker, challenge)

        res = await auth_client.patch(f"/challenges/{challenge.id}", json={"is_private": False})

        assert res.status_code == 200
        assert challenge.is_private is False

    async def test_not_accessible(self, auth_client, mocker):
        challenge = _fake_challenge()
        mocker.patch("app.services.challenge.get_user_family", AsyncMock(return_value=_fake_membership()))
        repo = _mock_challenge_repo(mocker, challenge)
        repo.is_accessible = AsyncMock(return_value=False)

        res = await auth_client.patch(f"/challenges/{challenge.id}", json={"is_private": False})

        assert res.status_code == 404


class TestInviteParticipant:
    def _setup(self, mocker, challenge, target_user, share_group=True, existing_participant=None):
        inviter_fm = _fake_membership()
        target_fm = _fake_membership()
        mocker.patch(
            "app.services.challenge.get_user_family",
            AsyncMock(side_effect=[inviter_fm, target_fm]),
        )
        repo = _mock_challenge_repo(mocker, challenge)
        repo.get_participant = AsyncMock(return_value=existing_participant)
        repo.add_participant = AsyncMock(return_value=_fake_participant(challenge.id, target_user.id))

        user_repo = MagicMock()
        user_repo.get_by_id = AsyncMock(return_value=target_user)
        mocker.patch("app.repositories.user.UserRepository", return_value=user_repo)

        group_repo = MagicMock()
        group_repo.families_share_group = AsyncMock(return_value=share_group)
        mocker.patch("app.repositories.group.GroupRepository", return_value=group_repo)

        notif_repo = MagicMock()
        notif_repo.create = AsyncMock()
        mocker.patch("app.repositories.notification.NotificationRepository", return_value=notif_repo)
        return repo, notif_repo

    async def test_success_creates_notification(self, auth_client, mocker):
        challenge = _fake_challenge()
        target = _fake_user()
        repo, notif_repo = self._setup(mocker, challenge, target)

        res = await auth_client.post(f"/challenges/{challenge.id}/participants", json={"user_id": str(target.id)})

        assert res.status_code == 201
        assert res.json()["display_name"] == "Anna Beispiel"
        repo.add_participant.assert_awaited_once()
        notif_repo.create.assert_awaited_once()
        kwargs = notif_repo.create.await_args.kwargs
        assert kwargs["user_id"] == target.id
        assert kwargs["type"] == "challenge_invite"
        assert kwargs["challenge_id"] == challenge.id

    async def test_not_friend(self, auth_client, mocker):
        challenge = _fake_challenge()
        target = _fake_user()
        self._setup(mocker, challenge, target, share_group=False)

        res = await auth_client.post(f"/challenges/{challenge.id}/participants", json={"user_id": str(target.id)})

        assert res.status_code == 403
        assert res.json()["code"] == "not_friend"

    async def test_already_invited(self, auth_client, mocker):
        challenge = _fake_challenge()
        target = _fake_user()
        self._setup(mocker, challenge, target, existing_participant=_fake_participant(challenge.id, target.id))

        res = await auth_client.post(f"/challenges/{challenge.id}/participants", json={"user_id": str(target.id)})

        assert res.status_code == 409
        assert res.json()["code"] == "already_participant"

    async def test_unknown_user(self, auth_client, mocker):
        challenge = _fake_challenge()
        mocker.patch("app.services.challenge.get_user_family", AsyncMock(return_value=_fake_membership()))
        _mock_challenge_repo(mocker, challenge)
        user_repo = MagicMock()
        user_repo.get_by_id = AsyncMock(return_value=None)
        mocker.patch("app.repositories.user.UserRepository", return_value=user_repo)

        res = await auth_client.post(f"/challenges/{challenge.id}/participants", json={"user_id": str(uuid.uuid4())})

        assert res.status_code == 404
        assert res.json()["code"] == "user_not_found"


class TestListParticipants:
    async def test_success(self, auth_client, mocker):
        challenge = _fake_challenge()
        mocker.patch("app.services.challenge.get_user_family", AsyncMock(return_value=_fake_membership()))
        repo = _mock_challenge_repo(mocker, challenge)
        participant = _fake_participant(challenge.id, uuid.uuid4())
        repo.get_participants_with_users = AsyncMock(return_value=[(participant, "Ben Muster")])

        res = await auth_client.get(f"/challenges/{challenge.id}/participants")

        assert res.status_code == 200
        body = res.json()
        assert len(body) == 1
        assert body[0]["display_name"] == "Ben Muster"


class TestFriends:
    async def test_aggregates_and_sorts(self, auth_client, mocker):
        fm = _fake_membership()
        mocker.patch("app.services.friend.get_user_family", AsyncMock(return_value=fm))

        zoe = _fake_user("Zoe Zuletzt")
        anna = _fake_user("anna Anfang")
        group_repo = MagicMock()
        group_repo.get_friend_rows = AsyncMock(
            return_value=[
                (zoe, uuid.uuid4(), "Kita Sonnenschein"),
                (anna, uuid.uuid4(), "Kita Sonnenschein"),
                (anna, uuid.uuid4(), "Nachbarschaft"),
            ]
        )
        mocker.patch("app.services.friend.GroupRepository", return_value=group_repo)

        res = await auth_client.get("/friends")

        assert res.status_code == 200
        body = res.json()
        assert [f["display_name"] for f in body] == ["anna Anfang", "Zoe Zuletzt"]
        assert body[0]["shared_group_names"] == ["Kita Sonnenschein", "Nachbarschaft"]

    async def test_no_family_returns_empty(self, auth_client, mocker):
        mocker.patch("app.services.friend.get_user_family", AsyncMock(return_value=None))

        res = await auth_client.get("/friends")

        assert res.status_code == 200
        assert res.json() == []


class TestNotifications:
    async def test_list(self, auth_client, mocker):
        n = MagicMock()
        n.id = uuid.uuid4()
        n.type = "challenge_invite"
        n.actor_user_id = uuid.uuid4()
        n.challenge_id = uuid.uuid4()
        n.created_at = datetime.now(timezone.utc)
        n.read_at = None

        repo = MagicMock()
        repo.get_for_user = AsyncMock(return_value=[(n, "Anna Beispiel", "Sommer Challenge", None)])
        mocker.patch("app.services.notification.NotificationRepository", return_value=repo)

        res = await auth_client.get("/notifications")

        assert res.status_code == 200
        body = res.json()
        assert len(body) == 1
        assert body[0]["actor_display_name"] == "Anna Beispiel"
        assert body[0]["challenge_title"] == "Sommer Challenge"
        assert body[0]["read"] is False

    async def test_mark_read(self, auth_client, mocker):
        repo = MagicMock()
        repo.mark_all_read = AsyncMock()
        mocker.patch("app.services.notification.NotificationRepository", return_value=repo)

        res = await auth_client.post("/notifications/read")

        assert res.status_code == 204
        repo.mark_all_read.assert_awaited_once()
