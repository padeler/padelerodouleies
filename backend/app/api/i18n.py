"""i18n API routes."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.i18n.translations import TRANSLATIONS

router = APIRouter(prefix="/api/i18n", tags=["i18n"])


@router.get("/translations")
async def get_translations() -> JSONResponse:
    return JSONResponse(content=TRANSLATIONS)
