"""Phase 4 backend tests: chore visibility, claims, history, marketplace, leaderboard, WebSocket."""

from datetime import date, datetime, time

import pytest
from httpx import ASGITransport, AsyncClient, Cookies

from app.db.engine import LocalSession
from app.db.models import Chore, HistoryLedger, Reward, RewardLedger, User
from app.services.chores import (
    _is_in_window,
    _matches_day,
    _period_bounds,
    chores_for_dashboard,
)
from app.db.models import PendingClaim
from app.services.approvals import approve_claim
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
        icon_name="tooth", claim_mode="each",
        points_value=5, is_repeating=True,
        start_time=time(6, 0), window_hours=24, is_active=True,
    )
    db.add(chore)
    db.commit()
    chore_id = chore.id
    db.close()

    resp = await client.get("/api/dashboard/visible-chores")
    assert resp.status_code == 200
    chores = resp.json()
    chore_ids = [c["id"] for c in chores]
    assert chore_id in chore_ids
    # Available chores carry no re-availability hint.
    assert next(c for c in chores if c["id"] == chore_id)["available_again_at"] is None

    # Claim it
    resp = await client.post(f"/api/dashboard/chores/{chore_id}/claim")
    assert resp.status_code == 200

    # Should still appear but with status="pending" (claimed chores remain visible)
    resp = await client.get("/api/dashboard/visible-chores")
    chores = resp.json()
    matching = [c for c in chores if c["id"] == chore_id]
    assert len(matching) == 1
    assert matching[0]["status"] == "pending"
    # Claimed chores surface when the daily claim period ends (next Athens midnight).
    assert matching[0]["available_again_at"] is not None


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


