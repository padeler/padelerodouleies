"""Tests for PIN hashing and lockout mechanics."""

import pytest
from datetime import datetime, timedelta

from app.db.models import User
from app.security.pins import hash_pin, verify_pin, _validate_pin
from app.security.lockout import register_failure, register_success, is_locked, MAX_ATTEMPTS, LOCKOUT_SECONDS


def test_hash_and_verify_round_trip() -> None:
    h = hash_pin("1234")
    assert verify_pin("1234", h) is True
    assert verify_pin("0000", h) is False


def test_hash_pin_rejects_invalid() -> None:
    for invalid in ["123", "12345", "abcd", "12a4", "", " "]:
        with pytest.raises(ValueError):
            hash_pin(invalid)


def test_verify_pin_rejects_invalid() -> None:
    for invalid in ["123", "12345", "abcd"]:
        with pytest.raises(ValueError):
            verify_pin(invalid, "$2b$12$dummy")


def test_lockout_after_max_failures() -> None:
    user = User(name="Kid", role="user", avatar_value="fox", failed_pin_attempts=0)
    for _ in range(MAX_ATTEMPTS - 1):
        register_failure(user)
    assert is_locked(user) == (False, 0)

    register_failure(user)
    locked, seconds = is_locked(user)
    assert locked is True
    assert 0 < seconds <= LOCKOUT_SECONDS


def test_lockout_unlocks_after_timeout() -> None:
    user = User(name="Kid", role="user", avatar_value="fox")
    user.locked_until = datetime.now() - timedelta(seconds=10)
    assert is_locked(user) == (False, 0)


def test_success_resets_counter() -> None:
    user = User(name="Kid", role="user", avatar_value="fox", failed_pin_attempts=3)
    user.locked_until = datetime.now() + timedelta(minutes=1)
    register_success(user)
    assert user.failed_pin_attempts == 0
    assert user.locked_until is None
    assert is_locked(user) == (False, 0)


def test_not_locked_user() -> None:
    user = User(name="Kid", role="user", avatar_value="fox")
    assert is_locked(user) == (False, 0)
