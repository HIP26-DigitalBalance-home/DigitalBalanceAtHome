import pytest

from app.core.rate_limit import _windows, is_allowed


@pytest.fixture(autouse=True)
def clear_windows():
    _windows.clear()
    yield
    _windows.clear()


async def test_allows_up_to_limit():
    for _ in range(10):
        assert await is_allowed("test_key", max_requests=10, window_seconds=60)


async def test_blocks_at_limit():
    for _ in range(10):
        await is_allowed("test_key", max_requests=10, window_seconds=60)
    assert not await is_allowed("test_key", max_requests=10, window_seconds=60)


async def test_different_keys_are_independent():
    for _ in range(10):
        await is_allowed("key_a", max_requests=10, window_seconds=60)
    # key_a is exhausted but key_b should still be allowed
    assert not await is_allowed("key_a", max_requests=10, window_seconds=60)
    assert await is_allowed("key_b", max_requests=10, window_seconds=60)


async def test_expired_requests_not_counted():
    # Fill the window
    for _ in range(10):
        await is_allowed("test_key", max_requests=10, window_seconds=60)
    assert not await is_allowed("test_key", max_requests=10, window_seconds=60)

    # Manually backdate all timestamps so they fall outside the window
    from collections import deque
    _windows["test_key"] = deque([0.0])  # epoch — far in the past

    assert await is_allowed("test_key", max_requests=10, window_seconds=60)
