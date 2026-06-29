"""Pre-record (warm) the TTS cache for the Learning Adventure decks.

The teaching games speak a letter name or number word on every tap, so the
audio must be ready *before* a round starts — a mid-game Piper delay would break
the flow for a 4-year-old. Both decks are a small, fixed set of spoken words
(``learn_decks.build_deck``), so this pass synthesizes all of them into the same
content-addressed cache the on-tap speaker uses (``tts.get_or_synthesize``).

Like the exercise warmer this is a one-shot pass, not a scheduler: the decks are
static in code, so the app fires it once in a daemon thread at startup. Synthesis
is content-addressed and idempotent, so a re-run only fills genuine cache misses.
"""

from __future__ import annotations

import logging
import threading

from app.services import learn_decks, tts

logger = logging.getLogger(__name__)


def iter_deck_tts_texts() -> list[str]:
    """De-duplicated list of every spoken word across both decks.

    Each ``DeckItem.tts`` is the Piper input word (never the bare glyph); both
    letter cases share one spoken name, so this is naturally small.
    """
    seen: dict[str, None] = {}
    for track in learn_decks.TRACKS:
        for item in learn_decks.build_deck(track).items:
            word = item.tts.strip()
            if word:
                seen.setdefault(word, None)
    return list(seen)


def iter_intro_texts() -> list[str]:
    """The spoken level-intro sentences (one per level type, deduped)."""
    seen: dict[str, None] = {}
    for sentence in learn_decks.LEVEL_INTROS.values():
        text = sentence.strip()
        if text:
            seen.setdefault(text, None)
    return list(seen)


def iter_all_texts() -> list[str]:
    """Every spoken string the games need warmed: deck words + level intros."""
    seen: dict[str, None] = {}
    for text in (*iter_deck_tts_texts(), *iter_intro_texts()):
        seen.setdefault(text, None)
    return list(seen)


def warm_all() -> dict[str, int]:
    """Synthesize (and cache) every deck word. Idempotent via the TTS cache.

    Returns ``{synthesized, total}``. Stops early and logs once if the TTS
    toolchain is unavailable — no point retrying every word when Piper/ffmpeg/a
    voice model is missing (fail-explicit, no silent fallback).
    """
    texts = iter_all_texts()
    logger.info("warming learn TTS cache: %d unique strings (deck words + intros)", len(texts))
    synthesized = 0
    for text in texts:
        try:
            path = tts.get_or_synthesize(text)
        except tts.TTSUnavailableError as exc:
            logger.warning("learn-deck TTS warm aborted — toolchain unavailable: %s", exc)
            break
        except Exception:  # noqa: BLE001 — one bad word must not abort the pass
            logger.exception("learn-deck TTS warm failed for a word; skipping")
            continue
        if path.stat().st_size > 0:
            synthesized += 1
    logger.info("learn-deck TTS warm done: %d/%d words cached", synthesized, len(texts))
    return {"synthesized": synthesized, "total": len(texts)}


def warm_all_in_background() -> None:
    """Run ``warm_all`` in a daemon thread so it never blocks startup/requests.

    Piper/ffmpeg are blocking subprocesses; a thread keeps them off the event
    loop and out of the boot path. Failures are swallowed here (already logged
    inside ``warm_all``) so a warm pass can never crash the caller.
    """

    def _run() -> None:
        try:
            warm_all()
        except Exception:  # noqa: BLE001 — defensive: never let the thread escape
            logger.exception("learn-deck TTS background warm crashed")

    threading.Thread(target=_run, name="learn-tts-warm", daemon=True).start()
    logger.info("learn-deck TTS warm scheduled in background thread")


if __name__ == "__main__":  # pragma: no cover - manual ops entry point
    logging.basicConfig(level=logging.INFO)
    result = warm_all()
    print(f"Warmed {result['synthesized']}/{result['total']} learn-deck TTS words")
