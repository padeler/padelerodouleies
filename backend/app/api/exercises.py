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
from app.services.exercise_bundles import ASSETS_DIRNAME, DiscoveredBundle
from app.services.exercises import (
    ResponseError,
    completed_bundle_keys,
    submit_answer,
    visible_bundles,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/exercises", tags=["exercises"])


def _get_visible_bundle(bundle_id: str, user: User) -> DiscoveredBundle:
    """Return the bundle only if it exists and is age-appropriate for the user; 404 otherwise."""
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


@router.post("/bundles/{bundle_id}/answers")
async def post_answer(
    bundle_id: str,
    payload: AnswerSubmission,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> dict[str, Any]:
    """Grade one answer; award stars + broadcast on first bundle completion."""
    bundle = _get_visible_bundle(bundle_id, current_user)
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
