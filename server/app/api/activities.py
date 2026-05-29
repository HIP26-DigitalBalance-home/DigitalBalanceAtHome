from fastapi import APIRouter, HTTPException

router = APIRouter()

_501 = HTTPException(status_code=501, detail="Not implemented")


@router.get("")
async def list_activities():
    raise _501


@router.get("/suggestions")
async def get_suggestions():
    raise _501
