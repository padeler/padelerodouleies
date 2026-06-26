#!/usr/bin/env bash
# Pull the latest GHCR image and restart the container only if it changed.
# Safe to run on a tight interval: `docker compose up -d` is a no-op when the
# image digest has not moved.
set -euo pipefail

# Directory holding docker-compose.prod.yml and .env
COMPOSE_DIR="/volume1/docker/padelerodouleies"
COMPOSE_FILE="compose.yaml"
LOG="/volume1/docker/padelerodouleies/auto-update.log"

cd "$COMPOSE_DIR"

# Resolve the image ref the compose file would use (honours IMAGE_TAG/.env).
IMAGE="$(docker compose -f "$COMPOSE_FILE" config --images | head -n1)"

before="$(docker image inspect --format '{{.Id}}' "$IMAGE" 2>/dev/null || echo none)"

# Pull quietly; capture the new digest.
docker compose -f "$COMPOSE_FILE" pull -q

after="$(docker image inspect --format '{{.Id}}' "$IMAGE" 2>/dev/null || echo none)"

ts="$(date '+%Y-%m-%d %H:%M:%S')"
if [ "$before" != "$after" ]; then
  echo "[$ts] new image $after (was $before) — recreating container" >>"$LOG"
  docker compose -f "$COMPOSE_FILE" up -d >>"$LOG" 2>&1
  docker image prune -f >>"$LOG" 2>&1   # drop the now-dangling old image
  echo "[$ts] update complete" >>"$LOG"
else
  echo "[$ts] no change ($after)" >>"$LOG"
fi
