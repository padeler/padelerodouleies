"""First-run bootstrap detection."""

from app.db.engine import get_session
from app.db.models import User


def is_first_run() -> bool:
    """Return True when the USERS table is empty."""
    session = next(get_session())
    try:
        return session.query(User).count() == 0
    finally:
        session.close()
