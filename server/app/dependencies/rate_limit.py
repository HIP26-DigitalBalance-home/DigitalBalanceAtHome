"""Per-user rate-limit dependencies.

Each limiter is a module-level named instance so tests can disable it via
app.dependency_overrides. Limits are Settings fields; a limit <= 0 disables
that rule. Counters are stored in Postgres (rate_limit_counters), so they
survive restarts and need no extra infrastructure.
"""

from collections.abc import Awaitable, Callable

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.dependencies.auth import get_current_user
from app.dependencies.database import get_db
from app.models.user import User
from app.repositories.rate_limit import RateLimitRepository
from app.services.exceptions import RateLimited


def _rate_limiter(action: str, rules: list[tuple[str, int]]) -> Callable[..., Awaitable[None]]:
    """Build a dependency enforcing all (settings_attr, window_seconds) rules."""

    async def dependency(
        current_user: User = Depends(get_current_user),
        session: AsyncSession = Depends(get_db),
    ) -> None:
        repo = RateLimitRepository(session)
        for limit_attr, window_seconds in rules:
            limit = getattr(settings, limit_attr)
            if limit <= 0:
                continue
            # Window length is part of the key so rules never share a row
            count = await repo.hit(current_user.id, f"{action}:{window_seconds}", window_seconds)
            if count > limit:
                raise RateLimited("Too many requests — please slow down and try again later")

    return dependency


photo_upload_limiter = _rate_limiter(
    "photo_upload",
    [("RATE_LIMIT_PHOTO_UPLOADS_PER_10_MIN", 600), ("RATE_LIMIT_PHOTO_UPLOADS_PER_DAY", 86400)],
)
profile_update_limiter = _rate_limiter("profile_update", [("RATE_LIMIT_PROFILE_UPDATES_PER_HOUR", 3600)])
photo_url_limiter = _rate_limiter("photo_url", [("RATE_LIMIT_PHOTO_URLS_PER_MIN", 60)])
photo_proxy_limiter = _rate_limiter("photo_proxy", [("RATE_LIMIT_PHOTO_PROXY_PER_MIN", 60)])
activity_create_limiter = _rate_limiter("activity_create", [("RATE_LIMIT_ACTIVITY_CREATES_PER_HOUR", 3600)])

ALL_LIMITERS = (
    photo_upload_limiter,
    profile_update_limiter,
    photo_url_limiter,
    photo_proxy_limiter,
    activity_create_limiter,
)
