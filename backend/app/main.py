"""FastAPI application entry point."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

import app.db.models as _models  # noqa:F401 ensures models are registered with metadata
from app.db.engine import init_db

app = FastAPI(title="padelerodouleies", docs_url=None, redoc_url=None)

init_db()

# Mount avatars directory (created on first upload)
AVATAR_DIR = Path(__file__).parent.parent.parent / "data" / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/avatars", StaticFiles(directory=str(AVATAR_DIR)), name="avatars")

# Register routers
from app.api.i18n import router as i18n_router
from app.api.bootstrap import router as bootstrap_router
from app.api.icons import router as icons_router
from app.api.auth import router as auth_router
from app.api.admin import router as admin_router

app.include_router(i18n_router)
app.include_router(bootstrap_router)
app.include_router(icons_router)
app.include_router(auth_router)
app.include_router(admin_router)


@app.get("/api/health")
async def health() -> JSONResponse:
    return JSONResponse(content={"status": "ok"})
