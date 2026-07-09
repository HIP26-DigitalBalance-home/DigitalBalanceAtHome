"""Shared image compression used by the photo background tasks.

Hardened against decompression bombs: PIL refuses to decode anything past
MAX_IMAGE_PIXELS, and a CapacityLimiter bounds how many decodes can hold
pixel buffers concurrently.
"""

import io

import anyio
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import settings

# PIL warns above this pixel count and raises DecompressionBombError at 2x.
# The upload guard rejects images above the exact value before they reach S3;
# this global is the backstop for anything that slips through.
Image.MAX_IMAGE_PIXELS = settings.MAX_IMAGE_PIXELS


class ImageProcessingError(Exception):
    """The uploaded bytes cannot be decoded or compressed safely."""


# At most this many PIL decodes at once — bounds memory and threadpool use
_MAX_CONCURRENT_DECODES = 4

# CapacityLimiter must be created inside a running event loop
_decode_limiter: anyio.CapacityLimiter | None = None


def _get_decode_limiter() -> anyio.CapacityLimiter:
    global _decode_limiter
    if _decode_limiter is None:
        _decode_limiter = anyio.CapacityLimiter(_MAX_CONCURRENT_DECODES)
    return _decode_limiter


def compress_image_bytes(raw: bytes) -> bytes:
    """Decode, bake in EXIF orientation, downscale to <=1200px, re-encode as JPEG q85."""
    try:
        img = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
        img.thumbnail((1200, 1200), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        img.convert("RGB").save(buf, format="JPEG", quality=85)
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError) as exc:
        raise ImageProcessingError(str(exc)) from exc
    return buf.getvalue()


async def compress_in_thread(raw: bytes) -> bytes:
    """Run the CPU-bound compression in a worker thread, bounded by the limiter."""
    return await anyio.to_thread.run_sync(compress_image_bytes, raw, limiter=_get_decode_limiter())
