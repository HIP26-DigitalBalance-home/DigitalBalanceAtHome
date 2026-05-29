from fastapi import APIRouter, HTTPException
from uuid import UUID

router = APIRouter()

_501 = HTTPException(status_code=501, detail="Not implemented")


@router.post("", status_code=201)
async def create_group():
    raise _501


@router.get("/me")
async def get_my_groups():
    raise _501


@router.post("/join")
async def join_group():
    raise _501


@router.get("/{group_id}")
async def get_group(group_id: UUID):
    raise _501


@router.post("/{group_id}/invites", status_code=201)
async def create_group_invite(group_id: UUID):
    raise _501


@router.delete("/{group_id}/members/{family_id}", status_code=204)
async def remove_group_member(group_id: UUID, family_id: UUID):
    raise _501


@router.post("/{group_id}/admins", status_code=201)
async def grant_group_admin(group_id: UUID):
    raise _501


@router.delete("/{group_id}/admins/{user_id}", status_code=204)
async def revoke_group_admin(group_id: UUID, user_id: UUID):
    raise _501


@router.get("/{group_id}/feed")
async def get_group_feed(group_id: UUID):
    raise _501
