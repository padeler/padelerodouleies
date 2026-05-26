"""Bootstrap detection API route."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.services.bootstrap import is_first_run

router = APIRouter(prefix="/api/bootstrap", tags=["bootstrap"])


@router.get("/status")
async def bootstrap_status() -> JSONResponse:
    return JSONResponse(content={"first_run": is_first_run()})
