"""Authentication routes: login, logout, session, user list, PIN change."""

from typing import Any

from pydantic import BaseModel

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.db.engine import get_session
from app.db.models import User
from app.schemas.auth import ChangePinRequest, LoginRequest, LoginResponse, UserPublic
from app.security import pins as pin_utils
from app.security import lockout as lockout_utils
from app.security.session import (
    clear_session_cookie,
    get_current_user,
    set_session_cookie,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class _LocaleRequest(BaseModel):
    locale: str


def _to_dict(user: User) -> dict[str, Any]:
    """Extract scalar values from a SQLAlchemy ORM user object."""
    return {
        "id": user.id,
        "name": user.name,
        "avatar_kind": user.avatar_kind,
        "avatar_value": user.avatar_value,
        "role": user.role,
        "current_stars": user.current_stars,
        "preferred_locale": user.preferred_locale,
    }


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_session)) -> JSONResponse:
    user = db.query(User).filter(User.id == req.user_id).first()
    if not user:
        return JSONResponse(status_code=401, content={"detail": "Invalid credentials"})

    locked, seconds_remaining = lockout_utils.is_locked(user)
    if locked:
        return JSONResponse(
            status_code=423,
            content={"detail": "Account locked", "locked_seconds": seconds_remaining},
        )

    pin_hash: str | None = getattr(user, "pin_hash")
    if not pin_hash or not pin_utils.verify_pin(req.pin, pin_hash):
        lockout_utils.register_failure(user)
        db.commit()
        locked, seconds_remaining = lockout_utils.is_locked(user)
        if locked:
            return JSONResponse(
                status_code=423,
                content={"detail": "Account locked", "locked_seconds": seconds_remaining},
            )
        return JSONResponse(status_code=401, content={"detail": "Invalid PIN"})

    lockout_utils.register_success(user)
    db.commit()

    data = _to_dict(user)
    resp = JSONResponse(
        status_code=200,
        content=LoginResponse(**data).model_dump(),
    )
    set_session_cookie(resp, int(data["id"]))
    return resp


@router.post("/logout")
def logout() -> JSONResponse:
    resp = JSONResponse(content={"message": "Logged out"})
    clear_session_cookie(resp)
    return resp


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)) -> LoginResponse:
    data = _to_dict(current_user)
    return LoginResponse(**data)


@router.get("/users")
def list_users(db: Session = Depends(get_session)) -> list[UserPublic]:
    users = db.query(User).filter(User.is_active == True).order_by(User.id).all()
    result: list[UserPublic] = []
    for u in users:
        ud = _to_dict(u)
        result.append(UserPublic(
            id=ud["id"],
            name=ud["name"],
            avatar_kind=ud["avatar_kind"],
            avatar_value=ud["avatar_value"],
            role=ud["role"],
        ))
    return result


@router.post("/me/locale")
def update_locale(
    req: _LocaleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> JSONResponse:
    if req.locale not in ("el", "en"):
        return JSONResponse(status_code=400, content={"detail": "Invalid locale"})
    current_user.preferred_locale = req.locale  # type: ignore[assignment]
    db.commit()
    return JSONResponse(content={"locale": req.locale})


@router.post("/me/pin")
def change_pin(
    req: ChangePinRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_session),
) -> JSONResponse:
    pin_hash: str | None = getattr(current_user, "pin_hash")
    if not pin_hash or not pin_utils.verify_pin(req.current_pin, pin_hash):
        return JSONResponse(status_code=400, content={"detail": "Current PIN is incorrect"})

    current_user.pin_hash = pin_utils.hash_pin(req.new_pin)  # type: ignore[assignment]
    db.commit()
    return JSONResponse(content={"message": "PIN updated"})
