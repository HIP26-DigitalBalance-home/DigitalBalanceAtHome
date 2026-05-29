from fastapi import APIRouter, HTTPException
from uuid import UUID

router = APIRouter()

_501 = HTTPException(status_code=501, detail="Not implemented")


@router.post("", status_code=202)
async def upload_photo():
    raise _501


@router.get("/{completion_id}/url")
async def get_photo_url(completion_id: UUID):
    raise _501
