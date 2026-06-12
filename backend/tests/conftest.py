"""Pytest configuration and shared fixtures."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.main import app
from app.db.engine import get_session


@pytest.fixture(autouse=True)
def _rollback_db():
    """Delete all DB rows after each test to avoid stale data between tests."""
    yield
    session: Session = next(get_session())
    try:
        session.execute(text("DELETE FROM game_scores"))
        session.execute(text("DELETE FROM pending_claims"))
        session.execute(text("DELETE FROM reward_ledger"))
        session.execute(text("DELETE FROM history_ledger"))
        session.execute(text("DELETE FROM chores"))
        session.execute(text("DELETE FROM rewards"))
        session.execute(text("DELETE FROM users"))
        session.commit()
    finally:
        session.close()


@pytest.fixture
async def async_client():
    """Async TestClient for FastAPI."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client
