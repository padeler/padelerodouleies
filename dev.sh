#!/usr/bin/env bash
#
# Start the local dev environment (FastAPI backend + Vite frontend) quickly,
# and tear it down cleanly on Ctrl+C (or SIGTERM).
#
#   ./dev.sh            # start both, stream logs, Ctrl+C to stop everything
#
# Each server runs in its own process group (via setsid) so a single signal
# stops the whole tree — uvicorn's reloader child and vite included.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT/backend"
FRONTEND_DIR="$ROOT/frontend"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"

# --- pre-flight checks -------------------------------------------------------
if [[ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" ]]; then
  echo "ERROR: backend venv not found at $BACKEND_DIR/.venv (run: cd backend && python -m venv .venv && .venv/bin/pip install -e .)" >&2
  exit 1
fi
if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  echo "ERROR: frontend deps not installed (run: cd frontend && npm install)" >&2
  exit 1
fi

pgids=()

cleanup() {
  trap - INT TERM EXIT
  echo
  echo "[dev] stopping..."
  for pgid in "${pgids[@]}"; do
    # Negative PID targets the whole process group.
    kill -TERM -- "-$pgid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
  echo "[dev] stopped."
}
trap cleanup INT TERM EXIT

# --- start servers (each as its own session/process-group leader) ------------
echo "[dev] starting backend on http://$BACKEND_HOST:$BACKEND_PORT ..."
setsid bash -c "cd '$BACKEND_DIR' && exec .venv/bin/uvicorn app.main:app --host '$BACKEND_HOST' --port '$BACKEND_PORT' --reload" &
pgids+=("$!")

echo "[dev] starting frontend (Vite dev server) ..."
setsid bash -c "cd '$FRONTEND_DIR' && exec npm run dev" &
pgids+=("$!")

echo "[dev] both servers launching — frontend URL is printed by Vite below."
echo "[dev] press Ctrl+C to stop everything."
echo

# Wait for the background jobs. Ctrl+C hits only this script (the children are
# in separate sessions), so the trap runs and kills both groups.
wait
