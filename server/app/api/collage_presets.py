from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.dependencies.language import get_request_language
from app.models.user import User
from app.repositories.collage_presets import CollagePresetRepository
from app.schemas.generated import CollagePreset
from app.services.localization import pick

router = APIRouter()


def _preset_schema(p, language: str = "de") -> dict:
    return {
        "id": p.id,
        "name": pick(p.name, p.name_en, language),
        "description": pick(p.description, p.description_en, language),
        "activity_ids": p.activity_ids,
    }


@router.get("", response_model=list[CollagePreset])
async def list_collage_presets(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
    language: str = Depends(get_request_language),
) -> list[dict]:
    repo = CollagePresetRepository(session)
    presets = await repo.list_all()
    return [_preset_schema(p, language) for p in presets]
