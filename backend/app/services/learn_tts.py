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

from app.services import learn_decks, learn_vocab, tts

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


def iter_card_texts() -> list[str]:
    """The spoken mini-game card sentences (title + description, one per level)."""
    seen: dict[str, None] = {}
    for level in learn_decks.LEVEL_INTROS:
        text = learn_decks.card_tts(level).strip()
        if text:
            seen.setdefault(text, None)
    return list(seen)


def iter_find_texts() -> list[str]:
    """The spoken "find X" prompts (one per deck token, both tracks, deduped).

    Finite (numbers 1..100 + 24 letters), so warming them keeps the falling-
    targets prompt instant. The mistake-explanation phrases are combinatorial
    (picked × correct) and are deliberately *not* warmed — they synthesize on
    demand during the button-gated feedback pause.
    """
    seen: dict[str, None] = {}
    for track in learn_decks.TRACKS:
        for item in learn_decks.build_deck(track).items:
            seen.setdefault(learn_decks.find_tts(track, item.token), None)
    return list(seen)


def iter_find_all_texts() -> list[str]:
    """The spoken "find them all" prompts (one per deck token, both tracks).

    Finite, same rationale as `iter_find_texts` — kept instant for the
    falling-targets multi-target variant.
    """
    seen: dict[str, None] = {}
    for track in learn_decks.TRACKS:
        for item in learn_decks.build_deck(track).items:
            seen.setdefault(learn_decks.find_all_tts(track, item.token), None)
    return list(seen)


def iter_find_starts_with_texts() -> list[str]:
    """The spoken starts-with prompts (one per letter token, deduped).

    Finite (24 letters), same rationale as `iter_find_texts` — kept instant for
    the falling-targets starts-with variant.
    """
    seen: dict[str, None] = {}
    for item in learn_decks.build_deck("letters").items:
        seen.setdefault(learn_decks.find_starts_with_tts(item.token), None)
    return list(seen)


def iter_word_texts() -> list[str]:
    """Every spoken vocabulary word behind a letter icon tile (deduped).

    Sourced from the full per-letter pool (``LETTER_VOCAB_WORDS``, ≈10 words per
    letter) so the matching game's first tap on any random picture is instant —
    a superset of the canonical ``LETTER_WORDS`` the ``/word/{token}`` endpoint
    serves, so those are warmed too.
    """
    seen: dict[str, None] = {}
    for word in learn_vocab.LETTER_VOCAB_WORDS.values():
        text = word.strip()
        if text:
            seen.setdefault(text, None)
    return list(seen)


def iter_all_texts() -> list[str]:
    """Every spoken string the games warm: deck words + intros + find prompts +
    vocabulary words + praise."""
    seen: dict[str, None] = {}
    for text in (
        *iter_deck_tts_texts(),
        *iter_intro_texts(),
        *iter_card_texts(),
        *iter_find_texts(),
        *iter_find_all_texts(),
        *iter_find_starts_with_texts(),
        *iter_word_texts(),
        learn_decks.SUCCESS_PHRASE,
    ):
        text = text.strip()
        if text:
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
