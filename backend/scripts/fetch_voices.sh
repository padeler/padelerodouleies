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
  "el/el_GR/rapunzelina/low/el_GR-rapunzelina-low.onnx"
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

echo "Voices ready in $VOICES_DIR"
