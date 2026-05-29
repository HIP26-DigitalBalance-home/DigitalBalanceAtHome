from fastapi import APIRouter, HTTPException

router = APIRouter()

_501 = HTTPException(status_code=501, detail="Not implemented")


@router.post("", status_code=201)
async def create_consent():
    raise _501


@router.get("")
async def get_consents():
    raise _501
