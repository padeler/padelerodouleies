"""Text-to-speech audio endpoint for chore/reward cards.

A kid (or parent) taps the speaker button on a card; the frontend requests the
matching MP3 here. Audio is synthesized lazily and cached on disk (see
``app.services.tts``), then streamed back via ``FileResponse``. The endpoint is
auth-gated like the rest of the API and the text is built server-side from the
item's title/description so arbitrary text cannot be synthesized.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.db.engine import get_session
from app.db.models import Chore, Reward, User
from app.security.session import get_current_user
from app.services import tts

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/tts", tags=["tts"])


# Sentence-terminating punctuation Piper/espeak already treats as a clause end
# (incl. the Greek ano-teleia "·" and question mark ";").
_TERMINAL_PUNCT = ".!?;·"


def _as_sentence(text: str) -> str:
    """Normalize a fragment into a standalone sentence for clear TTS prosody.

    Capitalizes the first letter and appends a period when the fragment lacks
    terminal punctuation. A bare ". " before a *lowercase* word is not treated as
    a sentence boundary by the phonemizer, so the title and description would run
    together with no pause; capitalizing the next fragment makes Piper pause.
    """
    text = text.strip()
    if not text:
        return ""
    text = text[0].upper() + text[1:]
    if text[-1] not in _TERMINAL_PUNCT:
        text += "."
    return text


def _text_for(item: Chore | Reward) -> str:
    """Build the spoken text from an item's title and optional description.

    Each part is emitted as its own sentence so Piper inserts an audible pause
    between the title and the description (see ``_as_sentence``).
    """
    parts = [item.title]
    if item.description:
        parts.append(item.description)
    return " ".join(s for s in (_as_sentence(p) for p in parts) if s)


@router.get("/{kind}/{item_id}.mp3")
def get_tts_audio(
    kind: str,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> FileResponse:
    """Return the spoken-description MP3 for a chore or reward."""
    if kind == "chore":
        item: Chore | Reward | None = db.get(Chore, item_id)
    elif kind == "reward":
        item = db.get(Reward, item_id)
    else:
        raise HTTPException(status_code=404, detail=f"Unknown TTS kind: {kind}")

    if item is None:
        raise HTTPException(status_code=404, detail=f"{kind} {item_id} not found")

    text = _text_for(item)
    if not text:
        raise HTTPException(status_code=404, detail=f"{kind} {item_id} has no text")

    try:
        path = tts.get_or_synthesize(text)
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for %s %s: %s", kind, item_id, exc)
        raise HTTPException(status_code=503, detail="TTS unavailable") from exc

    return FileResponse(
        path,
        media_type="audio/mpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )
