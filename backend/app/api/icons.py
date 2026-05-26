"""Icon catalog API routes."""

import json
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse, Response

ICONS_DIR = Path(__file__).parent.parent / "icons"
CATALOG_PATH = ICONS_DIR / "catalog.json"

_catalog: list[dict[str, object]] | None = None


def _load_catalog() -> list[dict[str, object]]:
    global _catalog
    if _catalog is None:
        with open(CATALOG_PATH, encoding="utf-8") as f:
            _catalog = json.load(f)
    return _catalog


router = APIRouter(prefix="/api/icons", tags=["icons"])


@router.get("/catalog")
async def get_catalog() -> JSONResponse:
    return JSONResponse(content=_load_catalog())


@router.get("/svg/{name}")
async def get_svg(name: str) -> Response:
    """Serve an individual icon SVG by name."""
    svg_path = ICONS_DIR / "svg" / f"{name}.svg"
    if not svg_path.exists():
        return Response(status_code=404, content="Not found")
    return Response(content=svg_path.read_bytes(), media_type="image/svg+xml")
