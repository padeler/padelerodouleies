"""Subprocess-invoked Piper synthesis with optional carrier-word trimming.

Run as a module (``python -m app.services.piper_synth``) so the heavy
``onnxruntime`` + voice-model load happens in a short-lived process that exits
right after writing the WAV — idle RAM stays near zero on the 2GB NAS, matching
the original piper-CLI design ``tts.py`` uses for ordinary text.

Reads UTF-8 text from stdin and writes a 16-bit mono WAV to ``--out``.

With ``--drop-words N`` the input is a *carrier* sentence whose target word(s)
come last (e.g. ``"Ο αριθμός 14"``). Using the voice's phoneme/audio alignments
we drop the audio of the first ``N`` espeak words (the carrier prefix, always two
words: ``"Ο αριθμός"`` / ``"Το γράμμα"``) and keep everything after, so the
spoken result is just the target. This works around the Greek medium voice
garbling lone letters and digits — they synthesize cleanly *inside* a sentence.

Requires a voice model patched for alignment output (``Ceil`` tensor exposed; see
``scripts/fetch_voices.sh`` / the Dockerfile). If alignments are unavailable the
process exits non-zero so the caller fails explicitly rather than emitting the
whole carrier sentence.
"""

import argparse
import sys
import wave
from pathlib import Path
from typing import Iterable, Optional, Protocol


class _Alignment(Protocol):
    phoneme: str
    num_samples: int


def carrier_cut_sample(alignments: Iterable[_Alignment], drop_words: int) -> int:
    """Return the first audio sample of the target word(s) in a carrier phrase.

    espeak emits a literal space phoneme (``' '``) at every word boundary. The
    target begins right after the ``drop_words``-th space (the boundary closing
    the carrier prefix), so the returned offset is the cumulative sample count up
    to and including that space. Raises ``ValueError`` if the phrase has fewer
    word breaks than ``drop_words`` (a malformed carrier — fail explicitly).
    """
    cum = 0
    spaces = 0
    for a in alignments:
        cum += a.num_samples
        if a.phoneme == " ":
            spaces += 1
            if spaces == drop_words:
                return cum
    raise ValueError(f"carrier has {spaces} word break(s), need {drop_words}")


def synthesize_wav(model: Path, text: str, out: Path, drop_words: Optional[int]) -> None:
    """Synthesize ``text`` with the Piper voice at ``model`` into ``out`` (WAV).

    When ``drop_words`` is set, trim away the leading carrier prefix using the
    model's phoneme/audio alignments. Imports of Piper/onnxruntime are local so
    the module's pure helpers stay importable (and unit-testable) without them.
    """
    from piper import PiperVoice, SynthesisConfig

    voice = PiperVoice.load(str(model))
    chunks = list(
        voice.synthesize(text, SynthesisConfig(), include_alignments=drop_words is not None)
    )
    if not chunks:
        raise RuntimeError(f"Piper produced no audio for: {text!r}")

    sample_rate = chunks[0].sample_rate
    sample_width = chunks[0].sample_width
    channels = chunks[0].sample_channels
    frames = b"".join(chunk.audio_int16_bytes for chunk in chunks)

    if drop_words is not None:
        # The carrier is a single sentence → a single chunk with alignments.
        alignments = chunks[0].phoneme_alignments
        if len(chunks) != 1 or alignments is None:
            raise RuntimeError(
                "Voice model does not expose phoneme alignments; patch it with "
                "piper.patch_voice_with_alignment (see scripts/fetch_voices.sh)."
            )
        cut = carrier_cut_sample(alignments, drop_words)
        frames = frames[cut * sample_width * channels:]

    out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out), "wb") as wav_file:
        wav_file.setframerate(sample_rate)
        wav_file.setsampwidth(sample_width)
        wav_file.setnchannels(channels)
        wav_file.writeframes(frames)


def main(argv: Optional[list[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", type=Path, required=True, help="Piper .onnx voice model.")
    parser.add_argument("--out", type=Path, required=True, help="Output WAV path.")
    parser.add_argument(
        "--drop-words",
        type=int,
        default=None,
        help="Drop the first N espeak words (carrier prefix) from the output.",
    )
    args = parser.parse_args(argv)

    text = sys.stdin.buffer.read().decode("utf-8").strip()
    if not text:
        print("piper_synth: empty input text", file=sys.stderr)
        return 2

    synthesize_wav(args.model, text, args.out, args.drop_words)
    return 0


if __name__ == "__main__":
    sys.exit(main())
