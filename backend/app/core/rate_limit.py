"""In-memory sliding-window limiter (valid for a single uvicorn worker)."""
import ipaddress
import threading
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_hits: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()
_MAX_TRACKED_KEYS = 20_000
_IDLE_KEY_TTL_SECONDS = 3600
_SWEEP_EVERY_HITS = 256
_hit_count = 0


def client_ip(request: Request) -> str:
    # Cloudflare overwrites this header at its edge. Never trust client-supplied
    # X-Forwarded-For: it can be forged to create a fresh rate-limit bucket.
    peer = request.client.host if request.client else "unknown"
    candidate = request.headers.get("cf-connecting-ip", "").strip()
    try:
        return str(ipaddress.ip_address(candidate)) if candidate else peer
    except ValueError:
        return peer


def _sweep_stale_keys(now: float) -> None:
    stale_before = now - _IDLE_KEY_TTL_SECONDS
    for key, bucket in list(_hits.items()):
        while bucket and bucket[0] < stale_before:
            bucket.popleft()
        if not bucket:
            _hits.pop(key, None)
    if len(_hits) >= _MAX_TRACKED_KEYS:
        # Leave one slot for the current request that triggered the sweep.
        oldest = sorted(_hits, key=lambda key: _hits[key][-1])[:len(_hits) - (_MAX_TRACKED_KEYS - 1)]
        for key in oldest:
            _hits.pop(key, None)


def hit(key: str, limit: int, window: float) -> int:
    """Record a hit; return 0 if allowed, else seconds until retry."""
    global _hit_count
    now = time.monotonic()
    with _lock:
        _hit_count += 1
        if _hit_count % _SWEEP_EVERY_HITS == 0 or len(_hits) >= _MAX_TRACKED_KEYS:
            _sweep_stale_keys(now)
        q = _hits[key]
        while q and now - q[0] > window:
            q.popleft()
        if len(q) >= limit:
            return int(window - (now - q[0])) + 1
        q.append(now)
        return 0


def reset(key: str) -> None:
    with _lock:
        _hits.pop(key, None)


def enforce(key: str, limit: int, window: float) -> None:
    retry = hit(key, limit, window)
    if retry:
        raise HTTPException(429, "Too many attempts. Please try again later.", headers={"Retry-After": str(retry)})
