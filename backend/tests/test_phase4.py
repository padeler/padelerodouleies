"""Phase 4 backend tests: chore visibility, claims, history, marketplace, leaderboard, WebSocket."""

from datetime import date, time

import pytest
from httpx import ASGITransport, AsyncClient, Cookies

from app.db.engine import LocalSession
from app.db.models import Chore, HistoryLedger, Reward, RewardLedger, User
from app.services.chores import _is_in_window
from app.main import app
from app.security.pins import hash_pin


@pytest.fixture
async def kid_client():
    """Authenticated kid client with 30 stars."""
    db = LocalSession()
    user = User(
        name="Phase4Kid",
        role="user",
        avatar_value="fox",
        pin_hash=hash_pin("1234"),
        current_stars=30,
    )
    db.add(user)
    db.commit()
    uid = user.id
    db.close()

    transport = ASGITransport(app=app)
    cookies = Cookies()
    async with AsyncClient(transport=transport, base_url="http://testserver", cookies=cookies) as c:
        resp = await c.post("/api/auth/login", json={"user_id": uid, "pin": "1234"})
        assert resp.status_code == 200
        yield (c, uid)


@pytest.fixture
async def kid2_client():
    """Second kid client for pooled chore tests."""
    db = LocalSession()
    user = User(
        name="Phase4Kid2",
        role="user",
        avatar_value="lion",
        pin_hash=hash_pin("5678"),
        current_stars=20,
    )
    db.add(user)
    db.commit()
    uid = user.id
    db.close()

    transport = ASGITransport(app=app)
    cookies = Cookies()
    async with AsyncClient(transport=transport, base_url="http://testserver", cookies=cookies) as c:
        resp = await c.post("/api/auth/login", json={"user_id": uid, "pin": "5678"})
        assert resp.status_code == 200
        yield (c, uid)


@pytest.fixture
async def admin_client_p4():
    """Authenticated admin client."""
    db = LocalSession()
    admin = User(
        name="Phase4Admin",
        role="admin",
        avatar_value="shield",
        pin_hash=hash_pin("9999"),
        current_stars=0,
    )
    db.add(admin)
    db.commit()
    uid = admin.id
    db.close()

    transport = ASGITransport(app=app)
    cookies = Cookies()
    async with AsyncClient(transport=transport, base_url="http://testserver", cookies=cookies) as c:
        resp = await c.post("/api/auth/login", json={"user_id": uid, "pin": "9999"})
        assert resp.status_code == 200
        yield c


def test_chore_window_visibility():
    today = date(2026, 5, 26)
    assert not _is_in_window(time(7, 0), 4, today, time(6, 59))
    assert _is_in_window(time(7, 0), 4, today, time(7, 0))
    assert _is_in_window(time(7, 0), 4, today, time(10, 59))
    assert not _is_in_window(time(7, 0), 4, today, time(11, 0))
    assert _is_in_window(time(22, 0), 4, today, time(1, 0))


async def test_visible_chores_endpoint(kid_client):
    client, kid_id = kid_client
    db = LocalSession()
    chore = Chore(
        title="Βούρτσισμα",
        icon_name="tooth", scope="individual",
        points_value=5, is_repeating=True,
        start_time=time(6, 0), window_hours=24, is_active=True,
    )
    db.add(chore)
    db.commit()
    chore_id = chore.id
    db.close()

    resp = await client.get("/api/dashboard/visible-chores")
    assert resp.status_code == 200
    chore_ids = [c["id"] for c in resp.json()]
    assert chore_id in chore_ids

    # Claim it
    resp = await client.post(f"/api/dashboard/chores/{chore_id}/claim")
    assert resp.status_code == 200

    # Should no longer be visible
    resp = await client.get("/api/dashboard/visible-chores")
    chore_ids = [c["id"] for c in resp.json()]
    assert chore_id not in chore_ids


async def test_kid_history_endpoint(kid_client):
    client, kid_id = kid_client
    db = LocalSession()
    entry = HistoryLedger(
        user_id=kid_id,
        action_type="manual_adjust",
        points_delta=5,
        admin_note="test adjustment",
    )
    db.add(entry)
    db.commit()
    db.close()

    resp = await client.get("/api/dashboard/history")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    actions = [e["action_type"] for e in data["entries"]]
    assert "manual_adjust" in actions


