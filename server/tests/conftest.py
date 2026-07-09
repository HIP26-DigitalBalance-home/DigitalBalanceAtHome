import io
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest
from httpx import ASGITransport, AsyncClient
from PIL import Image

from app.dependencies.auth import get_current_user, get_current_user_allow_pending, get_current_user_with_consent_check
from app.dependencies.database import get_db
from app.dependencies.rate_limit import ALL_LIMITERS
from app.main import app


def _make_user(user_id: uuid.UUID | None = None) -> MagicMock:
    user = MagicMock()
    user.id = user_id or uuid.uuid4()
    user.email = "test@example.com"
    user.display_name = "Test Parent"
    user.profile_photo_key = None
    user.points_balance = 0
    user.deletion_pending_at = None
    user.created_at = datetime.now(timezone.utc)
    return user


async def _no_rate_limit() -> None:
    return None


def _disable_rate_limits() -> None:
    """Rate limiters hit the DB, which is mocked here — disable them by default.

    Tests that exercise 429s pop the specific limiter from
    app.dependency_overrides and patch RateLimitRepository instead."""
    for limiter in ALL_LIMITERS:
        app.dependency_overrides[limiter] = _no_rate_limit


@pytest.fixture(scope="session")
def tiny_jpeg() -> bytes:
    """Minimal real JPEG bytes — upload routes validate image headers now."""
    buf = io.BytesIO()
    Image.new("RGB", (16, 16), color=(120, 60, 30)).save(buf, format="JPEG")
    return buf.getvalue()


def make_png_header(width: int, height: int) -> bytes:
    """A ~60-byte PNG whose header claims the given dimensions.

    Parses as a valid PNG header without allocating any pixel data — used to
    test decompression-bomb rejection."""
    import struct
    import zlib

    signature = b"\x89PNG\r\n\x1a\n"
    ihdr_data = struct.pack(">II5B", width, height, 8, 2, 0, 0, 0)
    ihdr = struct.pack(">I", 13) + b"IHDR" + ihdr_data + struct.pack(">I", zlib.crc32(b"IHDR" + ihdr_data))
    # PIL requires an IDAT chunk to accept the header; empty is fine
    idat = struct.pack(">I", 0) + b"IDAT" + struct.pack(">I", zlib.crc32(b"IDAT"))
    iend = struct.pack(">I", 0) + b"IEND" + struct.pack(">I", zlib.crc32(b"IEND"))
    return signature + ihdr + idat + iend


@pytest.fixture(scope="session")
def bomb_png() -> bytes:
    """PNG header claiming 100000x100000 (10 gigapixels) — no pixel data."""
    return make_png_header(100_000, 100_000)


@pytest.fixture
async def client():
    """Test client with the database dependency replaced by a mock session."""

    async def mock_get_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = mock_get_db
    _disable_rate_limits()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
async def auth_client():
    """Test client with both mock DB and mock authenticated user."""
    mock_user = _make_user()

    async def mock_get_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = mock_get_db
    app.dependency_overrides[get_current_user] = lambda: mock_user
    app.dependency_overrides[get_current_user_allow_pending] = lambda: mock_user
    app.dependency_overrides[get_current_user_with_consent_check] = lambda: mock_user
    _disable_rate_limits()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    app.dependency_overrides.clear()


@pytest.fixture
def mock_user() -> MagicMock:
    return _make_user()
