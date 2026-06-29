"""Generate an MP3 from a string with Piper TTS — standalone CLI helper.

Wraps the same Piper → ffmpeg pipeline used by ``app.services.tts`` but writes to
an explicit output file (not the content-addressed cache) and lets you force the
language or point at an arbitrary voice model. Useful for previewing how the card
/ exercise TTS will sound for a given string.

Usage:
    cd backend && python -m scripts.say "Καλημέρα" -o hello.mp3
    cd backend && python -m scripts.say "Good morning" --lang en
    cd backend && python -m scripts.say "Hi" --model voices/en_US-amy-low.onnx

Requires the ``piper`` and ``ffmpeg`` binaries plus the voice model on disk (see
scripts/fetch_voices.sh). Fails explicitly if any are missing.
"""

import argparse
import logging
import sys
from pathlib import Path

from app.services.tts import (
    TTSUnavailableError,
    detect_language,
    voice_for_language,
    _synthesize,
)

logger = logging.getLogger("scripts.say")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Synthesize a string to MP3 via Piper.")
    parser.add_argument("text", help="The text to speak.")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=None,
        help="Output MP3 path (default: ./out.mp3).",
    )
    group = parser.add_mutually_exclusive_group()
    group.add_argument(
        "--lang",
        choices=("el", "en"),
        default=None,
        help="Force the voice language (default: auto-detect from the text script).",
    )
    group.add_argument(
        "--model",
        type=Path,
        default=None,
        help="Explicit Piper voice model (.onnx) path, overriding --lang.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    args = parse_args(argv)

    text = args.text.strip()
    if not text:
        logger.error("Refusing to synthesize empty text.")
        return 2

    if args.model is not None:
        voice = args.model
        lang = "explicit"
    else:
        lang = args.lang or detect_language(text)
        voice = voice_for_language(lang)

    out_path: Path = args.output or Path("out.mp3")

    logger.info("Synthesizing %d chars (lang=%s, voice=%s) → %s",
                len(text), lang, voice.name, out_path)
    try:
        _synthesize(text, voice, out_path)
    except TTSUnavailableError as exc:
        logger.error("%s", exc)
        return 1

    logger.info("Wrote %s (%d bytes)", out_path, out_path.stat().st_size)
    return 0


if __name__ == "__main__":
    sys.exit(main())
