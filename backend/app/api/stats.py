"""Statistics dashboard route."""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.engine import get_session
from app.db.models import User
from app.security.session import get_current_user
from app.services.chores import TZ
from app.services.stats import compute_stats

router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats")
def get_stats(
    db: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """Return cumulative (last-week + all-time) and per-kid star statistics."""
    return compute_stats(db, datetime.now(TZ))
