import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.consent import ConsentRecord
from app.repositories.consent import ConsentRepository
from app.schemas.generated import CreateConsentRequest


async def create_consent(
    session: AsyncSession, user_id: uuid.UUID, req: CreateConsentRequest
) -> ConsentRecord:
    repo = ConsentRepository(session)
    return await repo.create(user_id, req)


async def get_consent(
    session: AsyncSession, user_id: uuid.UUID
) -> ConsentRecord | None:
    repo = ConsentRepository(session)
    return await repo.get_latest_for_user(user_id)
