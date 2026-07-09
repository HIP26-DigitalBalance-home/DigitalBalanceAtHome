import uuid
from urllib.parse import urlparse

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.config import settings
from app.models.activity import Activity
from app.models.activity_resource import ActivityResource
from app.models.activity_resource_photo import ActivityResourcePhoto
from app.repositories.activity_resource import ActivityResourceRepository
from app.repositories.quota import lock_family_quota
from app.services.exceptions import (
    ActivityNotFound,
    InvalidResource,
    NoFamilyError,
    NotResourceOwner,
    PhotoLimitReached,
    ResourceLimitExceeded,
    ResourceNotFound,
)
from app.services.family import get_user_family

logger = structlog.get_logger()

MAX_RESOURCES_PER_ACTIVITY = 10
MAX_PHOTOS_PER_RESOURCE = 5
MAX_LABEL_LEN = 100
MAX_URL_LEN = 2048
MAX_NOTE_LEN = 2000

_ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/jpg"}


# ── Validation ───────────────────────────────────────────────────


def _validate_url(url: str | None) -> str:
    if not url or not url.strip():
        raise InvalidResource("A link address is required for an external resource")
    url = url.strip()
    if len(url) > MAX_URL_LEN:
        raise InvalidResource(f"Link address must be {MAX_URL_LEN} characters or fewer")
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise InvalidResource("Link must be a valid http(s) web address")
    return url


def _validate_note(note_text: str | None) -> str:
    if not note_text or not note_text.strip():
        raise InvalidResource("A note needs some text (or add a photo instead)")
    note_text = note_text.strip()
    if len(note_text) > MAX_NOTE_LEN:
        raise InvalidResource(f"Note must be {MAX_NOTE_LEN} characters or fewer")
    return note_text


def _clean_label(label: str | None) -> str | None:
    if label is None:
        return None
    label = label.strip()
    if not label:
        return None
    if len(label) > MAX_LABEL_LEN:
        raise InvalidResource(f"Label must be {MAX_LABEL_LEN} characters or fewer")
    return label


# ── Access helpers ───────────────────────────────────────────────


async def _load_owned_activity(
    session: AsyncSession, user_id: uuid.UUID, activity_id: uuid.UUID
) -> tuple[ActivityResourceRepository, Activity]:
    """Return (repo, activity) if the caller's family owns the activity.

    Raises ActivityNotFound (404) if the activity does not exist, or
    NotResourceOwner (403) if it exists but the caller's family does not own it.
    """
    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must be in a family to manage activity resources")
    repo = ActivityResourceRepository(session)
    activity = await repo.get_activity(activity_id)
    if not activity:
        raise ActivityNotFound("Activity not found")
    if activity.family_id != fm.family_id:
        raise NotResourceOwner("Only the family that created this activity can manage its resources")
    return repo, activity


async def _load_viewable_activity(
    session: AsyncSession, user_id: uuid.UUID, activity_id: uuid.UUID
) -> tuple[ActivityResourceRepository, Activity, bool]:
    """Return (repo, activity, can_edit) if the caller can view the activity.

    Viewable when: global/curated (family_id is None), owned by the caller's
    family, or embedded in a challenge the family can access. Raises
    ActivityNotFound (404) otherwise (does not leak existence)."""
    repo = ActivityResourceRepository(session)
    activity = await repo.get_activity(activity_id)
    if not activity:
        raise ActivityNotFound("Activity not found")

    fm = await get_user_family(session, user_id)
    family_id = fm.family_id if fm else None

    if activity.family_id is None:
        return repo, activity, False
    if family_id is not None and activity.family_id == family_id:
        return repo, activity, True
    if family_id is not None and await repo.accessible_via_challenge(activity_id, family_id):
        return repo, activity, False
    raise ActivityNotFound("Activity not found")


async def _get_owned_resource(
    repo: ActivityResourceRepository, activity_id: uuid.UUID, resource_id: uuid.UUID
) -> ActivityResource:
    resource = await repo.get_resource(resource_id)
    if not resource or resource.activity_id != activity_id:
        raise ResourceNotFound("Resource not found")
    return resource


# ── Serialization ────────────────────────────────────────────────


