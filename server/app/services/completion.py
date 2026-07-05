import io
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.core.config import settings
from app.models.challenge import ChallengeActivity
from app.models.completion import Completion
from app.repositories.challenge import _accessible_predicate
from app.repositories.completion import CompletionRepository
from app.repositories.rewards import RewardsRepository
from app.services.exceptions import (
    AlreadyCompleted,
    CannotReuploadSelfReported,
    ChallengeNotFound,
    DurationRequired,
    GroupNotFound,
    NoFamilyError,
    NotGroupMember,
    PhotoLimitReached,
    PhotoStillProcessing,
)
from app.services.family import get_user_family
from app.services.localization import pick

# Statuses whose photo_key points at a servable photo (raw or compressed)
_PHOTO_STATUSES = ("pending_verification", "verified", "rejected")


def _completion_dict(c: Completion, rejection_reason: str | None = None) -> dict:
    photo_url = None
    if c.status in _PHOTO_STATUSES and c.photo_key:
        try:
            photo_url = storage.generate_presigned_url(c.photo_key, expires=900)
        except Exception:
            pass
    return {
        "id": c.id,
        "challenge_activity_id": c.challenge_activity_id,
        "family_id": c.family_id,
        "completed_by_user_id": c.completed_by_user_id,
        "status": c.status,
        "photo_url": photo_url,
        "caption": c.caption,
        "rejection_reason": rejection_reason if c.status == "rejected" else None,
        "duration_minutes": c.duration_minutes,
        "shared_to_feed": c.shared_to_feed,
        "completed_at": c.completed_at,
        "updated_at": c.updated_at,
    }


