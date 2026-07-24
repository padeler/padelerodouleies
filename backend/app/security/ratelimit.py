"""In-process per-IP rate limiting for sensitive endpoints.

A tiny sliding-window counter keyed by ``(scope, client-ip)``. It lives in the
process because the deployment runs a single Uvicorn worker (same constraint as
the in-process WebSocket broadcaster), so no external store is needed. This is
the anti-parallelization defense that complements the per-account escalating
lockout: it stops an attacker from spraying guesses across many ``user_id``s (or
many accounts) from one host faster than a human ever would.
"""

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException, Request, status

from app.config import trust_proxy

# scope:ip -> monotonic timestamps of recent hits within the window.
_hits: dict[str, deque[float]] = defaultdict(deque)
_lock = Lock()


def _client_ip(request: Request) -> str:
    """Best-effort client IP.

    Only honors ``X-Forwarded-For`` when ``TRUST_PROXY`` is set (behind a proxy
    that overwrites it); otherwise a client could spoof the header to dodge the
    limit. The direct socket peer is the safe default.
    """
    if trust_proxy():
        xff = request.headers.get("x-forwarded-for")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def rate_limit(max_requests: int, window_seconds: int, scope: str):  # type: ignore[no-untyped-def]
    """Build a FastAPI dependency enforcing ``max_requests`` per ``window_seconds`` per IP."""

    def dependency(request: Request) -> None:
        key = f"{scope}:{_client_ip(request)}"
        now = time.monotonic()
        cutoff = now - window_seconds
        with _lock:
            bucket = _hits[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= max_requests:
                retry_after = int(bucket[0] + window_seconds - now) + 1
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please slow down.",
                    headers={"Retry-After": str(retry_after)},
                )
            bucket.append(now)

    return dependency


def reset() -> None:
    """Clear all counters (used by tests to isolate rate-limit state)."""
    with _lock:
        _hits.clear()
