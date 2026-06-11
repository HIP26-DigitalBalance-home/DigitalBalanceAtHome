import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import storage
from app.models.user import User
from app.repositories.user import UserRepository


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
