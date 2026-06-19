"""Kid-facing exercises API: bundle listing, manifest, assets, TTS, answers.

Discovery is scan-on-request (no scheduler — invariant #2). Grading is
server-side; the manifest's answers and TTS-text overrides never leave the
server (``kid_view`` strips them). Asset and TTS serving are auth-gated and
traversal-guarded, mirroring avatar/card-TTS serving.
"""

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.engine import get_session
from app.db.models import User
from app.realtime import broadcaster
from app.schemas.exercises import kid_view
from app.security.session import get_current_user
from app.services import tts
from app.services.exercise_bundles import ASSETS_DIRNAME, DiscoveredBundle, get_bundle
from app.services.exercises import (
    ResponseError,
    completed_bundle_keys,
    grade,
    submit_answer,
    visible_bundles,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


def _get_visible_bundle(bundle_id: str, user: User) -> DiscoveredBundle:
    """Return the bundle only if the user may see it; 404 otherwise.

    Kids are age-gated (birthdate-derived). Admins are the content managers, so
    they may preview *any* valid bundle for verification (not age-gated) — this
    powers the admin "play" button on the Exercises tab.
    """
    if user.role == "admin":
        bundle = get_bundle(bundle_id)
        if bundle is None:
            raise HTTPException(404, f"Bundle not found: {bundle_id}")
        return bundle
    visible = {b.manifest.id: b for b in visible_bundles(user)}
    bundle = visible.get(bundle_id)
    if bundle is None:
        raise HTTPException(404, f"Bundle not found: {bundle_id}")
    return bundle


class AnswerSubmission(BaseModel):
    exercise_id: str
    response: Any  # graded server-side per exercise type


@router.get("/bundles")
def list_bundles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> list[dict[str, Any]]:
    """Bundles the current kid may see (age-filtered) with completion status.

    The frontend derives subject-group cards from this list, so empty groups
    disappear for free.
    """
    completed = completed_bundle_keys(db, current_user.id)
    result: list[dict[str, Any]] = []
    for b in visible_bundles(current_user):
        m = b.manifest
        result.append({
            "id": m.id,
            "version": m.version,
            "title": m.title,
            "subject": m.subject,
            "age_min": m.age_min,
            "age_max": m.age_max,
            "stars": m.stars,
            "difficulty": m.difficulty,
            "exercise_count": len(m.exercises),
            "completed": (m.id, m.version) in completed,
        })
    return result


@router.get("/bundles/{bundle_id}")
def get_bundle_manifest(
    bundle_id: str,
    current_user: User = Depends(get_current_user),
) -> dict[str, Any]:
    """The kid-view manifest (no answers, no TTS text) for one bundle."""
    bundle = _get_visible_bundle(bundle_id, current_user)
    return kid_view(bundle.manifest)


@router.get("/assets/{bundle_id}/{path:path}")
def get_asset(
    bundle_id: str,
    path: str,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Serve a bundle image asset, guarded against path traversal."""
    bundle = _get_visible_bundle(bundle_id, current_user)
    assets_dir = (bundle.dir / ASSETS_DIRNAME).resolve()
    target = (assets_dir / path).resolve()
    if assets_dir not in target.parents or not target.is_file():
        raise HTTPException(404, "Asset not found")
    return FileResponse(target, headers={"Cache-Control": "private, max-age=3600"})


@router.get("/tts/{bundle_id}/title.mp3")
def get_bundle_title_tts(
    bundle_id: str,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Spoken bundle title (for the bundle-list speaker button)."""
    bundle = _get_visible_bundle(bundle_id, current_user)
    try:
        path = tts.get_or_synthesize(bundle.manifest.title)
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for bundle title %s: %s", bundle_id, exc)
        raise HTTPException(503, "TTS unavailable") from exc

    return FileResponse(
        path, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"}
    )


@router.get("/tts/{bundle_id}/{exercise_id}/{kind}.mp3")
def get_exercise_tts(
    bundle_id: str,
    exercise_id: str,
    kind: str,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Spoken prompt or hint for one exercise, synthesized + cached server-side."""
    if kind not in ("prompt", "hint"):
        raise HTTPException(404, f"Unknown TTS kind: {kind}")
    bundle = _get_visible_bundle(bundle_id, current_user)
    exercise = next((e for e in bundle.manifest.exercises if e.id == exercise_id), None)
    if exercise is None:
        raise HTTPException(404, f"Exercise not found: {exercise_id}")

    # Prefer the spoken-text override (respelled/re-accented), else the display text.
    text: str | None
    if kind == "prompt":
        text = exercise.prompt_tts or exercise.prompt
    else:
        text = exercise.hint_tts or exercise.hint
    if not text:
        raise HTTPException(404, f"Exercise {exercise_id} has no {kind} text")

    try:
        path = tts.get_or_synthesize(text)
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for %s/%s/%s: %s", bundle_id, exercise_id, kind, exc)
        raise HTTPException(503, "TTS unavailable") from exc

    return FileResponse(
        path, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"}
    )


def _iter_exercise_options(exercise: Any) -> list[Any]:
    """Every selectable/orderable option across an exercise's type-specific shape.

    Covers ``multiple_choice`` options, ``ordering`` items and both sides of
    ``match_pairs`` pairs — so per-item TTS works for any type that has text
    labels, not just multiple choice.
    """
    options = getattr(exercise, "options", None) or []
    items = getattr(exercise, "items", None) or []
    pairs = getattr(exercise, "pairs", None) or []
    pair_sides = [side for p in pairs for side in (p.left, p.right)]
    return [*options, *items, *pair_sides]


@router.get("/tts/{bundle_id}/{exercise_id}/option/{option_id}.mp3")
def get_option_tts(
    bundle_id: str,
    exercise_id: str,
    option_id: str,
    current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Spoken text for one option/item (multiple-choice, ordering, match-pairs)."""
    bundle = _get_visible_bundle(bundle_id, current_user)
    exercise = next((e for e in bundle.manifest.exercises if e.id == exercise_id), None)
    if exercise is None:
        raise HTTPException(404, f"Exercise not found: {exercise_id}")

    option = next((o for o in _iter_exercise_options(exercise) if o.id == option_id), None)
    if option is None or not option.text:
        raise HTTPException(404, f"Option {option_id} not found or has no text")

    try:
        path = tts.get_or_synthesize(option.text)
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for option %s/%s/%s: %s", bundle_id, exercise_id, option_id, exc)
        raise HTTPException(503, "TTS unavailable") from exc

    return FileResponse(
        path, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"}
    )


@router.post("/bundles/{bundle_id}/answers")
async def post_answer(
    bundle_id: str,
    payload: AnswerSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> dict[str, Any]:
    """Grade one answer; award stars + broadcast on first bundle completion."""
    bundle = _get_visible_bundle(bundle_id, current_user)

    # Admin preview: grade only — never record an attempt or award stars. The
    # response mirrors the kid shape so the shared player works unchanged.
    if current_user.role == "admin":
        exercise = next(
            (e for e in bundle.manifest.exercises if e.id == payload.exercise_id), None
        )
        if exercise is None:
            raise HTTPException(404, f"Exercise not found: {payload.exercise_id}")
        try:
            correct = grade(exercise, payload.response)
        except ResponseError as exc:
            raise HTTPException(400, str(exc)) from exc
        return {
            "correct": correct,
            "completed": False,
            "stars_awarded": 0,
            "current_stars": current_user.current_stars,
        }

    try:
        result = submit_answer(db, current_user, bundle, payload.exercise_id, payload.response)
    except KeyError as exc:
        raise HTTPException(404, f"Exercise not found: {payload.exercise_id}") from exc
    except ResponseError as exc:
        raise HTTPException(400, str(exc)) from exc

    if result.completed:
        await broadcaster.emit(
            "stars_changed",
            {"user_id": current_user.id, "current_stars": result.current_stars},
            "all",
        )

    return {
        "correct": result.correct,
        "completed": result.completed,
        "stars_awarded": result.stars_awarded,
        "current_stars": result.current_stars,
    }