def _photo_dict(photo: ActivityResourcePhoto) -> dict:
    photo_url = None
    if photo.status == "ready" and photo.photo_key:
        try:
            photo_url = storage.generate_presigned_url(photo.photo_key, expires=900)
        except Exception:
            photo_url = None
    return {
        "id": photo.id,
        "status": photo.status,
        "position": photo.position,
        "photo_url": photo_url,
    }


def _resource_dict(resource: ActivityResource) -> dict:
    data: dict = {
        "id": resource.id,
        "kind": resource.kind,
        "position": resource.position,
        "label": resource.label,
        "url": resource.url,
        "note_text": resource.note_text,
    }
    if resource.kind == "internal":
        photos = sorted(resource.photos, key=lambda p: p.position)
        data["photos"] = [_photo_dict(p) for p in photos]
    return data


def _validate_image(content_type: str | None, size: int) -> None:
    # Defense in depth: routes already run read_image_upload(), which enforces
    # these limits before the body is fully buffered.
    if content_type not in _ALLOWED_IMAGE_TYPES:
        raise InvalidResource("Only JPEG and PNG images are accepted")
    if size > settings.MAX_UPLOAD_BYTES:
        raise InvalidResource("Image must be 10 MB or smaller")


async def _reload_dict(repo: ActivityResourceRepository, resource_id: uuid.UUID) -> dict:
    """Re-read a just-written resource with its photos eagerly loaded."""
    resource = await repo.get_resource(resource_id)
    assert resource is not None
    return _resource_dict(resource)


# ── Authoring (US1) ──────────────────────────────────────────────


async def create_external_resource(
    session: AsyncSession,
    user_id: uuid.UUID,
    activity_id: uuid.UUID,
    *,
    url: str | None,
    label: str | None,
) -> dict:
    repo, _ = await _load_owned_activity(session, user_id, activity_id)
    if await repo.count_resources(activity_id) >= MAX_RESOURCES_PER_ACTIVITY:
        raise ResourceLimitExceeded(f"An activity can have at most {MAX_RESOURCES_PER_ACTIVITY} resources")
    clean_url = _validate_url(url)
    clean_label = _clean_label(label)
    position = await repo.next_resource_position(activity_id)
    resource = await repo.create_resource(
        activity_id=activity_id, kind="external", position=position, label=clean_label, url=clean_url
    )
    return await _reload_dict(repo, resource.id)


async def create_internal_text_resource(
    session: AsyncSession,
    user_id: uuid.UUID,
    activity_id: uuid.UUID,
    *,
    note_text: str | None,
    label: str | None,
) -> dict:
    repo, _ = await _load_owned_activity(session, user_id, activity_id)
    if await repo.count_resources(activity_id) >= MAX_RESOURCES_PER_ACTIVITY:
        raise ResourceLimitExceeded(f"An activity can have at most {MAX_RESOURCES_PER_ACTIVITY} resources")
    clean_note = _validate_note(note_text)
    clean_label = _clean_label(label)
    position = await repo.next_resource_position(activity_id)
    resource = await repo.create_resource(
        activity_id=activity_id, kind="internal", position=position, label=clean_label, note_text=clean_note
    )
    return await _reload_dict(repo, resource.id)


def _photo_keys(family_id: uuid.UUID | None) -> tuple[uuid.UUID, str, str]:
    # Owned activities always carry a family (enforced by _load_owned_activity).
    assert family_id is not None
    photo_id = uuid.uuid4()
    raw_key = f"raw/{family_id}/resource-{photo_id}.jpg"
    final_key = f"photos/{family_id}/resource-{photo_id}.jpg"
    return photo_id, raw_key, final_key


def _family_photo_quota_message() -> str:
    return f"Your family has reached the limit of {settings.RESOURCE_PHOTO_UPLOAD_LIMIT} resource photos"


async def _create_photo_with_quota(
    repo: ActivityResourceRepository,
    family_id: uuid.UUID,
    *,
    resource_id: uuid.UUID,
    photo_key: str,
    position: int,
) -> ActivityResourcePhoto:
    """Insert a photo row with the family quota re-checked atomically.

    The advisory lock is held until create_photo() commits, so parallel
    uploads cannot both pass the count check."""
    await lock_family_quota(repo.session, family_id)
    if await repo.count_photos_for_family(family_id) >= settings.RESOURCE_PHOTO_UPLOAD_LIMIT:
        await repo.session.rollback()
        raise PhotoLimitReached(_family_photo_quota_message())
    return await repo.create_photo(resource_id=resource_id, status="processing", photo_key=photo_key, position=position)


