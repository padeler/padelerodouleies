# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — Frontend build: compile the Vite + React SPA to static assets.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /build
# Build version shown on the login screen; CI passes the git tag / sha here.
ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — Backend build: install Python deps into a venv and bake the icons.
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS backend-build
ENV PIP_NO_CACHE_DIR=1 \
    PYTHONDONTWRITEBYTECODE=1
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app/backend
COPY backend/ /app/backend/
# Install the application and its runtime dependencies into the venv.
RUN pip install --upgrade pip && pip install /app/backend

# Piper (CPU neural TTS) for the card speaker buttons. Kept out of pyproject so
# local dev installs stay lean (tests patch the synthesizer); only the image
# carries onnxruntime. The `piper` CLI lands in the venv that is copied to runtime.
RUN pip install piper-tts

# Bake the icon SVGs into the image (no runtime CDN fetches on the LAN).
# fetch_icons.py is idempotent: it skips any SVG already present in the context.
COPY scripts/fetch_icons.py /app/scripts/fetch_icons.py
RUN python /app/scripts/fetch_icons.py

# ---------------------------------------------------------------------------
# Stage 3 — Runtime: venv + backend source + built SPA, single Uvicorn worker.
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS runtime
ENV TZ=Europe/Athens \
    PATH="/opt/venv/bin:$PATH" \
    DB_PATH=/app/data/padelerodouleies.db \
    STATIC_DIR=/app/static \
    PYTHONUNBUFFERED=1 \
    TTS_DIR=/app/data/tts \
    TTS_VOICE_EL=/app/voices/el_GR-rapunzelina-low.onnx \
    TTS_VOICE_EN=/app/voices/en_US-amy-low.onnx

# tzdata so TZ resolves to Athens local time; curl for the compose healthcheck;
# ffmpeg encodes Piper's WAV to MP3; libgomp1 is onnxruntime's OpenMP runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata curl ffmpeg libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime \
    && echo "$TZ" > /etc/timezone

# Piper voice models (Greek default + English), baked in so the LAN-only box
# never fetches at runtime. "low" quality (~60MB each) stays CPU-cheap.
RUN mkdir -p /app/voices \
    && BASE=https://huggingface.co/rhasspy/piper-voices/resolve/main \
    && curl -fsSL -o /app/voices/el_GR-rapunzelina-low.onnx      "$BASE/el/el_GR/rapunzelina/low/el_GR-rapunzelina-low.onnx" \
    && curl -fsSL -o /app/voices/el_GR-rapunzelina-low.onnx.json "$BASE/el/el_GR/rapunzelina/low/el_GR-rapunzelina-low.onnx.json" \
    && curl -fsSL -o /app/voices/en_US-amy-low.onnx      "$BASE/en/en_US/amy/low/en_US-amy-low.onnx" \
    && curl -fsSL -o /app/voices/en_US-amy-low.onnx.json "$BASE/en/en_US/amy/low/en_US-amy-low.onnx.json"

COPY --from=backend-build /opt/venv /opt/venv
COPY --from=backend-build /app/backend /app/backend
COPY --from=frontend /build/dist /app/static

WORKDIR /app/backend
# Data dir is the bind-mount target; create it so first boot works without a mount.
RUN mkdir -p /app/data

EXPOSE 8000

# init_db() runs Alembic migrations to head on import (see app/db/engine.py),
# so simply starting Uvicorn migrates the DB on first boot.
# --workers 1 is required: the WebSocket broadcaster is in-process.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
