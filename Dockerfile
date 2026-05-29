# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1 — Frontend build: compile the Vite + React SPA to static assets.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS frontend
WORKDIR /build
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
    PYTHONUNBUFFERED=1

# tzdata so TZ resolves to Athens local time; curl for the compose healthcheck.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tzdata curl \
    && rm -rf /var/lib/apt/lists/* \
    && ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime \
    && echo "$TZ" > /etc/timezone

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
