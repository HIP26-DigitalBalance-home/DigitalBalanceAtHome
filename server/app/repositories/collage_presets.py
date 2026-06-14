from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.collage_preset import CollagePreset


class CollagePresetRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_all(self) -> list[CollagePreset]:
        result = await self.session.execute(select(CollagePreset).order_by(CollagePreset.sort_order))
        return list(result.scalars().all())
