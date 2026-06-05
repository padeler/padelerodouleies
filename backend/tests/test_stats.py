"""Tests for the statistics aggregation service and endpoint."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient, Cookies

from app.db.engine import LocalSession
from app.db.models import HistoryLedger, Reward, RewardLedger, User
from app.main import app
from app.security.pins import hash_pin
from app.services.stats import compute_stats


def _now() -> datetime:
    return datetime.now(timezone.utc)


def test_compute_stats_empty_db():
    db = LocalSession()
    try:
        stats = compute_stats(db, _now())
        assert stats["per_kid"] == []
        assert stats["window_all"]["total_stars_earned"] == 0
        assert len(stats["window_all"]["earned_per_weekday"]) == 7
        assert stats["window_all"]["top_earner"] is None
    finally:
        db.close()


def test_compute_stats_aggregates_earned_and_spent():
    db = LocalSession()
    try:
        kid1 = User(name="StatsKid1", role="user", avatar_value="fox", pin_hash=hash_pin("1234"), current_stars=15)
        kid2 = User(name="StatsKid2", role="user", avatar_value="lion", pin_hash=hash_pin("5678"), current_stars=5)
        db.add_all([kid1, kid2])
        db.commit()
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        # kid1: earns 10 (chore) + 5 (manual), spends 3 (reward)
        db.add_all([
            HistoryLedger(user_id=kid1.id, action_type="chore_approved", points_delta=10, timestamp=now),
            HistoryLedger(user_id=kid1.id, action_type="manual_adjust", points_delta=5, timestamp=now),
            HistoryLedger(user_id=kid1.id, action_type="reward_purchase", points_delta=-3, timestamp=now),
            # kid2: earns 4 (chore)
            HistoryLedger(user_id=kid2.id, action_type="chore_approved", points_delta=4, timestamp=now),
        ])
        db.commit()

        stats = compute_stats(db, _now())
        all_window = stats["window_all"]
        assert all_window["total_stars_earned"] == 19  # 10 + 5 + 4
        assert all_window["total_chores"] == 2
        assert all_window["top_earner"]["name"] == "StatsKid1"
        assert all_window["top_earner"]["stars"] == 15
        assert all_window["top_chorer"]["count"] == 1  # tie -> lowest id (kid1)

        per_kid = {k["name"]: k for k in stats["per_kid"]}
        assert per_kid["StatsKid1"]["total_earned"] == 15
        assert per_kid["StatsKid1"]["total_spent"] == 3
        assert per_kid["StatsKid1"]["best_day"]["stars"] == 15
        assert per_kid["StatsKid2"]["total_spent"] == 0
        # per_kid sorted by total_earned desc
        assert stats["per_kid"][0]["name"] == "StatsKid1"
    finally:
        db.close()


def test_compute_stats_week_window_excludes_old_rows():
    db = LocalSession()
    try:
        kid = User(name="StatsKid3", role="user", avatar_value="fox", pin_hash=hash_pin("1234"))
        db.add(kid)
        db.commit()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        old = now - timedelta(days=30)

        db.add_all([
            HistoryLedger(user_id=kid.id, action_type="chore_approved", points_delta=7, timestamp=now),
            HistoryLedger(user_id=kid.id, action_type="chore_approved", points_delta=100, timestamp=old),
        ])
        db.commit()

        stats = compute_stats(db, _now())
        assert stats["window_week"]["total_stars_earned"] == 7
        assert stats["window_all"]["total_stars_earned"] == 107
    finally:
        db.close()


def test_compute_stats_counts_awards():
    db = LocalSession()
    try:
        kid = User(name="StatsKid4", role="user", avatar_value="fox", pin_hash=hash_pin("1234"))
        reward = Reward(title="Toy", icon_name="gift", cost_stars=5)
        db.add_all([kid, reward])
        db.commit()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        db.add_all([
            RewardLedger(reward_id=reward.id, user_id=kid.id, status="claimed", stars_contributed=5, claimed_at=now),
            RewardLedger(reward_id=reward.id, user_id=kid.id, status="refunded", stars_contributed=5, claimed_at=now),
        ])
        db.commit()

        stats = compute_stats(db, _now())
        assert stats["window_all"]["total_awards"] == 1  # refunded excluded
        assert stats["window_all"]["top_buyer"]["count"] == 1
    finally:
        db.close()


@pytest.fixture
async def kid_client_stats():
    db = LocalSession()
    user = User(name="StatsAuthKid", role="user", avatar_value="fox", pin_hash=hash_pin("1234"))
    db.add(user)
    db.commit()
    uid = user.id
    db.close()

    transport = ASGITransport(app=app)
    cookies = Cookies()
    async with AsyncClient(transport=transport, base_url="http://testserver", cookies=cookies) as c:
        resp = await c.post("/api/auth/login", json={"user_id": uid, "pin": "1234"})
        assert resp.status_code == 200
        yield c


async def test_stats_endpoint_requires_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        resp = await c.get("/api/stats")
        assert resp.status_code == 401


async def test_stats_endpoint_returns_payload(kid_client_stats):
    resp = await kid_client_stats.get("/api/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert "window_week" in data
    assert "window_all" in data
    assert "per_kid" in data
    assert len(data["window_all"]["earned_per_weekday"]) == 7
