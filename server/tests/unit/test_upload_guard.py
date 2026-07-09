import io
import uuid

import pytest
from fastapi import HTTPException
from starlette.datastructures import Headers
from starlette.datastructures import UploadFile as StarletteUploadFile
from starlette.requests import Request

from app.api import uploads
from app.core.config import settings
from tests.conftest import make_png_header


def _request(headers: dict | None = None) -> Request:
    raw = [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    return Request({"type": "http", "headers": raw, "method": "POST", "path": "/"})


class _CountingFile(io.BytesIO):
    """BytesIO that records how many bytes were actually read."""

    def __init__(self, data: bytes) -> None:
        super().__init__(data)
        self.bytes_read = 0

    def read(self, size: int = -1) -> bytes:
        chunk = super().read(size)
        self.bytes_read += len(chunk)
        return chunk


def _upload(data: bytes, content_type: str = "image/jpeg") -> tuple[StarletteUploadFile, _CountingFile]:
    file = _CountingFile(data)
    upload = StarletteUploadFile(file=file, filename="test.jpg", headers=Headers({"content-type": content_type}))
    return upload, file


USER_ID = uuid.uuid4()


async def test_accepts_valid_jpeg(tiny_jpeg):
    upload, _ = _upload(tiny_jpeg)
    data, content_type = await uploads.read_image_upload(_request(), upload, USER_ID)
    assert data == tiny_jpeg
    assert content_type == "image/jpeg"


async def test_rejects_wrong_content_type():
    upload, file = _upload(b"anything", content_type="application/pdf")
    with pytest.raises(HTTPException) as exc:
        await uploads.read_image_upload(_request(), upload, USER_ID)
    assert exc.value.status_code == 400
    assert file.bytes_read == 0


async def test_spoofed_content_length_fails_fast_without_reading():
    upload, file = _upload(b"small body")
    request = _request({"content-length": str(2 * 1024 * 1024 * 1024)})
    with pytest.raises(HTTPException) as exc:
        await uploads.read_image_upload(request, upload, USER_ID)
    assert exc.value.status_code == 413
    assert file.bytes_read == 0


async def test_oversized_stream_aborts_with_bounded_reads(monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_BYTES", 1024)
    body = b"x" * (3 * 1024 * 1024)  # 3 MB body, 1 KB cap
    upload, file = _upload(body)
    with pytest.raises(HTTPException) as exc:
        await uploads.read_image_upload(_request(), upload, USER_ID)
    assert exc.value.status_code == 413
    # Aborts after the first 1 MB chunk instead of buffering the whole body
    assert file.bytes_read < len(body)


async def test_decompression_bomb_header_rejected(bomb_png):
    upload, _ = _upload(bomb_png, content_type="image/png")
    with pytest.raises(HTTPException) as exc:
        await uploads.read_image_upload(_request(), upload, USER_ID)
    assert exc.value.status_code == 400
    assert "dimensions" in exc.value.detail


async def test_moderately_oversized_dimensions_rejected():
    # 48 MP: below PIL's hard-error threshold but above MAX_IMAGE_PIXELS (40 MP)
    upload, _ = _upload(make_png_header(8000, 6000), content_type="image/png")
    with pytest.raises(HTTPException) as exc:
        await uploads.read_image_upload(_request(), upload, USER_ID)
    assert exc.value.status_code == 400
    assert "dimensions" in exc.value.detail


async def test_garbage_bytes_rejected():
    upload, _ = _upload(b"not an image at all")
    with pytest.raises(HTTPException) as exc:
        await uploads.read_image_upload(_request(), upload, USER_ID)
    assert exc.value.status_code == 400
    assert "not a valid image" in exc.value.detail


async def test_per_user_inflight_cap(monkeypatch, tiny_jpeg):
    monkeypatch.setattr(settings, "MAX_INFLIGHT_UPLOADS_PER_USER", 1)
    monkeypatch.setitem(uploads._inflight_by_user, USER_ID, 1)
    upload, file = _upload(tiny_jpeg)
    with pytest.raises(HTTPException) as exc:
        await uploads.read_image_upload(_request(), upload, USER_ID)
    assert exc.value.status_code == 429
    assert file.bytes_read == 0


async def test_inflight_counter_cleaned_up_after_success(tiny_jpeg):
    upload, _ = _upload(tiny_jpeg)
    await uploads.read_image_upload(_request(), upload, USER_ID)
    assert USER_ID not in uploads._inflight_by_user
