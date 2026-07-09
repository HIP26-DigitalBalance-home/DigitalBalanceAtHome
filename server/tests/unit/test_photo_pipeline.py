import io

import pytest
from PIL import Image

from app.services.photo_pipeline import ImageProcessingError, compress_image_bytes
from tests.conftest import make_png_header


def _jpeg(width: int, height: int) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (width, height), color=(10, 120, 200)).save(buf, format="JPEG")
    return buf.getvalue()


def test_small_jpeg_round_trips():
    out = compress_image_bytes(_jpeg(100, 100))
    img = Image.open(io.BytesIO(out))
    assert img.format == "JPEG"
    assert img.size == (100, 100)


def test_large_image_downscaled_to_1200():
    out = compress_image_bytes(_jpeg(2400, 1600))
    img = Image.open(io.BytesIO(out))
    assert max(img.size) <= 1200


def test_bomb_header_raises_image_processing_error(bomb_png):
    with pytest.raises(ImageProcessingError):
        compress_image_bytes(bomb_png)


def test_garbage_raises_image_processing_error():
    with pytest.raises(ImageProcessingError):
        compress_image_bytes(b"definitely not an image")


def test_moderate_bomb_beyond_max_pixels_raises():
    # 90 MP header: above 2x MAX_IMAGE_PIXELS (40 MP) -> PIL hard-raises on decode
    with pytest.raises(ImageProcessingError):
        compress_image_bytes(make_png_header(10_000, 9_000))
