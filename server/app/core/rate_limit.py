import asyncio
from collections import defaultdict, deque
from time import monotonic

_windows: dict[str, deque[float]] = defaultdict(deque)
_lock = asyncio.Lock()


async def is_allowed(key: str, max_requests: int = 10, window_seconds: int = 60) -> bool:
    now = monotonic()
    cutoff = now - window_seconds

    async with _lock:
        q = _windows[key]
        while q and q[0] < cutoff:
            q.popleft()
        if len(q) >= max_requests:
            return False
        q.append(now)
        return True
