"""Account lockout helpers for failed PIN attempts."""

from datetime import datetime, timedelta

from app.db.models import User

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 60


def register_failure(user: User) -> None:
    """Increment failed attempts. Lock after MAX_ATTEMPTS failures."""
    user.failed_pin_attempts = user.failed_pin_attempts + 1  # type: ignore[assignment]
    if user.failed_pin_attempts >= MAX_ATTEMPTS:
        user.locked_until = datetime.now() + timedelta(seconds=LOCKOUT_SECONDS)  # type: ignore[assignment]


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