async def create_photo_only_resource(
    session: AsyncSession,
    user_id: uuid.UUID,
    activity_id: uuid.UUID,
    *,
    photo_data: bytes,
    content_type: str,
    note_text: str | None = None,
) -> tuple[dict, str, str, uuid.UUID]:
    """Create an internal resource carrying its first photo.

    Returns (resource_dict, raw_key, final_key, photo_id) so the route can
    schedule background compression."""
    repo, activity = await _load_owned_activity(session, user_id, activity_id)
    family_id = activity.family_id
    assert family_id is not None  # owned activities always carry a family
    if await repo.count_resources(activity_id) >= MAX_RESOURCES_PER_ACTIVITY:
        raise ResourceLimitExceeded(f"An activity can have at most {MAX_RESOURCES_PER_ACTIVITY} resources")
    # Cheap unlocked pre-check; re-checked under the advisory lock at insert time
    if await repo.count_photos_for_family(family_id) >= settings.RESOURCE_PHOTO_UPLOAD_LIMIT:
        raise PhotoLimitReached(_family_photo_quota_message())
    _validate_image(content_type, len(photo_data))

    clean_note: str | None = None
    if note_text and note_text.strip():
        if len(note_text.strip()) > MAX_NOTE_LEN:
            raise InvalidResource(f"Note must be {MAX_NOTE_LEN} characters or fewer")
        clean_note = note_text.strip()

    position = await repo.next_resource_position(activity_id)
    resource = await repo.create_resource(
        activity_id=activity_id, kind="internal", position=position, note_text=clean_note
    )

    _photo_id, raw_key, final_key = _photo_keys(family_id)
    await storage.upload_bytes_async(raw_key, photo_data, content_type)
    try:
        photo = await _create_photo_with_quota(repo, family_id, resource_id=resource.id, photo_key=raw_key, position=0)
    except PhotoLimitReached:
        # Lost the race at the quota boundary: clean up the raw upload and
        # the just-created empty resource
        await storage.delete_object_async(raw_key)
        await repo.delete_resource(resource)
        raise
    return await _reload_dict(repo, resource.id), raw_key, final_key, photo.id


async def add_photo(
    session: AsyncSession,
    user_id: uuid.UUID,
    activity_id: uuid.UUID,
    resource_id: uuid.UUID,
    *,
    photo_data: bytes,
    content_type: str,
) -> tuple[dict, str, str, uuid.UUID]:
    repo, activity = await _load_owned_activity(session, user_id, activity_id)
    family_id = activity.family_id
    assert family_id is not None  # owned activities always carry a family
    resource = await _get_owned_resource(repo, activity_id, resource_id)
    if resource.kind != "internal":
        raise InvalidResource("Photos can only be added to note resources")
    if await repo.count_photos(resource_id) >= MAX_PHOTOS_PER_RESOURCE:
        raise ResourceLimitExceeded(f"A note can have at most {MAX_PHOTOS_PER_RESOURCE} photos")
    # Cheap unlocked pre-check; re-checked under the advisory lock at insert time
    if await repo.count_photos_for_family(family_id) >= settings.RESOURCE_PHOTO_UPLOAD_LIMIT:
        raise PhotoLimitReached(_family_photo_quota_message())
    _validate_image(content_type, len(photo_data))

    position = await repo.next_photo_position(resource_id)
    _photo_id, raw_key, final_key = _photo_keys(family_id)
    await storage.upload_bytes_async(raw_key, photo_data, content_type)
    try:
        photo = await _create_photo_with_quota(
            repo, family_id, resource_id=resource_id, photo_key=raw_key, position=position
        )
    except PhotoLimitReached:
        await storage.delete_object_async(raw_key)
        raise
    return _photo_dict(photo), raw_key, final_key, photo.id


