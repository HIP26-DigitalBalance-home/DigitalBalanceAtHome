import io
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.models.challenge import ChallengeActivity
from app.models.completion import Completion
from app.repositories.challenge import _accessible_predicate
from app.repositories.completion import CompletionRepository
from app.services.exceptions import (
    AlreadyCompleted,
    ChallengeNotFound,
    GroupNotFound,
    NoFamilyError,
    NotGroupMember,
)
from app.services.family import get_user_family


def _completion_dict(c: Completion) -> dict:
    photo_url = None
    if c.status == "ready" and c.photo_key:
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
    for completion, activity_title, family_name in rows:
        photo_url = None
        if completion.status == "ready" and completion.photo_key:
            try:
                photo_url = storage.generate_presigned_url(completion.photo_key, expires=900)
            except Exception:
                pass
        entries.append(
            {
                "id": completion.id,
                "family_id": completion.family_id,
                "family_name": family_name,
                "activity_title": activity_title,
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
        from app.services.exceptions import ChallengeNotFound

        raise ChallengeNotFound("Completion not found")

    return _completion_dict(completion)


async def get_photo_url(session: AsyncSession, user_id: uuid.UUID, completion_id: uuid.UUID) -> dict:
    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must be in a family")

    repo = CompletionRepository(session)
    completion = await repo.get_by_id(completion_id)
    if not completion or completion.family_id != fm.family_id:
        from app.services.exceptions import ChallengeNotFound

        raise ChallengeNotFound("Completion not found")

    if completion.status != "ready" or not completion.photo_key:
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

    if completion.status != "ready" or not completion.photo_key:
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

    photo_key = completion.photo_key if completion.status in ("ready", "processing") else None

    await session.delete(completion)
    await session.commit()

    if photo_key:
        try:
            storage.delete_object(photo_key)
        except Exception:
            pass


async def start_photo_completion(
    session: AsyncSession,
    user_id: uuid.UUID,
    challenge_activity_id: uuid.UUID,
    photo_data: bytes,
    content_type: str,
    caption: str | None,
    shared_to_feed: bool,
) -> tuple[Completion, str, str]:
    """Upload raw photo to S3, create processing completion. Returns (completion, raw_key, final_key)."""
    fm = await get_user_family(session, user_id)
    if not fm:
        raise NoFamilyError("You must be in a family to complete activities")

    await _resolve_slot(session, challenge_activity_id, fm.family_id)

    photo_id = uuid.uuid4()
    raw_key = f"raw/{fm.family_id}/{photo_id}.jpg"
    final_key = f"photos/{fm.family_id}/{photo_id}.jpg"

    storage.upload_bytes(raw_key, photo_data, content_type)

    repo = CompletionRepository(session)
    try:
        completion = await repo.create(
            challenge_activity_id=challenge_activity_id,
            family_id=fm.family_id,
            completed_by_user_id=user_id,
            status="processing",
            caption=caption,
            shared_to_feed=shared_to_feed,
            photo_key=raw_key,
        )
        await session.commit()
        await session.refresh(completion)
    except IntegrityError:
        await session.rollback()
        storage.delete_object(raw_key)
        raise AlreadyCompleted("This activity has already been completed by your family")

    return completion, raw_key, final_key


def compress_photo(completion_id: uuid.UUID, raw_key: str, final_key: str, db_url: str) -> None:
    """Background task (sync thread): compress photo and update completion status.
    Uses asyncio.run() so we can reuse the async engine + asyncpg driver."""
    import asyncio

    asyncio.run(_compress_async(completion_id, raw_key, final_key, db_url))


async def _compress_async(completion_id: uuid.UUID, raw_key: str, final_key: str, db_url: str) -> None:
    try:
        from PIL import Image
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        raw_data = storage.download_bytes(raw_key)
        img = Image.open(io.BytesIO(raw_data))
        img.thumbnail((1200, 1200), Image.LANCZOS)

        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=85)
        compressed = buf.getvalue()

        storage.upload_bytes(final_key, compressed, "image/jpeg")
        storage.delete_object(raw_key)

        engine = create_async_engine(db_url)
        async_session = async_sessionmaker(engine, expire_on_commit=False)
        async with async_session() as session:
            from sqlalchemy import select as sa_select

            result = await session.execute(sa_select(Completion).where(Completion.id == completion_id))
            completion = result.scalar_one_or_none()
            if completion:
                completion.status = "ready"
                completion.photo_key = final_key
                await session.commit()
        await engine.dispose()

    except Exception:
        # On failure: leave completion in "processing" state; client polls and times out
        pass