async def test_leaderboard_endpoint(admin_client_p4):
    resp = await admin_client_p4.get("/api/leaderboard")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if len(data) >= 2:
        assert data[0]["current_stars"] >= data[1]["current_stars"]


async def test_marketplace_reward_redeem(kid_client):
    client, kid_id = kid_client
    db = LocalSession()
    kid = db.query(User).filter(User.id == kid_id).first()
    old_stars = kid.current_stars

    reward = Reward(
        title="Βραβείο",
        icon_name="gift", cost_stars=10,
        is_collaborative=False, is_enabled=True,
    )
    db.add(reward)
    db.commit()
    reward_id = reward.id
    db.close()

    resp = await client.post(f"/api/rewards/{reward_id}/redeem")
    assert resp.status_code == 200
    data = resp.json()
    assert data["new_balance"] == old_stars - 10


async def test_insufficient_stars(kid_client):
    client, kid_id = kid_client
    db = LocalSession()
    reward = Reward(
        title="Άτοπο",
        icon_name="star", cost_stars=999,
        is_collaborative=False, is_enabled=True,
    )
    db.add(reward)
    db.commit()
    reward_id = reward.id
    db.close()

    resp = await client.post(f"/api/rewards/{reward_id}/redeem")
    assert resp.status_code == 400


async def test_pooled_chore_double_claim(kid_client, kid2_client):
    client1, kid1_id = kid_client
    client2, kid2_id = kid2_client

    db = LocalSession()
    chore = Chore(
        title="Κοινό",
        icon_name="bed", scope="pooled",
        points_value=3, is_repeating=True,
        start_time=time(6, 0), window_hours=24, is_active=True,
    )
    db.add(chore)
    db.commit()
    chore_id = chore.id
    db.close()

    resp = await client1.post(f"/api/dashboard/chores/{chore_id}/claim")
    assert resp.status_code == 200

    resp = await client2.post(f"/api/dashboard/chores/{chore_id}/claim")
    assert resp.status_code == 409


async def test_collaborative_contribute(kid_client, kid2_client):
    client1, kid1_id = kid_client
    client2, kid2_id = kid2_client

    db = LocalSession()
    reward = Reward(
        title="Ομαδικό",
        icon_name="star", cost_stars=999,
        is_collaborative=True, is_enabled=True,
    )
    db.add(reward)
    db.commit()
    reward_id = reward.id

    # Get current total for this new reward
    contributions = db.query(RewardLedger).filter(
        RewardLedger.reward_id == reward_id,
    ).all()
    base_total = sum(c.stars_contributed for c in contributions)
    db.close()

    resp = await client1.post(f"/api/rewards/{reward_id}/contribute", json={"stars": 15})
    assert resp.status_code == 200
    assert resp.json()["total"] == base_total + 15

    resp = await client2.post(f"/api/rewards/{reward_id}/contribute", json={"stars": 10})
    assert resp.status_code == 200
    assert resp.json()["total"] == base_total + 25


async def test_marketplace_list(kid_client):
    client, _ = kid_client
    resp = await client.get("/api/marketplace/rewards")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_redeem_rejects_collaborative(kid_client):
    client, _ = kid_client
    db = LocalSession()
    reward = Reward(
        title="Ομαδικό2",
        icon_name="heart", cost_stars=30,
        is_collaborative=True, is_enabled=True,
    )
    db.add(reward)
    db.commit()
    reward_id = reward.id
    db.close()

    resp = await client.post(f"/api/rewards/{reward_id}/redeem")
    assert resp.status_code == 400


async def test_contribute_rejects_individual(kid_client):
    client, _ = kid_client
    db = LocalSession()
    reward = Reward(
        title="Ατομικό",
        icon_name="gift", cost_stars=10,
        is_collaborative=False, is_enabled=True,
    )
    db.add(reward)
    db.commit()
    reward_id = reward.id
    db.close()

    resp = await client.post(f"/api/rewards/{reward_id}/contribute", json={"stars": 5})
    assert resp.status_code == 400
