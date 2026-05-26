"""Leaderboard route."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.engine import get_session
from app.db.models import User
from app.security.session import get_current_user

router = APIRouter(prefix="/api", tags=["leaderboard"])


@router.get("/leaderboard")
def get_leaderboard(
    db: Session = Depends(get_session),
    _user: User = Depends(get_current_user),
) -> list[dict]:
    """Return kids ranked by stars descending, tie-break by id ascending."""
    kids = (
        db.query(User)
        .filter(User.role == "user", User.is_active == True)
        .order_by(User.current_stars.desc(), User.id.asc())
        .all()
    )
    ranking = 0
    result = []
    for kid in kids:
        ranking += 1
        result.append({
            "ranking": ranking,
            "id": kid.id,
            "name": kid.name,
            "avatar_kind": kid.avatar_kind,
            "avatar_value": kid.avatar_value,
            "current_stars": kid.current_stars,
        })
    return result
