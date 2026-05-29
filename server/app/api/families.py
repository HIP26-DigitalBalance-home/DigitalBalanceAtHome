from fastapi import APIRouter, HTTPException
from uuid import UUID

router = APIRouter()

_501 = HTTPException(status_code=501, detail="Not implemented")


@router.post("", status_code=201)
async def create_family():
    raise _501


@router.get("/me")
async def get_my_families():
    raise _501


@router.post("/join")
async def join_family():
    raise _501


@router.get("/{family_id}")
async def get_family(family_id: UUID):
    raise _501


@router.post("/{family_id}/invites", status_code=201)
async def create_family_invite(family_id: UUID):
    raise _501


@router.patch("/{family_id}/members/{user_id}")
async def update_family_member(family_id: UUID, user_id: UUID):
    raise _501


@router.delete("/{family_id}/members/{user_id}", status_code=204)
async def remove_family_member(family_id: UUID, user_id: UUID):
    raise _501
