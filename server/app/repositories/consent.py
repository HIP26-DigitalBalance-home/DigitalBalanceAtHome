import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent import ConsentRecord
from app.schemas.generated import CreateConsentRequest


class ConsentRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def create(self, user_id: uuid.UUID, req: CreateConsentRequest) -> ConsentRecord:
        record = ConsentRecord(
            user_id=user_id,
            policy_version=req.policy_version,
            consented_at=datetime.now(timezone.utc),
            data_storage_consent=req.data_storage_consent,
            photo_processing_consent=req.photo_processing_consent,
            location_consent=req.location_consent or False,
        )
        self.session.add(record)
        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def get_latest_for_user(self, user_id: uuid.UUID) -> ConsentRecord | None:
        result = await self.session.execute(
            select(ConsentRecord)
            .where(ConsentRecord.user_id == user_id)
            .order_by(ConsentRecord.consented_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
