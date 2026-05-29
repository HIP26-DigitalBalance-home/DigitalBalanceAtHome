from fastapi import APIRouter, HTTPException
from uuid import UUID

router = APIRouter()

_501 = HTTPException(status_code=501, detail="Not implemented")


@router.post("", status_code=201)
async def create_completion():
    raise _501


@router.get("/me")
async def get_my_completions():
    raise _501


@router.get("/{completion_id}")
async def get_completion(completion_id: UUID):
    raise _501
