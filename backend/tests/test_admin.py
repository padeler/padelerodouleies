"""Tests for admin endpoints: CRUD, approvals, users, fulfillment, history."""

import pytest
from httpx import AsyncClient
from sqlalchemy.orm import Session

from app.db.engine import get_session
from app.db.models import Chore, PendingClaim, Reward, RewardLedger, User, HistoryLedger


@pytest.fixture
def _db():
    """Get a DB session for test setup."""
    session: Session = next(get_session())
    try:
        yield session
    finally:
        session.close()


def _seed_admin(db: Session) -> User:
    from app.security import pins as pin_utils
    admin = User(name="Admin", role="admin", pin_hash=pin_utils.hash_pin("1111"))
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def _seed_kid(db: Session) -> User:
    from app.security import pins as pin_utils
    kid = User(name="Kid", role="user", pin_hash=pin_utils.hash_pin("2222"), current_stars=10)
    db.add(kid)
    db.commit()
    db.refresh(kid)
    return kid


async def test_pending_count_requires_admin(async_client: AsyncClient):
    resp = await async_client.get("/api/admin/pending-count")
    assert resp.status_code == 401


async def test_pending_count(async_client: AsyncClient, _db: Session):
    admin = _seed_admin(_db)
    kid = _seed_kid(_db)
    chore = Chore(title="Χ", icon_name="star", points_value=5)
    _db.add(chore)
    _db.commit()
    _db.refresh(chore)

    claim = PendingClaim(user_id=kid.id, chore_id=chore.id)
    _db.add(claim)
    _db.commit()

    cookie = await _login(async_client, kid.id, "2222")
    resp = await async_client.get("/api/admin/pending-count", cookies=cookie)
    assert resp.status_code == 403

    cookie = await _login(async_client, admin.id, "1111")
    resp = await async_client.get("/api/admin/pending-count", cookies=cookie)
    assert resp.status_code == 200
    assert resp.json()["count"] >= 1


async def test_chore_crud(async_client: AsyncClient, _db: Session):
    admin = _seed_admin(_db)
    cookie = await _login(async_client, admin.id, "1111")

    # Create
    resp = await async_client.post("/api/admin/chores", json={
        "title": "Βούρτσισμα",
        "icon_name": "star",
        "points_value": 5,
    }, cookies=cookie)
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Βούρτσισμα"
    assert data["points_value"] == 5

    # List
    resp = await async_client.get("/api/admin/chores", cookies=cookie)
    assert resp.status_code == 200
    assert len(resp.json()) >= 1

    # Update
    resp = await async_client.patch(f"/api/admin/chores/{data['id']}", json={
        "points_value": 10,
    }, cookies=cookie)
    assert resp.status_code == 200
    assert resp.json()["points_value"] == 10

    # Hard delete
    resp = await async_client.delete(f"/api/admin/chores/{data['id']}", cookies=cookie)
    assert resp.status_code == 200
    chore = _db.query(Chore).filter(Chore.id == data["id"]).first()
    assert chore is None  # hard deleted from DB

    # Create with invalid data
    resp = await async_client.post("/api/admin/chores", json={
        "title": "Test",
        "icon_name": "star",
        "points_value": -1,
    }, cookies=cookie)
    assert resp.status_code == 422


async def test_reward_crud(async_client: AsyncClient, _db: Session):
    admin = _seed_admin(_db)
    cookie = await _login(async_client, admin.id, "1111")

    resp = await async_client.post("/api/admin/rewards", json={
        "title": "Βραβείο",
        "icon_name": "gift",
        "cost_stars": 20,
    }, cookies=cookie)
    assert resp.status_code == 201
    data = resp.json()

    resp = await async_client.get("/api/admin/rewards", cookies=cookie)
    assert len(resp.json()) >= 1

    resp = await async_client.patch(f"/api/admin/rewards/{data['id']}", json={
        "is_enabled": False,
    }, cookies=cookie)
    assert resp.status_code == 200
    assert resp.json()["is_enabled"] is False


