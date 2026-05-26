"""Tests for first-run detection and bootstrap API."""

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.engine import Base
from app.db.models import User
from app.services.bootstrap import is_first_run


def _get_in_memory_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    return Session(engine)


def test_is_first_run_returns_true_on_empty_db(monkeypatch) -> None:
    session = _get_in_memory_session()
    # Patch get_session to yield our in-memory session
    monkeypatch.setattr("app.services.bootstrap.get_session", lambda: iter([session]))
    assert is_first_run() is True
    session.close()


def test_is_first_run_returns_false_after_user_inserted(monkeypatch) -> None:
    session = _get_in_memory_session()
    session.add(User(name="Admin", role="admin", avatar_value="shield"))
    session.commit()
    monkeypatch.setattr("app.services.bootstrap.get_session", lambda: iter([session]))
    assert is_first_run() is False
    session.close()
