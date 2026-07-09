import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services import activity_resource as svc
from app.services.exceptions import (
    ActivityNotFound,
    InvalidResource,
    NotResourceOwner,
    ResourceLimitExceeded,
)

# ── Pure validators ──────────────────────────────────────────────


def test_validate_url_accepts_http_and_https():
    assert svc._validate_url("https://example.com/r") == "https://example.com/r"
    assert svc._validate_url("http://example.com") == "http://example.com"
    assert svc._validate_url("  https://example.com  ") == "https://example.com"


@pytest.mark.parametrize("bad", ["", "   ", "ftp://x", "example.com", "javascript:alert(1)", "mailto:a@b.c"])
def test_validate_url_rejects_non_http(bad):
    with pytest.raises(InvalidResource):
        svc._validate_url(bad)


def test_validate_url_rejects_too_long():
    with pytest.raises(InvalidResource):
        svc._validate_url("https://e.com/" + "a" * svc.MAX_URL_LEN)


def test_validate_note_rejects_empty():
    with pytest.raises(InvalidResource):
        svc._validate_note("   ")
    assert svc._validate_note("  hello ") == "hello"


def test_clean_label():
    assert svc._clean_label(None) is None
    assert svc._clean_label("   ") is None
    assert svc._clean_label(" Recipe ") == "Recipe"
    with pytest.raises(InvalidResource):
        svc._clean_label("x" * (svc.MAX_LABEL_LEN + 1))


# ── Serialization ────────────────────────────────────────────────


def test_photo_dict_only_presigns_ready(mocker):
    presign = mocker.patch.object(svc.storage, "generate_presigned_url", return_value="https://signed")
    processing = MagicMock(id=uuid.uuid4(), status="processing", position=0, photo_key="raw/x")
    ready = MagicMock(id=uuid.uuid4(), status="ready", position=1, photo_key="photos/x")

    assert svc._photo_dict(processing)["photo_url"] is None
    assert svc._photo_dict(ready)["photo_url"] == "https://signed"
    presign.assert_called_once()


def test_resource_dict_internal_includes_sorted_photos(mocker):
    mocker.patch.object(svc.storage, "generate_presigned_url", return_value="https://signed")
    p0 = MagicMock(id=uuid.uuid4(), status="ready", position=1, photo_key="k1")
    p1 = MagicMock(id=uuid.uuid4(), status="ready", position=0, photo_key="k0")
    resource = MagicMock(
        id=uuid.uuid4(), kind="internal", position=0, label=None, url=None, note_text="note", photos=[p0, p1]
    )
    data = svc._resource_dict(resource)
    assert [p["position"] for p in data["photos"]] == [0, 1]


# ── Access rules ─────────────────────────────────────────────────


def _repo_with_activity(activity):
    repo = MagicMock()
    repo.get_activity = AsyncMock(return_value=activity)
    repo.accessible_via_challenge = AsyncMock(return_value=False)
    return repo


async def test_viewable_global_activity_not_editable(mocker):
    fam = uuid.uuid4()
    activity = MagicMock(family_id=None)
    repo = _repo_with_activity(activity)
    mocker.patch.object(svc, "ActivityResourceRepository", return_value=repo)
    mocker.patch.object(svc, "get_user_family", AsyncMock(return_value=MagicMock(family_id=fam)))

    _repo, _activity, can_edit = await svc._load_viewable_activity(AsyncMock(), uuid.uuid4(), uuid.uuid4())
    assert can_edit is False


async def test_viewable_own_activity_editable(mocker):
    fam = uuid.uuid4()
    activity = MagicMock(family_id=fam)
    repo = _repo_with_activity(activity)
    mocker.patch.object(svc, "ActivityResourceRepository", return_value=repo)
    mocker.patch.object(svc, "get_user_family", AsyncMock(return_value=MagicMock(family_id=fam)))

    _repo, _activity, can_edit = await svc._load_viewable_activity(AsyncMock(), uuid.uuid4(), uuid.uuid4())
    assert can_edit is True


async def test_viewable_via_challenge_not_editable(mocker):
    fam = uuid.uuid4()
    activity = MagicMock(family_id=uuid.uuid4())  # another family
    repo = _repo_with_activity(activity)
    repo.accessible_via_challenge = AsyncMock(return_value=True)
    mocker.patch.object(svc, "ActivityResourceRepository", return_value=repo)
    mocker.patch.object(svc, "get_user_family", AsyncMock(return_value=MagicMock(family_id=fam)))

    _repo, _activity, can_edit = await svc._load_viewable_activity(AsyncMock(), uuid.uuid4(), uuid.uuid4())
    assert can_edit is False


async def test_inaccessible_activity_raises_not_found(mocker):
    fam = uuid.uuid4()
    activity = MagicMock(family_id=uuid.uuid4())
    repo = _repo_with_activity(activity)  # accessible_via_challenge False
    mocker.patch.object(svc, "ActivityResourceRepository", return_value=repo)
    mocker.patch.object(svc, "get_user_family", AsyncMock(return_value=MagicMock(family_id=fam)))

    with pytest.raises(ActivityNotFound):
        await svc._load_viewable_activity(AsyncMock(), uuid.uuid4(), uuid.uuid4())


