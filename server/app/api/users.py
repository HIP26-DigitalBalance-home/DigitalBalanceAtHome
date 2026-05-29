from fastapi import APIRouter, HTTPException

router = APIRouter()

_501 = HTTPException(status_code=501, detail="Not implemented")


@router.get("/me")
async def get_me():
    raise _501


@router.patch("/me")
async def update_me():
    raise _501


@router.delete("/me", status_code=202)
async def delete_me():
    raise _501


@router.post("/me/cancel-deletion")
async def cancel_deletion():
    raise _501


@router.get("/me/export")
async def export_data():
    raise _501
