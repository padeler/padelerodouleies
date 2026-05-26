"""FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.responses import JSONResponse

import app.db.models as _models  # noqa:F401 ensures models are registered with metadata
from app.db.engine import init_db

app = FastAPI(title="padelerodouleies", docs_url=None, redoc_url=None)

init_db()

# Register routers
from app.api.i18n import router as i18n_router
from app.api.bootstrap import router as bootstrap_router
from app.api.icons import router as icons_router
from app.api.auth import router as auth_router

app.include_router(i18n_router)
app.include_router(bootstrap_router)
app.include_router(icons_router)
app.include_router(auth_router)


@app.get("/api/health")
async def health() -> JSONResponse:
    return JSONResponse(content={"status": "ok"})
