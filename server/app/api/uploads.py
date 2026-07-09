"""Shared guard for image uploads.

Every upload route funnels through read_image_upload() so that oversized
bodies are rejected without ever being fully buffered, decompression bombs
are rejected before they reach S3, and concurrent uploads cannot stack
unbounded memory.
"""

import io
import uuid

import anyio
from fastapi import HTTPException, Request, UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/jpg"}

_CHUNK_SIZE = 1024 * 1024
# Content-Length covers the whole multipart body, not just the file part
_MULTIPART_SLACK = 1024 * 1024

# CapacityLimiter must be created inside a running event loop
_upload_limiter: anyio.CapacityLimiter | None = None
_inflight_by_user: dict[uuid.UUID, int] = {}


def _get_upload_limiter() -> anyio.CapacityLimiter:
    global _upload_limiter
    if _upload_limiter is None:
        _upload_limiter = anyio.CapacityLimiter(settings.MAX_CONCURRENT_UPLOADS)
    return _upload_limiter


def _too_large() -> HTTPException:
    max_mb = settings.MAX_UPLOAD_BYTES // (1024 * 1024)
    return HTTPException(status_code=413, detail=f"Image must be {max_mb} MB or smaller")


async def read_image_upload(request: Request, image: UploadFile, user_id: uuid.UUID) -> tuple[bytes, str]:
    """Validate and buffer an uploaded image, returning (bytes, content_type).

    Raises 400 for wrong type / invalid image / excessive dimensions,
    413 for oversized bodies, and 429 when the caller already has too many
    uploads in flight.
    """
    if image.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPEG and PNG images are accepted")

    content_length = request.headers.get("content-length")
    if content_length and content_length.isdigit():
        if int(content_length) > settings.MAX_UPLOAD_BYTES + _MULTIPART_SLACK:
            raise _too_large()

    if _inflight_by_user.get(user_id, 0) >= settings.MAX_INFLIGHT_UPLOADS_PER_USER:
        raise HTTPException(status_code=429, detail="Too many uploads in progress — please wait a moment")

    _inflight_by_user[user_id] = _inflight_by_user.get(user_id, 0) + 1
    try:
        async with _get_upload_limiter():
            buf = bytearray()
            while chunk := await image.read(_CHUNK_SIZE):
                buf.extend(chunk)
                if len(buf) > settings.MAX_UPLOAD_BYTES:
                    raise _too_large()
    finally:
        remaining = _inflight_by_user.get(user_id, 1) - 1
        if remaining <= 0:
            _inflight_by_user.pop(user_id, None)
        else:
            _inflight_by_user[user_id] = remaining

    data = bytes(buf)

    # Image.open only parses the header — no pixel decode happens here
    try:
        parsed = Image.open(io.BytesIO(data))
        width, height = parsed.size
    except Image.DecompressionBombError:
        raise HTTPException(status_code=400, detail="Image dimensions are too large")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="The file is not a valid image")

    if width * height > settings.MAX_IMAGE_PIXELS:
        raise HTTPException(status_code=400, detail="Image dimensions are too large")

    return data, image.content_type or "image/jpeg"
