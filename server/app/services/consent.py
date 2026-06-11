import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent import ConsentRecord
from app.repositories.consent import ConsentRepository
from app.schemas.generated import CreateConsentRequest
from app.services.exceptions import ConsentVersionMismatch

CURRENT_POLICY_VERSION = "1.0"


async def create_consent(session: AsyncSession, user_id: uuid.UUID, req: CreateConsentRequest) -> ConsentRecord:
    repo = ConsentRepository(session)
    return await repo.create(user_id, req)


async def get_consent(session: AsyncSession, user_id: uuid.UUID) -> ConsentRecord | None:
    repo = ConsentRepository(session)
    return await repo.get_latest_for_user(user_id)


async def check_consent_current(session: AsyncSession, user_id: uuid.UUID) -> None:
    record = await get_consent(session, user_id)
    if record is None or record.policy_version != CURRENT_POLICY_VERSION:
        raise ConsentVersionMismatch("Datenschutzrichtlinie wurde aktualisiert")
