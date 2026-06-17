"""Exercise grading, age targeting, and star award.

Grading is deterministic and server-side: the manifest's ``answer`` never
reaches the client (see ``schemas.exercises.kid_view``); the client posts the
kid's response and these pure functions decide right/wrong. Every submission is
logged to ``EXERCISE_ATTEMPTS`` (append-only), so any future star policy is
computable retroactively (PLAN.md Q1). Completing a bundle awards stars exactly
once per (kid, bundle, version), through the append-only ``HistoryLedger`` like
every other star movement (invariant #4).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.db.models import ExerciseAttempt, ExerciseCompletion, HistoryLedger, User
from app.schemas.exercises import (
    BundleManifest,
    CountingExercise,
    MatchPairsExercise,
    MultipleChoiceExercise,
    NumericEntryExercise,
    OrderingExercise,
)
from app.services.chores import TZ
from app.services.exercise_bundles import DiscoveredBundle, discover

logger = logging.getLogger(__name__)


class ResponseError(ValueError):
    """A submitted response is structurally invalid for the exercise type."""


def _now_utc() -> datetime:
    """Naive-UTC timestamp, matching the ledger convention (_start_of history)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def age_for(birthdate: date, today: date) -> int:
    """Whole years old on ``today`` (Athens-local), derived not stored."""
    years = today.year - birthdate.year
    if (today.month, today.day) < (birthdate.month, birthdate.day):
        years -= 1
    return years


def today_athens() -> date:
    """Today's date in Athens local time (age is computed against this)."""
    return datetime.now(TZ).date()


# -- visibility -------------------------------------------------------------


def visible_bundles(user: User) -> list[DiscoveredBundle]:
    """Bundles a kid may see: age within ``[age_min, age_max]`` inclusive.

    A kid with no birthdate set sees nothing (fail-explicit; the admin bundles
    page calls it out).
    """
    if user.birthdate is None:
        return []
    age = age_for(user.birthdate, today_athens())
    return [
        b
        for b in discover().valid
        if b.manifest.age_min <= age <= b.manifest.age_max
    ]


def completed_bundle_keys(db: Session, user_id: int) -> set[tuple[str, int]]:
    """Set of (bundle_id, version) the kid has already completed."""
    rows = (
        db.query(ExerciseCompletion.bundle_id, ExerciseCompletion.bundle_version)
        .filter(ExerciseCompletion.user_id == user_id)
        .all()
    )
    return {(r[0], r[1]) for r in rows}


# -- grading ----------------------------------------------------------------


def grade(exercise: Any, response: Any) -> bool:
    """Decide whether ``response`` answers ``exercise`` correctly.

    Pure and deterministic. Raises ``ResponseError`` when the response is the
    wrong shape for the type (a client bug, surfaced as 400 — not a silent
    "incorrect").
    """
    if isinstance(exercise, MultipleChoiceExercise):
        if not isinstance(response, str):
            raise ResponseError("multiple_choice response must be an option id string")
        return response == exercise.answer

    if isinstance(exercise, (NumericEntryExercise, CountingExercise)):
        return _as_int(response) == exercise.answer

    if isinstance(exercise, OrderingExercise):
        if not isinstance(response, list) or not all(isinstance(x, str) for x in response):
            raise ResponseError("ordering response must be a list of item ids")
        return response == exercise.answer

    if isinstance(exercise, MatchPairsExercise):
        if not isinstance(response, dict):
            raise ResponseError("match_pairs response must be a {left_id: right_id} map")
        expected = {p.left.id: p.right.id for p in exercise.pairs}
        return response == expected

    raise ResponseError(f"unknown exercise type: {getattr(exercise, 'type', '?')}")


def _as_int(response: Any) -> int:
    """Coerce a numeric response to int (exact). Accepts int or a digit string.

    bool is rejected (it is an int subclass but never a valid numeric answer).
    """
    if isinstance(response, bool):
        raise ResponseError("numeric response must be an integer, not a boolean")
    if isinstance(response, int):
        return response
    if isinstance(response, str):
        text = response.strip()
        try:
            return int(text)
        except ValueError as exc:
            raise ResponseError(f"numeric response is not an integer: {response!r}") from exc
    raise ResponseError(f"numeric response must be an integer, got {type(response).__name__}")


def _exercise_by_id(manifest: BundleManifest, exercise_id: str) -> Any | None:
    return next((e for e in manifest.exercises if e.id == exercise_id), None)


