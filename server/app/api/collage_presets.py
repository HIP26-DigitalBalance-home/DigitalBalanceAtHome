from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.repositories.collage_presets import CollagePresetRepository
from app.schemas.generated import CollagePreset

router = APIRouter()


def _preset_schema(p) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "activity_ids": p.activity_ids,
    }


@router.get("", response_model=list[CollagePreset])
async def list_collage_presets(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> list[dict]:
    repo = CollagePresetRepository(session)
    presets = await repo.list_all()
    return [_preset_schema(p) for p in presets]
