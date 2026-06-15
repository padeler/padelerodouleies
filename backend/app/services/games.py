"""Game best-score service for the Games tab mini-games.

Scores carry no star value — they are bragging rights only, surfaced in the
Stats tab. The server is the single source of truth for "best": a submitted
score only overwrites the stored one when it is better, where "better"
depends on the game (fewest moves for memory, highest score otherwise).
"""

from datetime import datetime, timezone
from typing import Literal

from sqlalchemy.orm import Session

from app.db.models import GameScore

Direction = Literal["higher", "lower"]

# The closed set of known game keys and their improvement direction.
GAME_SCORE_DIRECTIONS: dict[str, Direction] = {
    "memory.easy": "lower",
    "memory.medium": "lower",
    "memory.hard": "lower",
    "simon": "higher",
    "catcher": "higher",
    "snake": "higher",
    "whack": "higher",
}


class UnknownGameError(ValueError):
    """Raised when a score is submitted for a game key we don't know."""


def submit_score(db: Session, user_id: int, game: str, score: int) -> tuple[int, bool]:
    """Record `score` for (user, game) if it beats the stored best.

    Returns (best_score, improved). Raises UnknownGameError for unknown game
    keys and ValueError for non-positive scores — no silent acceptance.
    """
    direction = GAME_SCORE_DIRECTIONS.get(game)
    if direction is None:
        raise UnknownGameError(f"Unknown game key: {game!r}")
    if score <= 0:
        raise ValueError(f"Score must be positive, got {score}")

    row = db.query(GameScore).filter(GameScore.user_id == user_id, GameScore.game == game).first()
    if row is None:
        row = GameScore(user_id=user_id, game=game, best_score=score)
        db.add(row)
        db.commit()
        return score, True

    current: int = row.best_score
    improved = score > current if direction == "higher" else score < current
    if improved:
        row.best_score = score
        row.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
        return score, True
    return current, False


def scores_for_user(db: Session, user_id: int) -> dict[str, int]:
    """All best scores for one user, keyed by game."""
    rows = db.query(GameScore).filter(GameScore.user_id == user_id).all()
    return {row.game: row.best_score for row in rows}


def scores_by_user(db: Session, user_ids: list[int]) -> dict[int, dict[str, int]]:
    """Best scores for many users at once: {user_id: {game: best_score}}."""
    result: dict[int, dict[str, int]] = {uid: {} for uid in user_ids}
    rows = db.query(GameScore).filter(GameScore.user_id.in_(user_ids)).all()
    for row in rows:
        result[row.user_id][row.game] = row.best_score
    return result
