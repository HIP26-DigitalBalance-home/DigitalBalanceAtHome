"""Tests for the persistent per-user rate limiter (Postgres-backed).

The pre-existing in-memory per-IP limiter for auth is covered separately in
test_rate_limit.py.
"""

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from app.core.config import settings
from app.dependencies.rate_limit import _rate_limiter
from app.repositories.rate_limit import RateLimitRepository
from app.services.exceptions import RateLimited


async def test_hit_upserts_into_fixed_window():
    session = MagicMock()
    result = MagicMock()
    result.scalar_one.return_value = 3
    session.execute = AsyncMock(return_value=result)
    session.commit = AsyncMock()

    count = await RateLimitRepository(session).hit(uuid.uuid4(), "photo_upload:600", 600)

    assert count == 3
    session.commit.assert_awaited_once()
    stmt = session.execute.await_args.args[0]
    params = stmt.compile(dialect=postgresql.dialect()).params
    assert params["action"] == "photo_upload:600"
    # Fixed window: start is aligned to a multiple of the window length
    assert params["window_start"].timestamp() % 600 == 0
    assert params["count"] == 1


async def test_dependency_raises_rate_limited_above_limit(mocker, monkeypatch, mock_user):
    monkeypatch.setattr(settings, "RATE_LIMIT_PHOTO_URLS_PER_MIN", 2)
    hit = mocker.patch.object(RateLimitRepository, "hit", AsyncMock(return_value=3))
    dependency = _rate_limiter("photo_url", [("RATE_LIMIT_PHOTO_URLS_PER_MIN", 60)])

    with pytest.raises(RateLimited):
        await dependency(current_user=mock_user, session=AsyncMock())
    hit.assert_awaited_once_with(mock_user.id, "photo_url:60", 60)


async def test_dependency_passes_at_limit(mocker, monkeypatch, mock_user):
    monkeypatch.setattr(settings, "RATE_LIMIT_PHOTO_URLS_PER_MIN", 2)
    mocker.patch.object(RateLimitRepository, "hit", AsyncMock(return_value=2))
    dependency = _rate_limiter("photo_url", [("RATE_LIMIT_PHOTO_URLS_PER_MIN", 60)])

    await dependency(current_user=mock_user, session=AsyncMock())  # must not raise


async def test_zero_limit_disables_rule(mocker, monkeypatch, mock_user):
    monkeypatch.setattr(settings, "RATE_LIMIT_PHOTO_URLS_PER_MIN", 0)
    hit = mocker.patch.object(RateLimitRepository, "hit", AsyncMock())
    dependency = _rate_limiter("photo_url", [("RATE_LIMIT_PHOTO_URLS_PER_MIN", 60)])

    await dependency(current_user=mock_user, session=AsyncMock())
    hit.assert_not_awaited()


async def test_multiple_rules_all_enforced(mocker, monkeypatch, mock_user):
    monkeypatch.setattr(settings, "RATE_LIMIT_PHOTO_UPLOADS_PER_10_MIN", 20)
    monkeypatch.setattr(settings, "RATE_LIMIT_PHOTO_UPLOADS_PER_DAY", 100)
    # Under the 10-minute limit but over the daily limit
    hit = mocker.patch.object(RateLimitRepository, "hit", AsyncMock(side_effect=[5, 101]))
    dependency = _rate_limiter(
        "photo_upload",
        [("RATE_LIMIT_PHOTO_UPLOADS_PER_10_MIN", 600), ("RATE_LIMIT_PHOTO_UPLOADS_PER_DAY", 86400)],
    )

    with pytest.raises(RateLimited):
        await dependency(current_user=mock_user, session=AsyncMock())
    assert hit.await_count == 2
