"""Game score routes — best scores for the Games tab mini-games."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.db.engine import get_session
from app.db.models import User
from app.security.session import get_current_user
from app.services.games import UnknownGameError, scores_for_user, submit_score

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["games"])


class ScoreSubmission(BaseModel):
    game: str = Field(max_length=40)
    score: int = Field(gt=0)


@router.get("/games/scores")
def get_my_scores(
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, int]:
    """The current user's best score per game, keyed by game."""
    return scores_for_user(db, current_user.id)


@router.post("/games/scores")
def post_score(
    payload: ScoreSubmission,
    db: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, int | bool]:
    """Record a finished game's score; only improvements overwrite the best."""
    try:
        best, improved = submit_score(db, current_user.id, payload.game, payload.score)
    except UnknownGameError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    logger.info(
        "game score: user=%s game=%s score=%s best=%s improved=%s",
        current_user.id, payload.game, payload.score, best, improved,
    )
    return {"best_score": best, "improved": improved}
