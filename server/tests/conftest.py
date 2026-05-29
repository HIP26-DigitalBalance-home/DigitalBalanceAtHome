import pytest
from httpx import ASGITransport, AsyncClient
from unittest.mock import AsyncMock

from app.dependencies.database import get_db
from app.main import app


@pytest.fixture
async def client():
    """Test client with the database dependency replaced by a mock session."""
    async def mock_get_db():
        yield AsyncMock()

    app.dependency_overrides[get_db] = mock_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()
