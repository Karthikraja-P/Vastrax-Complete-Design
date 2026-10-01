"""In-memory sliding-window limiter (valid for a single uvicorn worker)."""
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_hits: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def client_ip(request: Request) -> str:
    h = request.headers
    return (
        h.get("cf-connecting-ip")
        or h.get("x-forwarded-for", "").split(",")[0].strip()
        or (request.client.host if request.client else "unknown")
    )


def hit(key: str, limit: int, window: float) -> int:
    """Record a hit; return 0 if allowed, else seconds until retry."""
    now = time.monotonic()
    with _lock:
        q = _hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return int(window - (now - q[0])) + 1
        q.append(now)
        if len(_hits) > 20000:
            for k in [k for k, v in _hits.items() if not v]:
                del _hits[k]
        return 0


def reset(key: str) -> None:
    with _lock:
        _hits.pop(key, None)


def enforce(key: str, limit: int, window: float) -> None:
    retry = hit(key, limit, window)
    if retry:
        raise HTTPException(429, "Too many attempts. Please try again later.", headers={"Retry-After": str(retry)})
