"""Text-to-speech synthesis with an on-disk, content-addressed cache.

Audio is produced lazily on first request and cached as mono MP3 files keyed by
``voice + text`` hash, mirroring how avatars/chore-images are stored under the
data volume. The synthesizer shells out to Piper (CPU-only neural TTS) and pipes
its WAV through ffmpeg to MP3; both are subprocess-per-call, so idle RAM stays
near zero on the 2GB NAS and a spike only occurs on the rare cache miss.

Language is picked from the script of the text itself (the content is
single-language like chores/rewards — invariant #5): any Greek codepoint selects
the Greek voice, otherwise the English voice is used.

Synthesis fails explicitly (``TTSUnavailableError``) when the Piper binary,
ffmpeg, or a voice model is missing — never a silent empty file. ``_synthesize``
is the single seam tests patch so the suite needs no binaries installed.
"""

import hashlib
import logging
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

# Backend root, so the carrier-trim subprocess can import the ``app`` package
# regardless of the server's working directory.
_BACKEND_ROOT = Path(__file__).parents[2]

# data/tts under the backend root by default; overridable for the container.
TTS_DIR = Path(os.getenv("TTS_DIR", str(Path(__file__).parents[2] / "data" / "tts")))

PIPER_BIN = os.getenv("PIPER_BIN", "piper")
# Voice models (.onnx, with a sibling .onnx.json). The image bakes them under
# /app/voices and overrides these via env; the dev default is backend/voices,
# populated by scripts/fetch_voices.sh.
_VOICES_DIR = Path(__file__).parents[2] / "voices"
VOICE_EL = Path(os.getenv("TTS_VOICE_EL", str(_VOICES_DIR / "el_GR-joy-medium.onnx")))
VOICE_EN = Path(os.getenv("TTS_VOICE_EN", str(_VOICES_DIR / "en_US-amy-low.onnx")))

# The Greek and extended-Greek Unicode blocks. One match is enough to read the
# text with the Greek voice; the project default locale is Greek anyway.
_GREEK_RE = re.compile(r"[Ͱ-Ͽἀ-῿]")
# ASCII letters signal English script; digits/symbols have no script affiliation.
_LATIN_RE = re.compile(r"[a-zA-Z]")

# A bare integer or decimal (Greek uses a comma for the decimal point).
_NUMBER_RE = re.compile(r"\d+(?:[.,]\d+)?")
# Number of espeak words in the Greek carrier prefixes below ("Το γράμμα",
# "Η λέξη:", "Ο αριθμός"), trimmed away after synthesis to leave only the target.
_CARRIER_PREFIX_WORDS = 2


class TTSUnavailableError(RuntimeError):
    """Raised when synthesis cannot run (missing binary or voice model)."""


def detect_language(text: str) -> str:
    """Return ``'el'`` for Greek text or purely non-Latin text (e.g. digits), ``'en'`` for Latin.

    Greek is the app default locale (invariant #5), so numbers and symbols that
    carry no script affiliation are read with the Greek voice.
    """
    if _GREEK_RE.search(text):
        return "el"
    if _LATIN_RE.search(text):
        return "en"
    return "el"


def voice_for_language(lang: str) -> Path:
    """Return the voice model path for a detected language."""
    return VOICE_EL if lang == "el" else VOICE_EN


def carrier_phrase(text: str) -> str | None:
    """Wrap a lone Greek letter / word / number in a carrier sentence, else None.

    The Greek medium voice garbles a single token synthesized in isolation — a
    letter (``"Α"``), a word (``"σπίτι"``) or a number (``"14"``) — but reads it
    cleanly inside a sentence. We wrap it so the model has context, then
    ``_synthesize`` trims the carrier prefix back off via the voice's phoneme
    alignments. Every carrier prefix is exactly ``_CARRIER_PREFIX_WORDS`` espeak
    words. The English voice does not have this problem, so only Greek text is
    wrapped — numbers carry no script and default to Greek (invariant #5).

    A single word keeps any punctuation it carries (``"Μπράβο!"`` →
    ``"Η λέξη: Μπράβο!"``) — the trailing prefix is what gets trimmed, so the
    exclamation/question prosody on the target word survives. Only multi-word
    phrases (which already read cleanly) are left unwrapped.
    """
    if detect_language(text) != "el":
        return None
    if _NUMBER_RE.fullmatch(text):
        return f"Ο αριθμός {text}"
    # A lone letter or single word: one whitespace-free token with at least one
    # Greek letter — even when punctuation ("!", ";") defeats ``str.isalpha()``.
    # A multi-word phrase has internal whitespace and is left alone. Count actual
    # letters (not string length) to tell a lone letter from a word with a mark.
    if not any(ch.isspace() for ch in text) and _GREEK_RE.search(text):
        letters = sum(1 for ch in text if ch.isalpha())
        return f"Το γράμμα {text}" if letters == 1 else f"Η λέξη: {text}"
    return None