async def test_approve_claim(async_client: AsyncClient, _db: Session):
    admin = _seed_admin(_db)
    kid = _seed_kid(_db)
    chore = Chore(title="Χ", icon_name="star", points_value=5)
    _db.add(chore)
    _db.commit()
    _db.refresh(chore)

    claim = PendingClaim(user_id=kid.id, chore_id=chore.id)
    _db.add(claim)
    _db.commit()
    _db.refresh(claim)

    cookie = await _login(async_client, admin.id, "1111")
    resp = await async_client.post(
        f"/api/admin/pending-claims/{claim.id}/approve",
        cookies=cookie,
    )
    assert resp.status_code == 200

    _db.expire_all()
    kid = _db.query(User).filter(User.id == kid.id).first()
    assert kid.current_stars == 15

    ledger = _db.query(HistoryLedger).filter(
        HistoryLedger.action_type == "chore_approved"
    ).first()
    assert ledger is not None
    assert ledger.points_delta == 5


async def test_decline_claim(async_client: AsyncClient, _db: Session):
    admin = _seed_admin(_db)
    kid = _seed_kid(_db)
    chore = Chore(title="Χ", icon_name="star", points_value=5)
    _db.add(chore)
    _db.commit()
    _db.refresh(chore)

    claim = PendingClaim(user_id=kid.id, chore_id=chore.id)
    _db.add(claim)
    _db.commit()
    _db.refresh(claim)

    cookie = await _login(async_client, admin.id, "1111")
    resp = await async_client.post(
        f"/api/admin/pending-claims/{claim.id}/decline",
        json={"admin_note": "Not done"},
        cookies=cookie,
    )
    assert resp.status_code == 200

    _db.expire_all()
    kid = _db.query(User).filter(User.id == kid.id).first()
    assert kid.current_stars == 10  # No change


async def test_adjust_stars(async_client: AsyncClient, _db: Session):
    admin = _seed_admin(_db)
    kid = _seed_kid(_db)
    cookie = await _login(async_client, admin.id, "1111")

    resp = await async_client.post(
        f"/api/admin/users/{kid.id}/adjust-stars",
        json={"points_delta": 5, "description": "Good job"},
        cookies=cookie,
    )
    assert resp.status_code == 200
    assert resp.json()["new_balance"] == 15

    _db.expire_all()
    kid = _db.query(User).filter(User.id == kid.id).first()
    assert kid.current_stars == 15

    # Reject negative balance
    resp = await async_client.post(
        f"/api/admin/users/{kid.id}/adjust-stars",
        json={"points_delta": -100, "description": "Too much"},
        cookies=cookie,
    )
    assert resp.status_code == 400


async def test_admin_user_crud(async_client: AsyncClient, _db: Session):
    admin = _seed_admin(_db)
    cookie = await _login(async_client, admin.id, "1111")

    # Create
    resp = await async_client.post("/api/admin/users", json={
        "name": "New Kid",
        "pin": "3333",
        "avatar_kind": "icon",
        "avatar_value": "fox",
        "role": "user",
    }, cookies=cookie)
    assert resp.status_code == 201
    assert resp.json()["name"] == "New Kid"

    # List
    resp = await async_client.get("/api/admin/users", cookies=cookie)
    assert len(resp.json()) >= 2


async def test_admin_history(async_client: AsyncClient, _db: Session):
    admin = _seed_admin(_db)
    kid = _seed_kid(_db)
    cookie = await _login(async_client, admin.id, "1111")

    ledger = HistoryLedger(
        user_id=kid.id,
        action_type="manual_adjust",
        points_delta=5,
        admin_note="Test entry",
    )
    _db.add(ledger)
    _db.commit()

    resp = await async_client.get("/api/admin/history", cookies=cookie)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    assert data["entries"][0]["action_type"] == "manual_adjust"


async def _login(client: AsyncClient, user_id: int, pin: str):
    """Login and return the session cookie."""
    resp = await client.post("/api/auth/login", json={"user_id": user_id, "pin": pin})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    return resp.cookies