# ── Ownership + limits on create ─────────────────────────────────


async def test_create_external_non_owner_raises(mocker):
    fam = uuid.uuid4()
    activity = MagicMock(family_id=uuid.uuid4())  # different family owns it
    repo = _repo_with_activity(activity)
    mocker.patch.object(svc, "ActivityResourceRepository", return_value=repo)
    mocker.patch.object(svc, "get_user_family", AsyncMock(return_value=MagicMock(family_id=fam)))

    with pytest.raises(NotResourceOwner):
        await svc.create_external_resource(AsyncMock(), uuid.uuid4(), uuid.uuid4(), url="https://x.com", label=None)


async def test_create_external_limit_raises(mocker):
    fam = uuid.uuid4()
    activity = MagicMock(family_id=fam)
    repo = _repo_with_activity(activity)
    repo.count_resources = AsyncMock(return_value=svc.MAX_RESOURCES_PER_ACTIVITY)
    mocker.patch.object(svc, "ActivityResourceRepository", return_value=repo)
    mocker.patch.object(svc, "get_user_family", AsyncMock(return_value=MagicMock(family_id=fam)))

    with pytest.raises(ResourceLimitExceeded):
        await svc.create_external_resource(AsyncMock(), uuid.uuid4(), uuid.uuid4(), url="https://x.com", label=None)


async def test_delete_resource_cleans_storage(mocker):
    fam = uuid.uuid4()
    aid = uuid.uuid4()
    activity = MagicMock(family_id=fam)
    photos = [MagicMock(photo_key="photos/a"), MagicMock(photo_key="photos/b"), MagicMock(photo_key=None)]
    resource = MagicMock(id=uuid.uuid4(), activity_id=aid, photos=photos)
    repo = _repo_with_activity(activity)
    repo.get_resource = AsyncMock(return_value=resource)
    repo.delete_resource = AsyncMock()
    mocker.patch.object(svc, "ActivityResourceRepository", return_value=repo)
    mocker.patch.object(svc, "get_user_family", AsyncMock(return_value=MagicMock(family_id=fam)))
    delete_obj = mocker.patch.object(svc.storage, "delete_object")

    await svc.delete_resource(AsyncMock(), uuid.uuid4(), aid, resource.id)

    repo.delete_resource.assert_awaited_once()
    assert {c.args[0] for c in delete_obj.call_args_list} == {"photos/a", "photos/b"}


# ── Edit & photo removal (US3) ───────────────────────────────────


def _owned_setup(mocker, *, kind="external"):
    fam = uuid.uuid4()
    aid = uuid.uuid4()
    activity = MagicMock(family_id=fam)
    resource = MagicMock(id=uuid.uuid4(), activity_id=aid, kind=kind, label=None, photos=[])
    repo = _repo_with_activity(activity)
    repo.get_resource = AsyncMock(return_value=resource)
    repo.save = AsyncMock(return_value=resource)
    mocker.patch.object(svc, "ActivityResourceRepository", return_value=repo)
    mocker.patch.object(svc, "get_user_family", AsyncMock(return_value=MagicMock(family_id=fam)))
    return repo, aid, resource


async def test_update_url_on_internal_resource_rejected(mocker):
    _repo, aid, resource = _owned_setup(mocker, kind="internal")
    with pytest.raises(InvalidResource):
        await svc.update_resource(AsyncMock(), uuid.uuid4(), aid, resource.id, url="https://x.com")


async def test_update_note_on_external_resource_rejected(mocker):
    _repo, aid, resource = _owned_setup(mocker, kind="external")
    with pytest.raises(InvalidResource):
        await svc.update_resource(AsyncMock(), uuid.uuid4(), aid, resource.id, note_text="hi")


async def test_update_valid_url_saved(mocker):
    repo, aid, resource = _owned_setup(mocker, kind="external")
    resource.kind = "external"
    await svc.update_resource(AsyncMock(), uuid.uuid4(), aid, resource.id, url="https://new.example.com")
    assert resource.url == "https://new.example.com"
    repo.save.assert_awaited_once()


async def test_delete_photo_cleans_storage(mocker):
    repo, aid, resource = _owned_setup(mocker, kind="internal")
    photo = MagicMock(id=uuid.uuid4(), resource_id=resource.id, photo_key="photos/x")
    repo.get_photo = AsyncMock(return_value=photo)
    repo.delete_photo = AsyncMock()
    delete_obj = mocker.patch.object(svc.storage, "delete_object")

    await svc.delete_photo(AsyncMock(), uuid.uuid4(), aid, resource.id, photo.id)

    repo.delete_photo.assert_awaited_once_with(photo)
    delete_obj.assert_called_once_with("photos/x")


async def test_delete_photo_wrong_resource_raises(mocker):
    from app.services.exceptions import ResourceNotFound

    repo, aid, resource = _owned_setup(mocker, kind="internal")
    photo = MagicMock(id=uuid.uuid4(), resource_id=uuid.uuid4())  # belongs elsewhere
    repo.get_photo = AsyncMock(return_value=photo)

    with pytest.raises(ResourceNotFound):
        await svc.delete_photo(AsyncMock(), uuid.uuid4(), aid, resource.id, photo.id)
