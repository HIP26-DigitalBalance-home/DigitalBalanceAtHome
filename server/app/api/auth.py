from fastapi import APIRouter, HTTPException

router = APIRouter()

_501 = HTTPException(status_code=501, detail="Not implemented")


@router.post("/google/callback")
async def google_callback():
    raise _501


@router.post("/refresh")
async def refresh():
    raise _501


@router.delete("/logout", status_code=204)
async def logout():
    raise _501