async def _update_resource_photo(photo_id: uuid.UUID, *, status: str | None, photo_key: str | None) -> None:
    from sqlalchemy import select

    from app.core.database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(ActivityResourcePhoto).where(ActivityResourcePhoto.id == photo_id))
        photo = result.scalar_one_or_none()
        if photo:
            if status is not None:
                photo.status = status
            photo.photo_key = photo_key
            await session.commit()


async def compress_resource_photo(photo_id: uuid.UUID, raw_key: str, final_key: str) -> None:
    """Background task: compress the raw photo and mark it ready.

    Runs on the event loop (async BackgroundTask); the CPU-bound decode is
    offloaded to a bounded worker thread by photo_pipeline."""
    from app.services import photo_pipeline

    try:
        raw_data = await storage.download_bytes_async(raw_key)
        try:
            compressed = await photo_pipeline.compress_in_thread(raw_data)
        except photo_pipeline.ImageProcessingError:
            logger.warning("resource_photo_rejected", photo_id=str(photo_id), raw_key=raw_key)
            await storage.delete_object_async(raw_key)
            # Detach the poisoned raw photo so the recovery sweeper stops retrying it
            await _update_resource_photo(photo_id, status=None, photo_key=None)
            return

        await storage.upload_bytes_async(final_key, compressed, "image/jpeg")
        await storage.delete_object_async(raw_key)
        await _update_resource_photo(photo_id, status="ready", photo_key=final_key)
    except Exception:
        # Photo stays in "processing"; the recovery sweeper retries it later
        logger.exception("resource_photo_compression_failed", photo_id=str(photo_id))


# ── Viewing (US2) ────────────────────────────────────────────────


async def get_activity_with_resources(
    session: AsyncSession, user_id: uuid.UUID, activity_id: uuid.UUID
) -> tuple[Activity, bool, list[dict]]:
    """Return (activity, can_edit, resource_dicts) if the caller can view it.

    The route composes the base activity fields; resources are pre-serialized
    here (with pre-signed photo URLs for ready photos)."""
    repo, activity, can_edit = await _load_viewable_activity(session, user_id, activity_id)
    resources = await repo.list_for_activity(activity_id)
    return activity, can_edit, [_resource_dict(r) for r in resources]


# ── Editing & removal (US3) ──────────────────────────────────────


async def update_resource(
    session: AsyncSession,
    user_id: uuid.UUID,
    activity_id: uuid.UUID,
    resource_id: uuid.UUID,
    *,
    label: str | None = None,
    url: str | None = None,
    note_text: str | None = None,
) -> dict:
    repo, _ = await _load_owned_activity(session, user_id, activity_id)
    resource = await _get_owned_resource(repo, activity_id, resource_id)

    if url is not None:
        if resource.kind != "external":
            raise InvalidResource("Only external resources have a link address")
        resource.url = _validate_url(url)
    if note_text is not None:
        if resource.kind != "internal":
            raise InvalidResource("Only note resources have text")
        resource.note_text = _validate_note(note_text)
    if label is not None:
        resource.label = _clean_label(label)

    await repo.save(resource)
    return await _reload_dict(repo, resource.id)


async def delete_resource(
    session: AsyncSession, user_id: uuid.UUID, activity_id: uuid.UUID, resource_id: uuid.UUID
) -> None:
    repo, _ = await _load_owned_activity(session, user_id, activity_id)
    resource = await _get_owned_resource(repo, activity_id, resource_id)

    photo_keys = [p.photo_key for p in resource.photos if p.photo_key]
    await repo.delete_resource(resource)
    for key in photo_keys:
        try:
            await storage.delete_object_async(key)
        except Exception:
            pass


async def delete_photo(
    session: AsyncSession,
    user_id: uuid.UUID,
    activity_id: uuid.UUID,
    resource_id: uuid.UUID,
    photo_id: uuid.UUID,
) -> None:
    repo, _ = await _load_owned_activity(session, user_id, activity_id)
    await _get_owned_resource(repo, activity_id, resource_id)
    photo = await repo.get_photo(photo_id)
    if not photo or photo.resource_id != resource_id:
        raise ResourceNotFound("Photo not found")

    photo_key = photo.photo_key
    await repo.delete_photo(photo)
    if photo_key:
        try:
            await storage.delete_object_async(photo_key)
        except Exception:
            pass