async def _resolve_slot(
    session: AsyncSession, challenge_activity_id: uuid.UUID, family_id: uuid.UUID
) -> ChallengeActivity:
    """Return the ChallengeActivity if it belongs to a challenge accessible to the family."""
    from app.models.challenge import Challenge

    result = await session.execute(
        select(ChallengeActivity)
        .join(Challenge, ChallengeActivity.challenge_id == Challenge.id)
        .where(
            ChallengeActivity.id == challenge_activity_id,
            _accessible_predicate(family_id),
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise ChallengeNotFound("Activity slot not found or not accessible")
    return slot


async def create_self_reported(
    session: AsyncSession,
    user_id: uuid.UUID,
    challenge_activity_id: uuid.UUID,
    caption: str | None,
    shared_to_feed: bool,
) -> dict:
    from app.services.progress import update_streak_on_completion

    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must be in a family to complete activities")

    await _resolve_slot(session, challenge_activity_id, fm.family_id)

    repo = CompletionRepository(session)
    try:
        completion = await repo.create(
            challenge_activity_id=challenge_activity_id,
            family_id=fm.family_id,
            completed_by_user_id=user_id,
            status="self_reported",
            caption=caption,
            shared_to_feed=shared_to_feed,
        )
        await update_streak_on_completion(fm.family_id, session)
        await session.commit()
        await session.refresh(completion)
    except IntegrityError:
        await session.rollback()
        raise AlreadyCompleted("This activity has already been completed by your family")

    return _completion_dict(completion)


async def get_group_feed(
    session: AsyncSession,
    user_id: uuid.UUID,
    group_id: uuid.UUID,
    limit: int = 20,
    offset: int = 0,
    language: str = "de",
) -> list[dict]:
    from app.repositories.group import GroupRepository

    fm = await get_user_family(session, user_id)
    if not fm:
        raise NotGroupMember("You are not a member of any family")

    group_repo = GroupRepository(session)
    group = await group_repo.get_by_id(group_id)
    if not group:
        raise GroupNotFound(f"Group {group_id} not found")

    gm = await group_repo.get_membership(group_id, fm.family_id)
    if not gm:
        raise NotGroupMember("Your family is not a member of this group")

    repo = CompletionRepository(session)
    rows = await repo.get_group_feed(group_id, limit, offset)
    entries = []
    for completion, activity_title, activity_title_en, family_name in rows:
        photo_url = None
        if completion.status in _PHOTO_STATUSES and completion.photo_key:
            try:
                photo_url = storage.generate_presigned_url(completion.photo_key, expires=900)
            except Exception:
                pass
        entries.append(
            {
                "id": completion.id,
                "family_id": completion.family_id,
                "family_name": family_name,
                "activity_title": pick(activity_title, activity_title_en, language),
                "photo_url": photo_url,
                "caption": completion.caption,
                "completed_at": completion.completed_at,
            }
        )
    return entries


async def get_completion(session: AsyncSession, user_id: uuid.UUID, completion_id: uuid.UUID) -> dict:
    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must be in a family")

    repo = CompletionRepository(session)
    completion = await repo.get_by_id(completion_id)
    if not completion or completion.family_id != fm.family_id:
        raise ChallengeNotFound("Completion not found")

    rejection_reason = None
    if completion.status == "rejected":
        reasons = await RewardsRepository(session).get_latest_rejection_reasons([completion.id])
        rejection_reason = reasons.get(completion.id)

    return _completion_dict(completion, rejection_reason)


async def get_photo_url(session: AsyncSession, user_id: uuid.UUID, completion_id: uuid.UUID) -> dict:
    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must be in a family")

    repo = CompletionRepository(session)
    completion = await repo.get_by_id(completion_id)
    if not completion or completion.family_id != fm.family_id:
        raise ChallengeNotFound("Completion not found")

    if completion.status not in _PHOTO_STATUSES or not completion.photo_key:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Photo not ready yet")

    url = storage.generate_presigned_url(completion.photo_key, expires=900)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=900)
    return {"url": url, "expires_at": expires_at}


async def get_photo_key(session: AsyncSession, user_id: uuid.UUID, completion_id: uuid.UUID) -> str:
    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must be in a family")

    repo = CompletionRepository(session)
    completion = await repo.get_by_id(completion_id)
    if not completion or completion.family_id != fm.family_id:
        raise ChallengeNotFound("Completion not found")

    if completion.status not in _PHOTO_STATUSES or not completion.photo_key:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Photo not ready yet")

    return completion.photo_key


async def delete_completion(session: AsyncSession, user_id: uuid.UUID, completion_id: uuid.UUID) -> None:
    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must be in a family")

    repo = CompletionRepository(session)
    completion = await repo.get_by_id(completion_id)
    if not completion or completion.family_id != fm.family_id:
        raise ChallengeNotFound("Completion not found")

    has_photo = completion.status in ("processing", *_PHOTO_STATUSES)
    photo_key = completion.photo_key if has_photo else None

    await session.delete(completion)
    await session.commit()

    if photo_key:
        try:
            storage.delete_object(photo_key)
        except Exception:
            pass


async def get_my_history(
    session: AsyncSession, user_id: uuid.UUID, limit: int = 20, offset: int = 0, language: str = "de"
) -> list[dict]:
    fm = await get_user_family(session, user_id)
    if not fm:
        return []

    repo = CompletionRepository(session)
    rows = await repo.get_by_family(fm.family_id, limit, offset)

    rejected_ids = [c.id for c, *_ in rows if c.status == "rejected"]
    reasons = await RewardsRepository(session).get_latest_rejection_reasons(rejected_ids)

    result = []
    for completion, activity_title, activity_title_en, challenge_title, challenge_title_en in rows:
        photo_url = None
        if completion.status in _PHOTO_STATUSES and completion.photo_key:
            try:
                photo_url = storage.generate_presigned_url(completion.photo_key, expires=900)
            except Exception:
                pass
        result.append(
            {
                "id": completion.id,
                "activity_title": pick(activity_title, activity_title_en, language),
                "challenge_title": pick(challenge_title, challenge_title_en, language),
                "status": completion.status,
                "photo_url": photo_url,
                "caption": completion.caption,
                "rejection_reason": reasons.get(completion.id) if completion.status == "rejected" else None,
                "duration_minutes": completion.duration_minutes,
                "completed_at": completion.completed_at,
            }
        )
    return result


async def start_photo_completion(
    session: AsyncSession,
    user_id: uuid.UUID,
    challenge_activity_id: uuid.UUID,
    photo_data: bytes,
    content_type: str,
    caption: str | None,
    shared_to_feed: bool,
    duration_minutes: int | None = None,
) -> tuple[Completion, str, str]:
    """Upload raw photo to S3, create processing completion. Returns (completion, raw_key, final_key)."""
    from app.services.points import get_activity_for_slot, resolve_tier

    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must be in a family to complete activities")

    repo = CompletionRepository(session)
    photo_count = await repo.count_photo_completions(fm.family_id)
    limit = settings.PHOTO_UPLOAD_LIMIT
    if photo_count >= limit:
        raise PhotoLimitReached(f"Your family has reached the photo limit of {limit}")

    await _resolve_slot(session, challenge_activity_id, fm.family_id)

    # 30-minute point gate (FR-006): casual-tier activities must report a duration
    activity = await get_activity_for_slot(session, challenge_activity_id)
    if activity and resolve_tier(activity) == "casual" and duration_minutes is None:
        raise DurationRequired("Please select how long the activity took")

    photo_id = uuid.uuid4()
    raw_key = f"raw/{fm.family_id}/{photo_id}.jpg"
    final_key = f"photos/{fm.family_id}/{photo_id}.jpg"

    storage.upload_bytes(raw_key, photo_data, content_type)

    try:
        completion = await repo.create(
            challenge_activity_id=challenge_activity_id,
            family_id=fm.family_id,
            completed_by_user_id=user_id,
            status="processing",
            caption=caption,
            shared_to_feed=shared_to_feed,
            photo_key=raw_key,
            duration_minutes=duration_minutes,
        )
        await session.commit()
        await session.refresh(completion)
    except IntegrityError:
        await session.rollback()
        storage.delete_object(raw_key)
        raise AlreadyCompleted("This activity has already been completed by your family")

    return completion, raw_key, final_key


async def update_photo(
    session: AsyncSession,
    user_id: uuid.UUID,
    completion_id: uuid.UUID,
    photo_data: bytes,
    content_type: str,
) -> tuple[Completion, str, str, bool, str | None]:
    """Replace the photo on an existing completion.

    Returns (completion, raw_key, final_key, preserve_status, old_photo_key).
    preserve_status is True for verified completions: the photo is swapped but
    status and points stay untouched (FR-004). rejected / pending completions
    re-enter the pipeline as processing → pending_verification (FR-005)."""
    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must be in a family")

    repo = CompletionRepository(session)
    completion = await repo.get_by_id(completion_id)
    if not completion or completion.family_id != fm.family_id:
        raise ChallengeNotFound("Completion not found")

    if completion.status == "self_reported":
        raise CannotReuploadSelfReported("Self-reported completions have no photo to replace")
    if completion.status == "processing":
        raise PhotoStillProcessing("The previous photo is still being processed")

    old_photo_key = completion.photo_key
    photo_id = uuid.uuid4()
    raw_key = f"raw/{fm.family_id}/{photo_id}.jpg"
    final_key = f"photos/{fm.family_id}/{photo_id}.jpg"

    storage.upload_bytes(raw_key, photo_data, content_type)

    preserve_status = completion.status == "verified"
    if not preserve_status:
        # rejected or pending_verification: back through the pipeline
        completion.status = "processing"
        completion.photo_key = raw_key
    await session.commit()
    await session.refresh(completion)

    return completion, raw_key, final_key, preserve_status, old_photo_key


def compress_photo(
    completion_id: uuid.UUID,
    raw_key: str,
    final_key: str,
    db_url: str,
    preserve_status: bool = False,
    update_streak: bool = True,
    delete_key: str | None = None,
) -> None:
    """Background task (sync thread): compress photo and update completion status.
    Uses asyncio.run() so we can reuse the async engine + asyncpg driver."""
    import asyncio

    asyncio.run(
        _compress_async(
            completion_id,
            raw_key,
            final_key,
            db_url,
            preserve_status=preserve_status,
            update_streak=update_streak,
            delete_key=delete_key,
        )
    )


async def _compress_async(
    completion_id: uuid.UUID,
    raw_key: str,
    final_key: str,
    db_url: str,
    preserve_status: bool = False,
    update_streak: bool = True,
    delete_key: str | None = None,
) -> None:
    try:
        from PIL import Image, ImageOps
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        raw_data = storage.download_bytes(raw_key)
        raw_img = Image.open(io.BytesIO(raw_data))
        # Re-saving drops EXIF metadata, so bake the orientation into the pixels first
        img = ImageOps.exif_transpose(raw_img)
        img.thumbnail((1200, 1200), Image.Resampling.LANCZOS)

        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=85)
        compressed = buf.getvalue()

        storage.upload_bytes(final_key, compressed, "image/jpeg")
        storage.delete_object(raw_key)

        engine = create_async_engine(db_url)
        async_session = async_sessionmaker(engine, expire_on_commit=False)
        async with async_session() as session:
            from sqlalchemy import select as sa_select

            from app.services.progress import update_streak_on_completion

            result = await session.execute(sa_select(Completion).where(Completion.id == completion_id))
            completion = result.scalar_one_or_none()
            if completion:
                if not preserve_status:
                    completion.status = "pending_verification"
                completion.photo_key = final_key
                if update_streak:
                    await update_streak_on_completion(completion.family_id, session)
                await session.commit()
        await engine.dispose()

        # Re-uploads leave a superseded compressed photo behind — clean it up
        if delete_key and delete_key not in (raw_key, final_key):
            try:
                storage.delete_object(delete_key)
            except Exception:
                pass

    except Exception:
        # On failure: leave completion in "processing" state; client polls and times out
        pass