# -- star policy (single pure function — PLAN.md Q1) ------------------------


def compute_bundle_stars(manifest: BundleManifest, attempts: list[ExerciseAttempt]) -> int:
    """How many stars completing this bundle earns.

    MVP policy: lenient — the full ``bundle.stars`` on completion, regardless of
    retries. Every attempt is on record (``attempts``), so a stricter policy can
    be computed retroactively without a data migration. This is the *only* place
    a policy change ever touches.
    """
    return manifest.stars


# -- submission + completion ------------------------------------------------


@dataclass
class SubmissionResult:
    correct: bool
    completed: bool
    stars_awarded: int
    current_stars: int


def _is_complete(db: Session, user_id: int, bundle: DiscoveredBundle) -> bool:
    """True once the kid has ≥1 correct attempt for every exercise (this version)."""
    correct_ids = {
        row[0]
        for row in db.query(ExerciseAttempt.exercise_id)
        .filter(
            ExerciseAttempt.user_id == user_id,
            ExerciseAttempt.bundle_id == bundle.manifest.id,
            ExerciseAttempt.bundle_version == bundle.manifest.version,
            ExerciseAttempt.correct.is_(True),
        )
        .all()
    }
    return all(e.id in correct_ids for e in bundle.manifest.exercises)


def submit_answer(
    db: Session, user: User, bundle: DiscoveredBundle, exercise_id: str, response: Any
) -> SubmissionResult:
    """Grade + record one answer; award stars on first full completion.

    Raises ``KeyError`` if the exercise id is not in the bundle and
    ``ResponseError`` for a malformed response.
    """
    exercise = _exercise_by_id(bundle.manifest, exercise_id)
    if exercise is None:
        raise KeyError(exercise_id)

    correct = grade(exercise, response)
    db.add(
        ExerciseAttempt(
            user_id=user.id,
            bundle_id=bundle.manifest.id,
            bundle_version=bundle.manifest.version,
            exercise_id=exercise_id,
            response_json=response,
            correct=correct,
            created_at=_now_utc(),
        )
    )
    db.flush()  # the attempt must be visible to the completeness check below

    completed = False
    stars_awarded = 0
    already = (
        db.query(ExerciseCompletion)
        .filter(
            ExerciseCompletion.user_id == user.id,
            ExerciseCompletion.bundle_id == bundle.manifest.id,
            ExerciseCompletion.bundle_version == bundle.manifest.version,
        )
        .first()
    )
    if already is None and _is_complete(db, user.id, bundle):
        stars_awarded = _award_completion(db, user, bundle)
        completed = True

    db.commit()
    logger.info(
        "exercise answer: user=%s bundle=%s/%s ex=%s correct=%s completed=%s stars=%s",
        user.id, bundle.manifest.id, bundle.manifest.version, exercise_id, correct, completed, stars_awarded,
    )
    return SubmissionResult(
        correct=correct,
        completed=completed,
        stars_awarded=stars_awarded,
        current_stars=user.current_stars,
    )


def _award_completion(db: Session, user: User, bundle: DiscoveredBundle) -> int:
    """Write the completion + ledger rows and credit the kid. Returns stars awarded."""
    attempts = (
        db.query(ExerciseAttempt)
        .filter(
            ExerciseAttempt.user_id == user.id,
            ExerciseAttempt.bundle_id == bundle.manifest.id,
            ExerciseAttempt.bundle_version == bundle.manifest.version,
        )
        .all()
    )
    stars = compute_bundle_stars(bundle.manifest, attempts)

    ledger: HistoryLedger | None = None
    if stars > 0:
        user.current_stars = user.current_stars + stars  # type: ignore[assignment]
        ledger = HistoryLedger(
            user_id=user.id,
            action_type="exercise_complete",
            points_delta=stars,
            ref_table="exercise_completions",
            ref_id=None,  # set after the completion row gets its id
            timestamp=_now_utc(),
        )
        db.add(ledger)
        db.flush()

    completion = ExerciseCompletion(
        user_id=user.id,
        bundle_id=bundle.manifest.id,
        bundle_version=bundle.manifest.version,
        stars_awarded=stars,
        history_ledger_id=ledger.id if ledger else None,
        created_at=_now_utc(),
    )
    db.add(completion)
    db.flush()
    if ledger is not None:
        ledger.ref_id = completion.id
    return stars