def cache_path_for(text: str, voice: Path) -> Path:
    """Content-addressed cache path: hash of voice name + text → ``<hash>.mp3``."""
    digest = hashlib.sha256(f"{voice.name}\n{text}".encode("utf-8")).hexdigest()
    return TTS_DIR / f"{digest[:32]}.mp3"


def get_or_synthesize(text: str) -> Path:
    """Return a cached MP3 for ``text``, synthesizing it on a cache miss.

    Raises ``ValueError`` for empty text and ``TTSUnavailableError`` when the
    synthesis toolchain is unavailable.
    """
    text = text.strip()
    if not text:
        raise ValueError("Cannot synthesize empty text")

    lang = detect_language(text)
    voice = voice_for_language(lang)
    out_path = cache_path_for(text, voice)
    if out_path.exists():
        logger.debug("TTS cache hit (%s): %s", lang, out_path.name)
        return out_path

    logger.info("TTS cache miss (%s), synthesizing %d chars", lang, len(text))
    _synthesize(text, voice, out_path)
    return out_path


def _synthesize(text: str, voice: Path, out_path: Path) -> None:
    """Run Piper → ffmpeg to produce ``out_path``. Atomic via a temp file.

    The single seam patched by tests; the real implementation requires the
    ``piper`` and ``ffmpeg`` binaries plus the voice model on disk.
    """
    piper = shutil.which(PIPER_BIN)
    ffmpeg = shutil.which("ffmpeg")
    if piper is None or ffmpeg is None or not voice.exists():
        raise TTSUnavailableError(
            f"TTS toolchain unavailable (piper={piper}, ffmpeg={ffmpeg}, "
            f"voice={voice} exists={voice.exists()})"
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    # The MP3 temp file must sit in the destination dir so os.replace stays on
    # one filesystem — in production the data dir is a RAID bind-mount, a
    # different device from /tmp, and a cross-device replace would fail.
    fd, tmp_mp3_name = tempfile.mkstemp(dir=out_path.parent, suffix=".mp3.tmp")
    os.close(fd)
    tmp_mp3 = Path(tmp_mp3_name)
    try:
        with tempfile.TemporaryDirectory() as tmp:
            wav = Path(tmp) / "out.wav"
            carrier = carrier_phrase(text)
            if carrier is None:
                # Ordinary text: the piper CLI loads the model and writes a WAV.
                subprocess.run(
                    [piper, "-m", str(voice), "-f", str(wav)],
                    input=text.encode("utf-8"),
                    check=True,
                    capture_output=True,
                )
            else:
                # Lone letter/number: synthesize the carrier sentence and trim
                # its prefix off using phoneme alignments (needs the Python API,
                # so this runs through our piper_synth module — still one short-
                # lived subprocess, so idle RAM stays near zero).
                logger.info("TTS carrier-wrapping lone token %r → %r", text, carrier)
                subprocess.run(
                    [sys.executable, "-m", "app.services.piper_synth",
                     "--model", str(voice), "--out", str(wav),
                     "--drop-words", str(_CARRIER_PREFIX_WORDS)],
                    input=carrier.encode("utf-8"),
                    check=True,
                    capture_output=True,
                    cwd=str(_BACKEND_ROOT),
                )
            subprocess.run(
                # -f mp3 is explicit because the temp path has a .tmp suffix
                # ffmpeg cannot infer the container format from.
                [ffmpeg, "-y", "-i", str(wav), "-ac", "1",
                 "-codec:a", "libmp3lame", "-qscale:a", "5", "-f", "mp3", str(tmp_mp3)],
                check=True,
                capture_output=True,
            )
        # Atomic publish so a concurrent reader never sees a partial file.
        os.replace(tmp_mp3, out_path)
    except subprocess.CalledProcessError as exc:
        tmp_mp3.unlink(missing_ok=True)
        stderr = exc.stderr.decode("utf-8", "replace") if exc.stderr else ""
        logger.error("TTS synthesis failed: %s", stderr)
        raise TTSUnavailableError(f"TTS synthesis failed: {stderr}") from exc
    except BaseException:
        tmp_mp3.unlink(missing_ok=True)
        raise
