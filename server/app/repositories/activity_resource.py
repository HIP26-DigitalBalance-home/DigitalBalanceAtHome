import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.activity import Activity
from app.models.activity_resource import ActivityResource
from app.models.activity_resource_photo import ActivityResourcePhoto
from app.models.challenge import Challenge, ChallengeActivity
from app.repositories.challenge import _accessible_predicate


class ActivityResourceRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ── Activity + access ────────────────────────────────────────

    async def get_activity(self, activity_id: uuid.UUID) -> Activity | None:
        result = await self.session.execute(select(Activity).where(Activity.id == activity_id))
        return result.scalar_one_or_none()

    async def accessible_via_challenge(self, activity_id: uuid.UUID, family_id: uuid.UUID) -> bool:
        """True if the activity is embedded in a challenge the family can access."""
        q = (
            select(ChallengeActivity.id)
            .join(Challenge, Challenge.id == ChallengeActivity.challenge_id)
            .where(ChallengeActivity.activity_id == activity_id, _accessible_predicate(family_id))
            .limit(1)
        )
        result = await self.session.execute(q)
        return result.first() is not None

    # ── Resources ────────────────────────────────────────────────

    async def list_for_activity(self, activity_id: uuid.UUID) -> list[ActivityResource]:
        q = (
            select(ActivityResource)
            .where(ActivityResource.activity_id == activity_id)
            .order_by(ActivityResource.position)
            .options(selectinload(ActivityResource.photos))
        )
        result = await self.session.execute(q)
        return list(result.scalars().all())

    async def get_resource(self, resource_id: uuid.UUID) -> ActivityResource | None:
        q = (
            select(ActivityResource)
            .where(ActivityResource.id == resource_id)
            .options(selectinload(ActivityResource.photos))
        )
        result = await self.session.execute(q)
        return result.scalar_one_or_none()

    async def count_resources(self, activity_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(func.count(ActivityResource.id)).where(ActivityResource.activity_id == activity_id)
        )
        return int(result.scalar_one())

    async def next_resource_position(self, activity_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(func.coalesce(func.max(ActivityResource.position), -1)).where(
                ActivityResource.activity_id == activity_id
            )
        )
        return int(result.scalar_one()) + 1

    async def create_resource(
        self,
        *,
        activity_id: uuid.UUID,
        kind: str,
        position: int,
        label: str | None = None,
        url: str | None = None,
        note_text: str | None = None,
    ) -> ActivityResource:
        resource = ActivityResource(
            activity_id=activity_id,
            kind=kind,
            position=position,
            label=label,
            url=url,
            note_text=note_text,
        )
        self.session.add(resource)
        await self.session.commit()
        await self.session.refresh(resource)
        return resource

    async def save(self, resource: ActivityResource) -> ActivityResource:
        await self.session.commit()
        await self.session.refresh(resource)
        return resource

    async def delete_resource(self, resource: ActivityResource) -> None:
        await self.session.delete(resource)
        await self.session.commit()

    # ── Photos ───────────────────────────────────────────────────

    async def count_photos(self, resource_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(func.count(ActivityResourcePhoto.id)).where(ActivityResourcePhoto.resource_id == resource_id)
        )
        return int(result.scalar_one())

    async def next_photo_position(self, resource_id: uuid.UUID) -> int:
        result = await self.session.execute(
            select(func.coalesce(func.max(ActivityResourcePhoto.position), -1)).where(
                ActivityResourcePhoto.resource_id == resource_id
            )
        )
        return int(result.scalar_one()) + 1

    async def create_photo(
        self,
        *,
        resource_id: uuid.UUID,
        status: str,
        photo_key: str | None,
        position: int,
    ) -> ActivityResourcePhoto:
        photo = ActivityResourcePhoto(
            resource_id=resource_id,
            status=status,
            photo_key=photo_key,
            position=position,
        )
        self.session.add(photo)
        await self.session.commit()
        await self.session.refresh(photo)
        return photo

    async def get_photo(self, photo_id: uuid.UUID) -> ActivityResourcePhoto | None:
        result = await self.session.execute(select(ActivityResourcePhoto).where(ActivityResourcePhoto.id == photo_id))
        return result.scalar_one_or_none()

    async def delete_photo(self, photo: ActivityResourcePhoto) -> None:
        await self.session.delete(photo)
        await self.session.commit()

    async def get_photo_keys_for_family(self, family_id: uuid.UUID) -> list[str]:
        """All resource-photo S3 keys owned by a family (for erasure cleanup)."""
        q = (
            select(ActivityResourcePhoto.photo_key)
            .join(ActivityResource, ActivityResource.id == ActivityResourcePhoto.resource_id)
            .join(Activity, Activity.id == ActivityResource.activity_id)
            .where(Activity.family_id == family_id, ActivityResourcePhoto.photo_key.isnot(None))
        )
        result = await self.session.execute(q)
        return [k for k in result.scalars().all() if k]