async def test_one_mode_chore_double_claim(kid_client, kid2_client):
    client1, kid1_id = kid_client
    client2, kid2_id = kid2_client

    db = LocalSession()
    chore = Chore(
        title="Κοινό",
        icon_name="bed", claim_mode="one",
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


# -- Recurrence tests --

def test_daily_chore_always_visible():
    """A chore with no recurrence filter should be visible every day."""
    chore = Chore(
        title="Daily",
        icon_name="star",
        claim_mode="each",
        points_value=5,
        is_repeating=True,
        is_active=True,
        created_at=datetime(2025, 1, 1),
    )
    assert _matches_day(chore, date(2025, 5, 27))  # Tuesday
    assert _matches_day(chore, date(2025, 5, 31))  # Saturday
    assert _matches_day(chore, date(2025, 6, 1))   # Sunday


def test_weekly_chore_visible_on_matching_day():
    chore = Chore(
        title="Weekly",
        icon_name="brush",
        claim_mode="each",
        points_value=3,
        is_repeating=True,
        is_active=True,
        repeat_days=["Mon", "Wed", "Fri"],
        created_at=datetime(2025, 1, 1),
    )
    assert _matches_day(chore, date(2025, 5, 26))  # Monday
    assert _matches_day(chore, date(2025, 5, 28))  # Wednesday
    assert _matches_day(chore, date(2025, 5, 30))  # Friday


def test_weekly_chore_hidden_on_non_matching_day():
    chore = Chore(
        title="Weekly",
        icon_name="brush",
        claim_mode="each",
        points_value=3,
        is_repeating=True,
        is_active=True,
        repeat_days=["Mon", "Wed", "Fri"],
        created_at=datetime(2025, 1, 1),
    )
    assert not _matches_day(chore, date(2025, 5, 27))  # Tuesday
    assert not _matches_day(chore, date(2025, 5, 31))  # Saturday
    assert not _matches_day(chore, date(2025, 6, 1))   # Sunday


def test_every_n_days_visible_on_schedule():
    """A chore with n_day_interval=7 should be visible on day 0, 7, 14, ..."""
    chore = Chore(
        title="Every 7 days",
        icon_name="filter",
        claim_mode="each",
        points_value=10,
        is_repeating=True,
        is_active=True,
        n_day_interval=7,
        created_at=datetime(2025, 5, 1),
    )
    assert _matches_day(chore, date(2025, 5, 1))   # day 0
    assert _matches_day(chore, date(2025, 5, 8))   # day 7
    assert _matches_day(chore, date(2025, 5, 15))  # day 14


def test_every_n_days_hidden_off_schedule():
    chore = Chore(
        title="Every 7 days",
        icon_name="filter",
        claim_mode="each",
        points_value=10,
        is_repeating=True,
        is_active=True,
        n_day_interval=7,
        created_at=datetime(2025, 5, 1),
    )
    assert not _matches_day(chore, date(2025, 5, 4))   # day 3
    assert not _matches_day(chore, date(2025, 5, 6))   # day 5
    assert not _matches_day(chore, date(2025, 5, 10))  # day 9


def test_period_bounds_weekly_spans_iso_week():
    """A weekly chore's claim period covers the whole Monday-to-Monday ISO week."""
    weekly = Chore(
        title="Weekly", icon_name="brush", claim_mode="each", points_value=3,
        is_repeating=True, is_active=True, repeat_days=["Sat", "Sun"],
        created_at=datetime(2025, 1, 1),
    )
    # Saturday and the preceding Wednesday of the same ISO week share bounds.
    sat_start, sat_end = _period_bounds(weekly, date(2025, 5, 31))  # Saturday
    wed_start, wed_end = _period_bounds(weekly, date(2025, 5, 28))  # Wednesday
    assert (sat_start, sat_end) == (wed_start, wed_end)
    # The next week resolves to a different period.
    next_start, _ = _period_bounds(weekly, date(2025, 6, 7))  # following Saturday
    assert next_start != sat_start


def test_period_bounds_daily_spans_one_day():
    """A daily chore's claim period is a single day, so bounds differ day to day."""
    daily = Chore(
        title="Daily", icon_name="star", claim_mode="each", points_value=5,
        is_repeating=True, is_active=True, created_at=datetime(2025, 1, 1),
    )
    mon = _period_bounds(daily, date(2025, 5, 26))
    tue = _period_bounds(daily, date(2025, 5, 27))
    assert mon != tue


def test_weekly_chore_stays_done_until_next_week():
    """A weekly chore approved once stays 'approved' all week and resets next week."""
    db = LocalSession()
    kid = User(name="WeeklyKid", role="user", avatar_value="fox",
               pin_hash=hash_pin("1234"), current_stars=0)
    db.add(kid)
    chore = Chore(
        title="Weekly all-days", icon_name="star", claim_mode="each",
        points_value=4, is_repeating=True, is_active=True,
        repeat_days=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        created_at=datetime(2025, 1, 1),
    )
    db.add(chore)
    db.commit()
    kid_id, chore_id = kid.id, chore.id

    # Approved on Monday (timestamp stored as naive UTC; Athens Monday noon).
    db.add(HistoryLedger(
        user_id=kid_id, action_type="chore_approved", points_delta=4,
        ref_table="chore", ref_id=chore_id,
        timestamp=datetime(2025, 5, 26, 9, 0),  # Mon 12:00 Athens
    ))
    db.commit()

    # Wednesday of the same week: still approved, not available again.
    wed = chores_for_dashboard(kid_id, datetime(2025, 5, 28, 9, 0), db)
    wed_entry = next(e for e in wed if e["chore"].id == chore_id)
    assert wed_entry["status"] == "approved"

    # Next Monday: available again.
    nxt = chores_for_dashboard(kid_id, datetime(2025, 6, 2, 9, 0), db)
    nxt_entry = next(e for e in nxt if e["chore"].id == chore_id)
    assert nxt_entry["status"] == "available"
    db.close()


def test_weekly_one_mode_claimed_for_all_kids_until_next_week():
    """A weekly 'one' chore claimed by one kid shows pending to others all week."""
    db = LocalSession()
    kid_a = User(name="WeeklyA", role="user", avatar_value="fox",
                 pin_hash=hash_pin("1234"), current_stars=0)
    kid_b = User(name="WeeklyB", role="user", avatar_value="cat",
                 pin_hash=hash_pin("1234"), current_stars=0)
    db.add_all([kid_a, kid_b])
    chore = Chore(
        title="Weekly shared", icon_name="bed", claim_mode="one",
        points_value=4, is_repeating=True, is_active=True,
        repeat_days=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        created_at=datetime(2025, 1, 1),
    )
    db.add(chore)
    db.commit()
    a_id, b_id, chore_id = kid_a.id, kid_b.id, chore.id

    db.add(PendingClaim(user_id=a_id, chore_id=chore_id,
                        claimed_at=datetime(2025, 5, 26, 9, 0)))  # Mon
    db.commit()

    # Wednesday: kid B sees it as pending (taken for the week).
    wed_b = chores_for_dashboard(b_id, datetime(2025, 5, 28, 9, 0), db)
    entry = next(e for e in wed_b if e["chore"].id == chore_id)
    assert entry["status"] == "pending"
    assert entry["claimed_by"]["user_id"] == a_id
    db.close()


async def test_pending_stars_endpoint(kid_client, admin_client_p4):
    """Pending stars endpoint returns sum of unapproved claim points."""
    client, kid_id = kid_client
    admin_client = admin_client_p4

    # Create a chore via admin
    db = LocalSession()
    chore = Chore(
        title="Test Chore",
        icon_name="star",
        claim_mode="each",
        points_value=5,
        is_repeating=True,
        start_time=time(6, 0),
        window_hours=24,
        is_active=True,
    )
    db.add(chore)
    db.commit()
    chore_id = chore.id
    db.close()

    # Claim it
    resp = await client.post(f"/api/dashboard/chores/{chore_id}/claim")
    assert resp.status_code == 200

    # Check pending stars
    resp = await client.get("/api/dashboard/pending-stars")
    assert resp.status_code == 200
    data = resp.json()
    assert data["pending_stars"] == 5
    assert len(data["claims"]) == 1
    assert data["claims"][0]["chore_id"] == chore_id
    assert data["claims"][0]["points_value"] == 5


async def test_pending_stars_zero_when_no_claims(kid_client):
    """Pending stars endpoint returns 0 when no claims exist."""
    client, _ = kid_client
    resp = await client.get("/api/dashboard/pending-stars")
    assert resp.status_code == 200
    data = resp.json()
    assert data["pending_stars"] == 0
    assert len(data["claims"]) == 0


# ---------------------------------------------------------------------------
# Daily reset semantics (TODOs.md): a daily chore's claim period is a single
# Athens day (00:00 → 00:00). "each" resets per kid; "one" is taken for all
# kids until the next day once any kid claims OR completes it.
# ---------------------------------------------------------------------------


def _make_daily(claim_mode: str) -> Chore:
    """A pure daily chore: repeats every day with no time-of-day window."""
    return Chore(
        title=f"Daily {claim_mode}", icon_name="star", claim_mode=claim_mode,
        points_value=3, is_repeating=True, is_active=True,
        created_at=datetime(2025, 1, 1),
    )


def test_daily_each_resets_per_kid_next_day():
    """A daily 'each' chore approved by one kid is done for that kid today,
    available again the next day, and never blocks other kids."""
    db = LocalSession()
    kid_a = User(name="DailyA", role="user", avatar_value="fox",
                 pin_hash=hash_pin("1234"), current_stars=0)
    kid_b = User(name="DailyB", role="user", avatar_value="cat",
                 pin_hash=hash_pin("1234"), current_stars=0)
    db.add_all([kid_a, kid_b])
    chore = _make_daily("each")
    db.add(chore)
    db.commit()
    a_id, b_id, chore_id = kid_a.id, kid_b.id, chore.id

    # Kid A approved Monday (Athens noon → stored naive UTC).
    db.add(HistoryLedger(
        user_id=a_id, action_type="chore_approved", points_delta=3,
        ref_table="chore", ref_id=chore_id,
        timestamp=datetime(2025, 5, 26, 9, 0),  # Mon 12:00 Athens
    ))
    db.commit()

    # Same day: A is done, B is unaffected (independent per-kid status).
    mon_a = next(e for e in chores_for_dashboard(a_id, datetime(2025, 5, 26, 9, 0), db)
                 if e["chore"].id == chore_id)
    mon_b = next(e for e in chores_for_dashboard(b_id, datetime(2025, 5, 26, 9, 0), db)
                 if e["chore"].id == chore_id)
    assert mon_a["status"] == "approved"
    assert mon_b["status"] == "available"

    # Next day: A is available again (daily reset).
    tue_a = next(e for e in chores_for_dashboard(a_id, datetime(2025, 5, 27, 9, 0), db)
                 if e["chore"].id == chore_id)
    assert tue_a["status"] == "available"
    db.close()


def test_daily_one_mode_blocks_other_kids_then_resets_next_day():
    """A daily 'one' chore claimed by one kid is taken for everyone today and
    resets for all the next day."""
    db = LocalSession()
    kid_a = User(name="OneA", role="user", avatar_value="fox",
                 pin_hash=hash_pin("1234"), current_stars=0)
    kid_b = User(name="OneB", role="user", avatar_value="cat",
                 pin_hash=hash_pin("1234"), current_stars=0)
    db.add_all([kid_a, kid_b])
    chore = _make_daily("one")
    db.add(chore)
    db.commit()
    a_id, b_id, chore_id = kid_a.id, kid_b.id, chore.id

    # Kid A claims Monday.
    db.add(PendingClaim(user_id=a_id, chore_id=chore_id,
                        claimed_at=datetime(2025, 5, 26, 9, 0)))
    db.commit()

    # Same day: kid B sees it taken (pending) by A.
    mon_b = next(e for e in chores_for_dashboard(b_id, datetime(2025, 5, 26, 9, 0), db)
                 if e["chore"].id == chore_id)
    assert mon_b["status"] == "pending"
    assert mon_b["claimed_by"]["user_id"] == a_id

    # Next day: available again for everyone (the claim was period-scoped).
    tue_b = next(e for e in chores_for_dashboard(b_id, datetime(2025, 5, 27, 9, 0), db)
                 if e["chore"].id == chore_id)
    assert tue_b["status"] == "available"
    db.close()


def test_daily_one_mode_blocked_by_other_kids_completion():
    """A daily 'one' chore *completed* (approved) by one kid blocks others for
    the rest of the day — not just an open pending claim."""
    db = LocalSession()
    kid_a = User(name="DoneA", role="user", avatar_value="fox",
                 pin_hash=hash_pin("1234"), current_stars=0)
    kid_b = User(name="DoneB", role="user", avatar_value="cat",
                 pin_hash=hash_pin("1234"), current_stars=0)
    db.add_all([kid_a, kid_b])
    chore = _make_daily("one")
    db.add(chore)
    db.commit()
    a_id, b_id, chore_id = kid_a.id, kid_b.id, chore.id

    # Kid A's claim was already approved Monday (no open pending row remains).
    db.add(HistoryLedger(
        user_id=a_id, action_type="chore_approved", points_delta=3,
        ref_table="chore", ref_id=chore_id,
        timestamp=datetime(2025, 5, 26, 9, 0),
    ))
    db.commit()

    # Same day: kid B is blocked, sees A as the completer.
    mon_b = next(e for e in chores_for_dashboard(b_id, datetime(2025, 5, 26, 9, 0), db)
                 if e["chore"].id == chore_id)
    assert mon_b["status"] == "approved"
    assert mon_b["claimed_by"]["user_id"] == a_id

    # Next day: available again.
    tue_b = next(e for e in chores_for_dashboard(b_id, datetime(2025, 5, 27, 9, 0), db)
                 if e["chore"].id == chore_id)
    assert tue_b["status"] == "available"
    db.close()


def test_daily_chore_resets_at_athens_midnight_boundary():
    """The day boundary is Athens 00:00, not UTC midnight. A completion late on
    one Athens day must not leak into the next Athens day (Athens is UTC+3 in
    summer, so this is a genuine off-by-offset risk)."""
    db = LocalSession()
    kid = User(name="BoundaryKid", role="user", avatar_value="fox",
               pin_hash=hash_pin("1234"), current_stars=0)
    db.add(kid)
    chore = _make_daily("each")
    db.add(chore)
    db.commit()
    kid_id, chore_id = kid.id, chore.id

    # Approved at Athens 23:00 on Mon 26 May 2025. Ledger timestamps are stored
    # as naive UTC, and Athens is UTC+3 in May, so this lands at UTC 20:00.
    db.add(HistoryLedger(
        user_id=kid_id, action_type="chore_approved", points_delta=3,
        ref_table="chore", ref_id=chore_id,
        timestamp=datetime(2025, 5, 26, 20, 0),
    ))
    db.commit()

    # `chores_for_dashboard` takes `now` as Athens wall-clock time. Still
    # Monday night in Athens (23:30): the completion counts → done for the day.
    mon = next(e for e in chores_for_dashboard(kid_id, datetime(2025, 5, 26, 23, 30), db)
               if e["chore"].id == chore_id)
    assert mon["status"] == "approved"

    # Just past Athens midnight (Tue 00:30): the same completion now falls in
    # the previous Athens day, so the chore resets to available.
    tue = next(e for e in chores_for_dashboard(kid_id, datetime(2025, 5, 27, 0, 30), db)
               if e["chore"].id == chore_id)
    assert tue["status"] == "available"
    db.close()


def test_approved_ledger_uses_claim_time_not_approval_time():
    """The approved ledger row carries the *claim* time, not the approval time,
    so a chore claimed late in one period but approved in the next still buckets
    into the period it was claimed in."""
    db = LocalSession()
    admin = User(name="Parent", role="admin", avatar_value="owl",
                 pin_hash=hash_pin("1111"), current_stars=0)
    kid = User(name="ClaimTimeKid", role="user", avatar_value="fox",
               pin_hash=hash_pin("1234"), current_stars=0)
    db.add_all([admin, kid])
    chore = _make_daily("each")
    db.add(chore)
    db.commit()

    # Claimed Athens Mon 23:00 (naive UTC 20:00); approval happens "later".
    claim_time = datetime(2025, 5, 26, 20, 0)
    claim = PendingClaim(user_id=kid.id, chore_id=chore.id, claimed_at=claim_time)
    db.add(claim)
    db.commit()
    claim_id, kid_id, chore_id, admin_id = claim.id, kid.id, chore.id, admin.id

    result = approve_claim(claim_id, admin_id, db)
    db.commit()
    assert result is not None

    row = (
        db.query(HistoryLedger)
        .filter(HistoryLedger.action_type == "chore_approved",
                HistoryLedger.ref_id == chore_id)
        .one()
    )
    # Timestamp follows the claim, not `func.now()` at approval.
    assert row.timestamp == claim_time

    # And the dashboard buckets it into the Monday it was claimed.
    mon = next(e for e in chores_for_dashboard(kid_id, datetime(2025, 5, 26, 23, 30), db)
               if e["chore"].id == chore_id)
    assert mon["status"] == "approved"
    db.close()
