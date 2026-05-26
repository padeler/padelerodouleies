"""PIN hashing and verification with bcrypt."""

import bcrypt


def hash_pin(pin: str) -> str:
    """Hash a 4-digit PIN with bcrypt (cost 12)."""
    _validate_pin(pin)
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_pin(pin: str, pin_hash: str) -> bool:
    """Verify a 4-digit PIN against a bcrypt hash."""
    _validate_pin(pin)
    try:
        return bcrypt.checkpw(pin.encode("utf-8"), pin_hash.encode("utf-8"))
    except ValueError:
        return False


def _validate_pin(pin: str) -> None:
    if not isinstance(pin, str) or len(pin) != 4 or not pin.isdigit():
        raise ValueError("PIN must be exactly 4 numeric digits")
