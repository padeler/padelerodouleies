"""Account lockout helpers for failed PIN attempts.

The lockout duration *escalates* with each additional failure past the
threshold, so a stubborn brute-force attempt against a single account faces
exponentially longer waits instead of a flat, self-clearing 60s window. The
first lockout is still ``LOCKOUT_SECONDS`` (a genuine fat-finger by a kid), then
each further failure multiplies the wait up to ``MAX_LOCKOUT_SECONDS``.
"""

from datetime import datetime, timedelta

from app.db.models import User

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 60
# Escalation: each failure beyond the threshold multiplies the wait by this
# factor, capped so an account is never locked for more than an hour.
LOCKOUT_BACKOFF_FACTOR = 4
MAX_LOCKOUT_SECONDS = 3600


def _lockout_seconds(failed_attempts: int) -> int:
    """Escalating lockout duration for a given failed-attempt count."""
    over = max(0, failed_attempts - MAX_ATTEMPTS)
    seconds: int = LOCKOUT_SECONDS * (LOCKOUT_BACKOFF_FACTOR ** over)
    return min(seconds, MAX_LOCKOUT_SECONDS)


def register_failure(user: User) -> None:
    """Increment failed attempts. Lock (with escalating backoff) past the threshold."""
    user.failed_pin_attempts = user.failed_pin_attempts + 1  # type: ignore[assignment]
    if user.failed_pin_attempts >= MAX_ATTEMPTS:
        delay = _lockout_seconds(int(user.failed_pin_attempts))
        user.locked_until = datetime.now() + timedelta(seconds=delay)  # type: ignore[assignment]


def register_success(user: User) -> None:
    """Reset lockout state on successful authentication."""
    user.failed_pin_attempts = 0  # type: ignore[assignment]
    user.locked_until = None  # type: ignore[assignment]


def is_locked(user: User) -> tuple[bool, int]:
    """Check if a user is currently locked out.

    Returns (is_locked, seconds_remaining).
    If not locked, returns (False, 0).
    """
    locked_until = user.locked_until
    if locked_until is None:
        return (False, 0)

    now = datetime.now()
    if now >= locked_until:
        return (False, 0)

    remaining = int((locked_until - now).total_seconds())
    return (True, remaining)
