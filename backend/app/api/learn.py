"""Learning Adventure API: deck listing + spoken-word audio.

Serves the two teaching-game decks (``numbers`` / ``letters``) to the frontend.
The kid-facing deck strips ``DeckItem.tts`` — that word is Piper input, not
display text — and hands back a per-item ``audio_url`` instead. Audio is served
from the same content-addressed cache the startup warmer fills
(``learn_tts.warm_all``), so a hit is the normal path; a miss synthesizes on the
fly. Best scores reuse the existing ``/api/games/scores`` endpoints (the two
track keys live in ``GAME_SCORE_DIRECTIONS``).
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.db.models import User
from app.security.session import get_current_user
from app.services import learn_decks, tts
from app.services.learn_decks import Tier, Track, build_deck

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/games/learn", tags=["learn"])


class KidDeckItem(BaseModel):
    """A deck item as the client sees it — no ``tts`` (Piper input stays server-side)."""

    token: str
    glyph: str
    glyph_alt: str | None
    audio_url: str


class DeckResponse(BaseModel):
    track: Track
    items: list[KidDeckItem]
    tiers: list[Tier]


def _validate_track(track: str) -> Track:
    """Narrow a path string to a known track or 404 — no silent default."""
    if track not in learn_decks.TRACKS:
        raise HTTPException(404, f"Unknown track: {track}")
    return track


@router.get("/say/{level}.mp3")
def get_level_intro_tts(
    level: str,
    _current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Spoken intro sentence for a level type (played before the round starts).

    The level is resolved against the in-code intro table — never a filesystem
    path — so there is no traversal surface; an unknown level is a plain 404.
    Served from the same warmed cache as the deck words.
    """
    if level not in learn_decks.LEVEL_INTROS:
        raise HTTPException(404, f"Unknown level: {level}")

    try:
        path = tts.get_or_synthesize(learn_decks.intro_text(level))
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for learn intro %s: %s", level, exc)
        raise HTTPException(503, "TTS unavailable") from exc

    return FileResponse(
        path, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"}
    )


@router.get("/{track}")
def get_deck(
    track: str,
    _current_user: User = Depends(get_current_user),
) -> DeckResponse:
    """The full kid-facing deck for a track: items (with audio URLs) + tiers."""
    valid_track = _validate_track(track)
    deck = build_deck(valid_track)
    items = [
        KidDeckItem(
            token=it.token,
            glyph=it.glyph,
            glyph_alt=it.glyph_alt,
            audio_url=f"{router.prefix}/{valid_track}/tts/{it.token}.mp3",
        )
        for it in deck.items
    ]
    return DeckResponse(track=valid_track, items=items, tiers=deck.tiers)


@router.get("/{track}/tts/{token}.mp3")
def get_token_tts(
    track: str,
    token: str,
    _current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Spoken word (letter name / number word) for one deck token.

    The token is resolved against the in-code deck — never a filesystem path —
    so there is no traversal surface; an unknown token is a plain 404.
    """
    valid_track = _validate_track(track)
    item = next((it for it in build_deck(valid_track).items if it.token == token), None)
    if item is None:
        raise HTTPException(404, f"Unknown token: {token}")

    try:
        path = tts.get_or_synthesize(item.tts)
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for learn token %s/%s: %s", valid_track, token, exc)
        raise HTTPException(503, "TTS unavailable") from exc

    return FileResponse(
        path, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"}
    )
