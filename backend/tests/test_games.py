"""Tests for the game best-score service and endpoints."""

from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient, Cookies

from app.db.engine import LocalSession
from app.db.models import User
from app.main import app
from app.security.pins import hash_pin
from app.services.games import UnknownGameError, scores_by_user, submit_score
from app.services.stats import compute_stats


def test_submit_score_creates_then_only_improves_higher():
    db = LocalSession()
    try:
        kid = User(name="GameKid1", role="user", pin_hash=hash_pin("1234"))
        db.add(kid)
        db.commit()

        assert submit_score(db, kid.id, "simon", 3) == (3, True)
        assert submit_score(db, kid.id, "simon", 2) == (3, False)
        assert submit_score(db, kid.id, "simon", 5) == (5, True)
    finally:
        db.close()


def test_submit_score_lower_is_better_for_memory():
    db = LocalSession()
    try:
        kid = User(name="GameKid2", role="user", pin_hash=hash_pin("1234"))
        db.add(kid)
        db.commit()

        assert submit_score(db, kid.id, "memory.easy", 12) == (12, True)
        assert submit_score(db, kid.id, "memory.easy", 15) == (12, False)
        assert submit_score(db, kid.id, "memory.easy", 8) == (8, True)
    finally:
        db.close()


def test_submit_score_rejects_unknown_game_and_bad_score():
    db = LocalSession()
    try:
        kid = User(name="GameKid3", role="user", pin_hash=hash_pin("1234"))
        db.add(kid)
        db.commit()

        with pytest.raises(UnknownGameError):
            submit_score(db, kid.id, "tetris", 1)
        with pytest.raises(ValueError):
            submit_score(db, kid.id, "simon", 0)
    finally:
        db.close()


def test_scores_by_user_groups_per_kid():
    db = LocalSession()
    try:
        kid1 = User(name="GameKid4", role="user", pin_hash=hash_pin("1234"))
        kid2 = User(name="GameKid5", role="user", pin_hash=hash_pin("1234"))
        db.add_all([kid1, kid2])
        db.commit()

        submit_score(db, kid1.id, "simon", 4)
        submit_score(db, kid1.id, "catcher", 20)
        submit_score(db, kid2.id, "memory.hard", 25)

        scores = scores_by_user(db, [kid1.id, kid2.id])
        assert scores[kid1.id] == {"simon": 4, "catcher": 20}
        assert scores[kid2.id] == {"memory.hard": 25}
    finally:
        db.close()


def test_compute_stats_includes_game_scores():
    db = LocalSession()
    try:
        kid = User(name="GameKid6", role="user", pin_hash=hash_pin("1234"))
        db.add(kid)
        db.commit()
        submit_score(db, kid.id, "catcher", 9)

        stats = compute_stats(db, datetime.now(timezone.utc))
        per_kid = {k["name"]: k for k in stats["per_kid"]}
        assert per_kid["GameKid6"]["game_scores"] == {"catcher": 9}
    finally:
        db.close()


@pytest.fixture
async def kid_client_games():
    db = LocalSession()
    user = User(name="GameAuthKid", role="user", pin_hash=hash_pin("1234"))
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


async def test_game_scores_endpoints_require_auth():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        assert (await c.get("/api/games/scores")).status_code == 401
        assert (await c.post("/api/games/scores", json={"game": "simon", "score": 1})).status_code == 401


async def test_game_scores_roundtrip(kid_client_games):
    resp = await kid_client_games.get("/api/games/scores")
    assert resp.status_code == 200
    assert resp.json() == {}

    resp = await kid_client_games.post("/api/games/scores", json={"game": "simon", "score": 4})
    assert resp.status_code == 200
    assert resp.json() == {"best_score": 4, "improved": True}

    resp = await kid_client_games.post("/api/games/scores", json={"game": "simon", "score": 2})
    assert resp.status_code == 200
    assert resp.json() == {"best_score": 4, "improved": False}

    resp = await kid_client_games.get("/api/games/scores")
    assert resp.json() == {"simon": 4}


async def test_post_score_validates_payload(kid_client_games):
    resp = await kid_client_games.post("/api/games/scores", json={"game": "tetris", "score": 1})
    assert resp.status_code == 400

    resp = await kid_client_games.post("/api/games/scores", json={"game": "simon", "score": 0})
    assert resp.status_code == 422
