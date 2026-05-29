from fastapi import APIRouter, HTTPException
from uuid import UUID

router = APIRouter()

_501 = HTTPException(status_code=501, detail="Not implemented")


@router.post("", status_code=201)
async def create_child():
    raise _501


@router.get("")
async def get_children():
    raise _501


@router.patch("/{child_id}")
async def update_child(child_id: UUID):
    raise _501


@router.delete("/{child_id}", status_code=204)
async def delete_child(child_id: UUID):
    raise _501
