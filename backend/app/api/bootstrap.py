"""Bootstrap detection and setup API routes."""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.engine import get_session
from app.db.models import User
from app.schemas.auth import BootstrapSetupRequest, LoginResponse
from app.security import pins as pin_utils
from app.security.session import set_session_cookie
from app.services.bootstrap import is_first_run

router = APIRouter(prefix="/api/bootstrap", tags=["bootstrap"])


@router.get("/status")
def bootstrap_status() -> JSONResponse:
    return JSONResponse(content={"first_run": is_first_run()})


@router.post("/setup", status_code=201)
def bootstrap_setup(req: BootstrapSetupRequest, db: Session = Depends(get_session)) -> JSONResponse:
    if not is_first_run():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="App already initialized")

    if not req.pin.isdigit():
        raise HTTPException(status_code=400, detail="PIN must be 4 digits")

    user = User(
        name=req.name,
        role="admin",
        avatar_kind=req.avatar_kind,
        avatar_value=req.avatar_value,
        pin_hash=pin_utils.hash_pin(req.pin),
        current_stars=0,
        preferred_locale="el",
        is_active=True,
    )
    db.add(user)
    db.commit()

    uid = int(user.id)
    data = LoginResponse(
        id=uid,
        name=str(user.name),
        avatar_kind=str(user.avatar_kind),
        avatar_value=str(user.avatar_value),
        role=str(user.role),
        current_stars=int(user.current_stars),
        preferred_locale=str(user.preferred_locale),
        preferred_theme=str(user.preferred_theme),
    )

    resp = JSONResponse(status_code=201, content=data.model_dump())
    set_session_cookie(resp, uid)
    print(f'[Bootstrap] session cookie set for user id={uid}')
    return resp
