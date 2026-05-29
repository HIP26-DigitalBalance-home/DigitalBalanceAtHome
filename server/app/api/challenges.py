from fastapi import APIRouter, HTTPException
from uuid import UUID

router = APIRouter()

_501 = HTTPException(status_code=501, detail="Not implemented")


@router.post("", status_code=201)
async def create_challenge():
    raise _501


@router.get("/active")
async def get_active_challenge():
    raise _501


@router.get("/me")
async def get_my_challenges():
    raise _501


@router.get("/{challenge_id}")
async def get_challenge(challenge_id: UUID):
    raise _501
