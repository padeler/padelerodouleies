"""Session cookie management with itsdangerous."""

import os
from datetime import datetime, timezone

from fastapi import Cookie, Depends, HTTPException, status
from fastapi.responses import Response
from itsdangerous import URLSafeTimedSerializer as Serializer
from sqlalchemy.orm import Session

from app.db.engine import get_session
from app.db.models import User

SESSION_COOKIE_NAME = "session"
SESSION_MAX_AGE = 86400  # 24 hours
SECRET_KEY = os.getenv("SESSION_SECRET", "padelerodouleies-dev-secret")

serializer = Serializer(SECRET_KEY)


def _make_token(user_id: int) -> str:
    return serializer.dumps({"uid": user_id, "iat": datetime.now(timezone.utc).isoformat()})


def _read_token(token_str: str) -> dict[str, object]:
    try:
        payload = serializer.loads(token_str, max_age=SESSION_MAX_AGE)
        return payload  # type: ignore[no-any-return]
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")


def set_session_cookie(response: Response, user_id: int) -> None:
    token = _make_token(user_id)
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        samesite="strict",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME, path="/")


def get_current_user(
    session: str | None = Cookie(default=None),
    db: Session = Depends(get_session),
) -> User:
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No session")
    data = _read_token(session)
    uid = data["uid"]
    if not isinstance(uid, int):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == uid).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
