"""FastAPI application entry point."""

import base64
import hashlib
import os
import re
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import Scope

import app.db.models as _models  # noqa:F401 ensures models are registered with metadata
from app.config import expose_openapi, hsts_enabled
from app.db.engine import get_session, LocalSession
from app.db.engine import init_db
from app.db.models import User
from app.realtime import broadcaster


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Pre-record TTS audio so the first speaker tap / game round is instant.

    Both passes run in daemon threads (Piper is a blocking subprocess) so they
    never delay startup; a missing TTS toolchain just logs and aborts the pass.
    """
    from app.services.exercise_tts import warm_all_in_background as warm_exercises
    from app.services.learn_tts import warm_all_in_background as warm_learn

    warm_exercises()
    warm_learn()
    yield


app = FastAPI(
    title="padelerodouleies",
    docs_url=None,
    redoc_url=None,
    # Hidden in production (recon reduction); the Swagger/ReDoc UIs stay off always.
    openapi_url="/api/openapi.json" if expose_openapi() else None,
    lifespan=lifespan,
)

init_db()

# Paths whose bodies are user-uploaded or raw SVG served inline: lock them down
# so a hostile SVG opened directly can't execute script, and MIME sniffing is off.
_USER_CONTENT_PREFIXES = ("/avatars/", "/chore-images/", "/api/icons/svg/")

# Resolved here (the mount itself is at the bottom of this module, so it does not
# shadow the API/WS routes) because the CSP below hashes the built index.html.
STATIC_DIR = Path(os.getenv("STATIC_DIR", str(Path(__file__).parents[2] / "static")))

_INLINE_SCRIPT_RE = re.compile(r"<script\b[^>]*>(.*?)</script>", re.DOTALL)


def _index_script_hashes() -> list[str]:
    """CSP hash sources for the inline scripts of the built index.html.

    `@vitejs/plugin-legacy` (needed by the old LAN tablets) injects an inline
    SystemJS bootstrap script into index.html, which `script-src 'self'` blocks —
    the whole SPA then fails to boot and the page stays blank. Hashing the actual
    built file, rather than hardcoding the digest, keeps the CSP correct across
    Vite/plugin upgrades that reword the snippet.
    """
    index = STATIC_DIR / "index.html"
    if not index.is_file():
        # Dev mode: the Vite dev server serves index.html and this CSP never applies.
        return []
    digests = sorted(
        {
            base64.b64encode(hashlib.sha256(body.encode()).digest()).decode()
            for match in _INLINE_SCRIPT_RE.finditer(index.read_text("utf-8"))
            if (body := match.group(1)).strip()
        }
    )
    print(f"[startup] CSP script-src: {len(digests)} inline hash(es) from {index}")
    return [f"'sha256-{digest}'" for digest in digests]


# App-wide CSP for the SPA. 'unsafe-inline' is limited to styles (React inline
# styles / animated gradients); scripts are 'self' plus the hashed inline
# bootstrap above. Same-origin WebSocket is covered by connect-src 'self'.
_APP_CSP = "; ".join(
    [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "img-src 'self' data:",
        "style-src 'self' 'unsafe-inline'",
        " ".join(["script-src", "'self'", *_index_script_hashes()]),
        "connect-src 'self'",
        "font-src 'self' data:",
        "form-action 'self'",
    ]
)
# Neutralize any active content in a user-served document (esp. standalone SVG).
_USER_CONTENT_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox"


@app.middleware("http")
async def security_headers(request: Request, call_next):  # type: ignore[no-untyped-def]
    """Attach security headers to every response (H5 hardening)."""
    response: Response = await call_next(request)
    path = request.url.path
    if path.startswith(_USER_CONTENT_PREFIXES):
        response.headers["Content-Security-Policy"] = _USER_CONTENT_CSP
    else:
        response.headers["Content-Security-Policy"] = _APP_CSP
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if hsts_enabled():
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response

# Mount avatars directory (created on first upload)
AVATAR_DIR = Path(__file__).parent.parent.parent / "data" / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/avatars", StaticFiles(directory=str(AVATAR_DIR)), name="avatars")

# Mount chore images directory
CHORE_IMAGE_DIR = Path(__file__).parent.parent.parent / "data" / "chore-images"
CHORE_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/chore-images", StaticFiles(directory=str(CHORE_IMAGE_DIR)), name="chore-images")

# Register routers
from app.api.i18n import router as i18n_router
from app.api.bootstrap import router as bootstrap_router
from app.api.icons import router as icons_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router
from app.api.dashboard import router as dashboard_router
from app.api.marketplace import router as marketplace_router
from app.api.leaderboard import router as leaderboard_router
from app.api.stats import router as stats_router
from app.api.games import router as games_router
from app.api.tts import router as tts_router
from app.api.exercises import router as exercises_router
from app.api.learn import router as learn_router

app.include_router(i18n_router)
app.include_router(bootstrap_router)
app.include_router(icons_router)
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(dashboard_router)
app.include_router(marketplace_router)
app.include_router(leaderboard_router)
app.include_router(stats_router)
app.include_router(games_router)
app.include_router(tts_router)
app.include_router(exercises_router)
app.include_router(learn_router)


@app.get("/api/health")
async def health() -> JSONResponse:
    return JSONResponse(content={"status": "ok"})


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket) -> None:
    """Authenticated WebSocket connection."""
    from app.security.session import SESSION_COOKIE_NAME, serializer

    await ws.accept()
    # Read the session cookie from the WebSocket request headers
    cookie_header = ws.headers.get("cookie", "")
    session_token = None
    for part in cookie_header.split(";"):
        part = part.strip()
        if part.startswith(f"{SESSION_COOKIE_NAME}="):
            session_token = part.split("=", 1)[1]
            break

    if not session_token:
        await ws.close(code=4401, reason="No session")
        return

    try:
        payload = serializer.loads(session_token, max_age=86400)
        uid = payload["uid"]
        if not isinstance(uid, int):
            await ws.close(code=4401, reason="Invalid token")
            return
    except Exception:
        await ws.close(code=4401, reason="Invalid session")
        return

    db: Session = LocalSession()
    try:
        user = db.query(User).filter(User.id == uid).first()
        if not user or not user.is_active:
            await ws.close(code=4401, reason="User not found")
            return
        await broadcaster.connect(ws, user.id, user.role)
    finally:
        db.close()

    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        broadcaster.disconnect(ws)


class SPAStaticFiles(StaticFiles):
    """Static file server with single-page-app fallback.

    Serves built assets directly; any unmatched path (a client-side route such
    as /dashboard or /admin) falls back to index.html so React Router can take
    over. API and WebSocket routes are registered before this mount, so they are
    matched first and never reach the fallback.
    """

    async def get_response(self, path: str, scope: Scope):  # type: ignore[no-untyped-def]
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            # Missing file == a client-side route; serve the SPA shell.
            if exc.status_code == 404:
                return await super().get_response("index.html", scope)
            raise


# Serve the built frontend last, so it does not shadow the API/WS routes above.
# (STATIC_DIR is resolved next to the CSP definition, which depends on it.)
if STATIC_DIR.is_dir():
    app.mount("/", SPAStaticFiles(directory=str(STATIC_DIR), html=True), name="spa")
    print(f"[startup] Serving SPA from {STATIC_DIR}")
else:
    print(f"[startup] No static dir at {STATIC_DIR}; SPA not served (dev mode, Vite handles the frontend)")
