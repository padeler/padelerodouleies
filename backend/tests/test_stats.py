"""Tests for the statistics aggregation service and endpoint."""

from datetime import datetime, timedelta, timezone

import pytest
from httpx import ASGITransport, AsyncClient, Cookies

from app.db.engine import LocalSession
from app.db.models import GameScore, HistoryLedger, Reward, RewardLedger, User
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


def test_compute_stats_excludes_deleted_users():
    """Soft-deleted (is_active=False) kids and their stars are absent from stats."""
    db = LocalSession()
    try:
        active = User(name="ActiveKid", role="user", avatar_value="fox",
                      pin_hash=hash_pin("1234"), current_stars=8, is_active=True)
        deleted = User(name="DeletedKid", role="user", avatar_value="lion",
                       pin_hash=hash_pin("5678"), current_stars=99, is_active=False)
        db.add_all([active, deleted])
        db.commit()
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        db.add_all([
            HistoryLedger(user_id=active.id, action_type="chore_approved", points_delta=8, timestamp=now),
            HistoryLedger(user_id=deleted.id, action_type="chore_approved", points_delta=50, timestamp=now),
        ])
        db.commit()

        stats = compute_stats(db, _now())
        names = {k["name"] for k in stats["per_kid"]}
        assert names == {"ActiveKid"}
        # Deleted kid's 50 stars excluded from cumulative totals.
        assert stats["window_all"]["total_stars_earned"] == 8
        assert stats["window_all"]["top_earner"]["name"] == "ActiveKid"
    finally:
        db.close()


def test_game_players_include_parents_who_have_played():
    """game_players lists every active kid plus any parent who has a game score,
    so the Stats games section is a whole-family scoreboard. A parent who has
    never played is left out."""
    db = LocalSession()
    try:
        kid = User(name="GamerKid", role="user", avatar_value="fox",
                   pin_hash=hash_pin("1234"), is_active=True)
        playing_parent = User(name="GamerDad", role="admin", avatar_value="shield",
                              pin_hash=hash_pin("5678"), is_active=True)
        idle_parent = User(name="IdleMom", role="admin", avatar_value="crown",
                           pin_hash=hash_pin("4321"), is_active=True)
        db.add_all([kid, playing_parent, idle_parent])
        db.commit()
        db.add_all([
            GameScore(user_id=kid.id, game="catcher", best_score=12),
            GameScore(user_id=playing_parent.id, game="catcher", best_score=20),
        ])
        db.commit()

        stats = compute_stats(db, _now())
        players = {p["name"]: p for p in stats["game_players"]}
        # Kid always present; parent present because they have a score; idle parent absent.
        assert set(players) == {"GamerKid", "GamerDad"}
        assert players["GamerDad"]["game_scores"]["catcher"] == 20
        # The parent does not leak into the chore/reward per-kid rows.
        assert {k["name"] for k in stats["per_kid"]} == {"GamerKid"}
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
