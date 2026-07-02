import asyncio
import uuid as _uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import structlog
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import (
    activities,
    auth,
    challenges,
    children,
    collage_presets,
    completions,
    consents,
    families,
    groups,
    health,
    photos,
    progress,
    users,
)
from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.services.exceptions import DomainError

logger = structlog.get_logger()

_STATUS_TO_CODE: dict[int, str] = {
    400: "bad_request",
    401: "unauthorized",
    403: "forbidden",
    404: "not_found",
    409: "conflict",
    422: "validation_error",
    429: "rate_limited",
    500: "internal_error",
}


async def _freeze_job_loop() -> None:
    """Runs the streak auto-freeze job daily at 21:00 UTC."""
    from app.services.progress import run_freeze_job

    while True:
        now = datetime.now(timezone.utc)
        next_run = now.replace(hour=21, minute=0, second=0, microsecond=0)
        if now >= next_run:
            next_run += timedelta(days=1)
        wait_seconds = (next_run - now).total_seconds()
        logger.info("freeze_job_scheduled", next_run=next_run.isoformat())
        await asyncio.sleep(wait_seconds)
        try:
            async with AsyncSessionLocal() as session:
                await run_freeze_job(session)
            logger.info("freeze_job_completed")
        except Exception:
            logger.exception("freeze_job_failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_freeze_job_loop())
    logger.info("startup")
    yield
    task.cancel()
    logger.info("shutdown")


app = FastAPI(
    title="DigitalBalance @home API",
    version="0.1.0",
    lifespan=lifespan,
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(_uuid.uuid4())
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(request_id=request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


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


@app.exception_handler(HTTPException)
async def structured_http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code = _STATUS_TO_CODE.get(exc.status_code, "error")
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": code},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"detail": str(exc), "code": "validation_error"},
    )


app.include_router(health.router, tags=["health"])
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(users.router, prefix="/users", tags=["users"])
app.include_router(consents.router, prefix="/consents", tags=["consents"])
app.include_router(families.router, prefix="/families", tags=["families"])
app.include_router(children.router, prefix="/children", tags=["children"])
app.include_router(groups.router, prefix="/groups", tags=["groups"])
app.include_router(activities.router, prefix="/activities", tags=["activities"])
app.include_router(collage_presets.router, prefix="/collage-presets", tags=["collage-presets"])
app.include_router(challenges.router, prefix="/challenges", tags=["challenges"])
app.include_router(photos.router, prefix="/photos", tags=["photos"])
app.include_router(completions.router, prefix="/completions", tags=["completions"])
app.include_router(progress.router, prefix="/families", tags=["families"])

if settings.SEED_ENABLED:
    from app.api import dev

    app.include_router(dev.router, prefix="/dev", tags=["dev"])
