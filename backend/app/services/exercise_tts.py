"""Pre-record (warm) the TTS cache for every discovered exercise bundle.

The on-tap exercise speaker buttons synthesize audio lazily on first request and
cache it on disk by content hash (``tts.get_or_synthesize``). On the 2GB NAS the
first tap of a long prompt incurs a visible Piper delay. This module walks every
valid bundle and pre-synthesizes all of its spoken strings so the cache is warm
before any kid taps a speaker.

It is a one-shot pass, not a recurring scheduler (bundles are immutable; invariant
#2): the app fires it in a daemon thread at startup and again after an admin
rescan. Because synthesis is content-addressed and idempotent, re-running it only
fills genuine cache misses.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Iterator
from typing import Any

from app.schemas.exercises import BundleManifest
from app.services import exercise_bundles, tts

logger = logging.getLogger(__name__)


def _exercise_texts(exercise: Any) -> Iterator[str]:
    """Every spoken string for one exercise: prompt, hint, and option labels.

    The TTS override (``*_tts``) wins over the visible text, matching the
    endpoints in ``app/api/exercises.py``.
    """
    yield exercise.prompt_tts or exercise.prompt
    if exercise.hint is not None:
        yield exercise.hint_tts or exercise.hint
    options = getattr(exercise, "options", None) or []
    items = getattr(exercise, "items", None) or []
    pairs = getattr(exercise, "pairs", None) or []
    pair_sides = [side for pair in pairs for side in (pair.left, pair.right)]
    for option in (*options, *items, *pair_sides):
        if option.text:
            yield option.text


def manifest_texts(manifest: BundleManifest) -> Iterator[str]:
    """Every spoken string in a bundle: its title plus all exercise strings."""
    yield manifest.title
    for exercise in manifest.exercises:
        yield from _exercise_texts(exercise)


def iter_bundle_tts_texts() -> list[str]:
    """De-duplicated list of every spoken string across all valid bundles."""
    seen: dict[str, None] = {}
    for bundle in exercise_bundles.discover().valid:
        for text in manifest_texts(bundle.manifest):
            stripped = text.strip()
            if stripped:
                seen.setdefault(stripped, None)
    return list(seen)


def warm_all() -> dict[str, int]:
    """Synthesize (and cache) every bundle string. Idempotent via the TTS cache.

    Returns counts of ``{synthesized, total}``. Stops early and logs once if the
    TTS toolchain is unavailable — there is no point retrying every string when
    Piper/ffmpeg/a voice model is missing (fail-explicit, invariant: no silent
    fallback).
    """
    texts = iter_bundle_tts_texts()
    logger.info("warming exercise TTS cache: %d unique strings", len(texts))
    synthesized = 0
    for text in texts:
        try:
            path = tts.get_or_synthesize(text)
        except tts.TTSUnavailableError as exc:
            logger.warning("exercise TTS warm aborted — toolchain unavailable: %s", exc)
            break
        except Exception:  # noqa: BLE001 — one bad string must not abort the pass
            logger.exception("exercise TTS warm failed for a string; skipping")
            continue
        if path.stat().st_size > 0:
            synthesized += 1
    logger.info("exercise TTS warm done: %d/%d strings cached", synthesized, len(texts))
    return {"synthesized": synthesized, "total": len(texts)}


def warm_all_in_background() -> None:
    """Run ``warm_all`` in a daemon thread so it never blocks startup/requests.

    Piper/ffmpeg are blocking subprocesses; a thread keeps them off the event
    loop and out of the request/boot path. Failures are swallowed here (already
    logged inside ``warm_all``) so a warm pass can never crash the caller.
    """

    def _run() -> None:
        try:
            warm_all()
        except Exception:  # noqa: BLE001 — defensive: never let the thread escape
            logger.exception("exercise TTS background warm crashed")

    threading.Thread(target=_run, name="exercise-tts-warm", daemon=True).start()
    logger.info("exercise TTS warm scheduled in background thread")


if __name__ == "__main__":  # pragma: no cover - manual ops entry point
    logging.basicConfig(level=logging.INFO)
    result = warm_all()
    print(f"Warmed {result['synthesized']}/{result['total']} exercise TTS strings")
