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
from app.services import learn_decks, learn_vocab, tts
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


@router.get("/feedback/success.mp3")
def get_success_tts(
    _current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Spoken praise played on a correct answer (track-agnostic, fixed phrase)."""
    try:
        path = tts.get_or_synthesize(learn_decks.SUCCESS_PHRASE)
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for learn success phrase: %s", exc)
        raise HTTPException(503, "TTS unavailable") from exc
    return FileResponse(
        path, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"}
    )


def _require_token(track: Track, token: str) -> str:
    """404 if ``token`` is not a real deck token for ``track`` (no traversal surface)."""
    if not any(it.token == token for it in build_deck(track).items):
        raise HTTPException(404, f"Unknown token: {token}")
    return token


@router.get("/{track}/find/{token}.mp3")
def get_find_tts(
    track: str,
    token: str,
    _current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Spoken "find this one" prompt for the falling-targets level."""
    valid_track = _validate_track(track)
    _require_token(valid_track, token)
    try:
        path = tts.get_or_synthesize(learn_decks.find_tts(valid_track, token))
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for learn find %s/%s: %s", valid_track, token, exc)
        raise HTTPException(503, "TTS unavailable") from exc
    return FileResponse(
        path, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"}
    )


@router.get("/{track}/find-all/{token}.mp3")
def get_find_all_tts(
    track: str,
    token: str,
    _current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Spoken "find them all" prompt for the multi-target falling variant.

    The plain find prompt implied a single target; this one cues the kid that
    several fallers share the answer.
    """
    valid_track = _validate_track(track)
    _require_token(valid_track, token)
    try:
        path = tts.get_or_synthesize(learn_decks.find_all_tts(valid_track, token))
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for learn find-all %s/%s: %s", valid_track, token, exc)
        raise HTTPException(503, "TTS unavailable") from exc
    return FileResponse(
        path, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"}
    )


@router.get("/letters/find-starts-with/{token}.mp3")
def get_find_starts_with_tts(
    token: str,
    _current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Spoken "find an object that starts with this letter" prompt.

    Used by the starts-with falling-targets variant, which asks the kid to tap
    an object icon rather than the letter itself.
    """
    _require_token("letters", token)
    try:
        path = tts.get_or_synthesize(learn_decks.find_starts_with_tts(token))
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for learn find-starts-with %s: %s", token, exc)
        raise HTTPException(503, "TTS unavailable") from exc
    return FileResponse(
        path, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"}
    )


@router.get("/letters/word/{token}.mp3")
def get_word_tts(
    token: str,
    _current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Spoken vocabulary word behind a letter's icon tile ("γάτα" for the cat).

    The token is resolved against the in-code word table — never a filesystem
    path — so there is no traversal surface; an unknown token is a plain 404.
    """
    if token not in learn_decks.LETTER_WORDS:
        raise HTTPException(404, f"Unknown token: {token}")
    try:
        path = tts.get_or_synthesize(learn_decks.word_tts(token))
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for learn word %s: %s", token, exc)
        raise HTTPException(503, "TTS unavailable") from exc
    return FileResponse(
        path, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"}
    )


@router.get("/letters/vocab/{entry_id}.mp3")
def get_vocab_tts(
    entry_id: str,
    _current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Spoken vocabulary word for a specific pool entry, keyed by its stable id.

    The letter-matching game shows a *random* picture per letter each round (for
    variety), so the tapped word varies — this resolves the exact entry's word
    from the in-code pool table (never a filesystem path; unknown id → 404).
    """
    word = learn_vocab.LETTER_VOCAB_WORDS.get(entry_id)
    if word is None:
        raise HTTPException(404, f"Unknown vocab id: {entry_id}")
    try:
        path = tts.get_or_synthesize(word)
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for vocab %s: %s", entry_id, exc)
        raise HTTPException(503, "TTS unavailable") from exc
    return FileResponse(
        path, media_type="audio/mpeg", headers={"Cache-Control": "private, max-age=3600"}
    )


# Sentinel for "the kid made no pick" (ran out of time) in the wrong-answer route.
_NO_PICK = "_none"


@router.get("/{track}/wrong/{correct}/{picked}.mp3")
def get_wrong_tts(
    track: str,
    correct: str,
    picked: str,
    _current_user: User = Depends(get_current_user),
) -> FileResponse:
    """Spoken explanation of a mistake (the picked vs. the correct answer).

    ``picked`` may be the ``_none`` sentinel when the kid ran out of time. Both
    tokens are resolved against the in-code deck, so there is no traversal
    surface; the explanation synthesizes on demand (it is combinatorial, so it is
    not pre-warmed) into the shared cache.
    """
    valid_track = _validate_track(track)
    _require_token(valid_track, correct)
    picked_token = None if picked == _NO_PICK else _require_token(valid_track, picked)
    try:
        path = tts.get_or_synthesize(learn_decks.wrong_tts(valid_track, correct, picked_token))
    except tts.TTSUnavailableError as exc:
        logger.warning("TTS unavailable for learn wrong %s: %s", valid_track, exc)
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
