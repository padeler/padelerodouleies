#!/usr/bin/env bash
# Download the Piper voice models for local TTS development.
#
# The production image bakes these in during `docker build`; this script is the
# dev-machine equivalent, dropping them into backend/voices/ where tts.py looks
# by default (no env vars needed). Idempotent: skips files already present.
#
# Audio playback in dev also needs the binaries:
#   .venv/bin/pip install piper-tts   &&   sudo apt install ffmpeg
set -euo pipefail

VOICES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/voices"
BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main"

# Relative paths under $BASE for each model (the .onnx.json sidecar is fetched too).
VOICES=(
  "el/el_GR/joy/medium/el_GR-joy-medium.onnx"
  "en/en_US/amy/low/en_US-amy-low.onnx"
)

mkdir -p "$VOICES_DIR"
for rel in "${VOICES[@]}"; do
  for suffix in "" ".json"; do
    name="$(basename "$rel")$suffix"
    dest="$VOICES_DIR/$name"
    if [[ -f "$dest" ]]; then
      echo "skip   $name (already present)"
    else
      echo "fetch  $name"
      curl -fsSL -o "$dest" "$BASE/$rel$suffix"
    fi
  done
done

# Patch the Greek model to expose phoneme/audio alignments, so the TTS service
# can carrier-wrap lone letters/digits (e.g. "Α", "14") and trim the prefix back
# off — they garble when synthesized alone (see app/services/piper_synth.py).
# Needs the `onnx` package (pip install onnx); skips cleanly if it is missing or
# the model is already patched. The English voice does not need this.
EL="$VOICES_DIR/el_GR-joy-medium.onnx"
if python -c "import onnx" >/dev/null 2>&1; then
  if python -m piper.patch_voice_with_alignment "$EL" >/dev/null 2>&1; then
    echo "patch  el_GR-joy-medium.onnx (alignment output added)"
  else
    echo "skip   patch (already patched, or piper/onnx unavailable)"
  fi
else
  echo "NOTE   install onnx to patch the Greek voice for lone-letter/number TTS:"
  echo "         pip install onnx && python -m piper.patch_voice_with_alignment '$EL'"
fi

echo "Voices ready in $VOICES_DIR"
