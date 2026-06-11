import uuid
from datetime import timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.models.user import User
from app.repositories.user import UserRepository
from app.services.exceptions import NoDeletionPending


def _user_dict(user: User) -> dict:
    photo_url = None
    if user.profile_photo_key:
        try:
            photo_url = storage.generate_presigned_url(user.profile_photo_key, expires=900)
        except Exception:
            pass
    return {
        "id": user.id,
        "email": user.email,
        "display_name": user.display_name,
        "profile_photo_url": photo_url,
        "points_balance": user.points_balance,
        "deletion_pending_at": user.deletion_pending_at,
        "created_at": user.created_at,
    }


def get_me(user: User) -> dict:
    return _user_dict(user)


async def update_me(
    session: AsyncSession,
    user: User,
    display_name: str | None,
    image_data: bytes | None,
    content_type: str | None,
) -> dict:
    kwargs: dict = {}

    if display_name is not None:
        kwargs["display_name"] = display_name

    if image_data is not None:
        ext = "jpg" if (content_type or "").endswith("jpeg") or (content_type or "").endswith("jpg") else "png"
        new_key = f"avatars/{user.id}/{uuid.uuid4()}.{ext}"
        storage.upload_bytes(new_key, image_data, content_type or "image/jpeg")
        if user.profile_photo_key:
            try:
                storage.delete_object(user.profile_photo_key)
            except Exception:
                pass
        kwargs["profile_photo_key"] = new_key

    if kwargs:
        repo = UserRepository(session)
        user = await repo.update(user, **kwargs)

    return _user_dict(user)


async def delete_me(session: AsyncSession, user: User) -> dict:
    repo = UserRepository(session)
    user = await repo.set_deletion_pending(user)
    assert user.deletion_pending_at is not None
    deletion_date = user.deletion_pending_at + timedelta(days=30)
    return {
        "message": "Your account is scheduled for deletion in 30 days. You can cancel this at any time before then.",
        "deletion_date": deletion_date,
    }


async def cancel_deletion(session: AsyncSession, user: User) -> dict:
    if user.deletion_pending_at is None:
        raise NoDeletionPending()
    repo = UserRepository(session)
    user = await repo.cancel_deletion(user)
    return _user_dict(user)


async def export_data(session: AsyncSession, user: User) -> dict:
    repo = UserRepository(session)
    data = await repo.get_all_data_for_export(user.id)

    children = [
        {
            "id": c.id,
            "family_id": c.family_id,
            "nickname": c.nickname,
            "date_of_birth": c.date_of_birth,
            "interests": c.interests,
            "created_at": c.created_at,
            "updated_at": c.updated_at,
        }
        for c in data["children"]
    ]

    consents = [
        {
            "id": c.id,
            "user_id": c.user_id,
            "policy_version": c.policy_version,
            "consented_at": c.consented_at,
            "data_storage_consent": c.data_storage_consent,
            "photo_processing_consent": c.photo_processing_consent,
            "location_consent": c.location_consent,
        }
        for c in data["consents"]
    ]

    group_memberships = [
        {
            "group_id": gm.group_id,
            "group_name": g.name,
            "joined_at": gm.joined_at,
        }
        for gm, g in data["group_rows"]
    ]

    completions = []
    for completion, activity_title, challenge_title in data["comp_rows"]:
        photo_url = None
        if completion.photo_key:
            try:
                photo_url = storage.generate_presigned_url(completion.photo_key, expires=900)
            except Exception:
                pass
        completions.append(
            {
                "id": completion.id,
                "activity_title": activity_title,
                "challenge_title": challenge_title,
                "status": completion.status,
                "photo_url": photo_url,
                "caption": completion.caption,
                "completed_at": completion.completed_at,
            }
        )

    return {
        "user": _user_dict(user),
        "children": children,
        "consents": consents,
        "group_memberships": group_memberships,
        "completions": completions,
    }
