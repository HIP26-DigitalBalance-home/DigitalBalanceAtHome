from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.services.exceptions import DomainError

from app.api import (
    activities,
    auth,
    challenges,
    children,
    completions,
    consents,
    families,
    groups,
    health,
    photos,
    users,
)

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup")
    yield
    logger.info("shutdown")


app = FastAPI(
    title="DigitalBalance @home API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DomainError)
async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": str(exc), "code": exc.code},
    )


app.include_router(health.router, tags=["health"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(consents.router, prefix="/consents", tags=["consents"])
app.include_router(families.router, prefix="/families", tags=["families"])
app.include_router(children.router, prefix="/children", tags=["children"])
app.include_router(groups.router, prefix="/groups", tags=["groups"])
app.include_router(activities.router, prefix="/activities", tags=["activities"])
app.include_router(challenges.router, prefix="/challenges", tags=["challenges"])
app.include_router(photos.router, prefix="/photos", tags=["photos"])
app.include_router(completions.router, prefix="/completions", tags=["completions"])
