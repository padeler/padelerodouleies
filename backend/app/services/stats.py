"""Statistics aggregation service.

Pure functions that roll up the append-only history ledger and reward ledger
into kid-friendly numbers for the Stats dashboard tab. Timestamps are stored as
naive UTC (see HistoryLedger.timestamp / RewardLedger.claimed_at); we convert to
Athens local time before bucketing by day / weekday / ISO-week so the numbers
match what a kid sees on the wall clock.
"""

from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.db.models import ExerciseCompletion, HistoryLedger, RewardLedger, User
from app.services.chores import TZ
from app.services.games import scores_by_user

_UTC = ZoneInfo("UTC")


def _to_local(ts: datetime) -> datetime:
    """Convert a stored naive-UTC timestamp to Athens local time."""
    aware = ts.replace(tzinfo=_UTC) if ts.tzinfo is None else ts
    return aware.astimezone(TZ)


def _kid_brief(user: User) -> dict[str, Any]:
    return {
        "id": user.id,
        "name": user.name,
        "avatar_kind": user.avatar_kind,
        "avatar_value": user.avatar_value,
    }


def _game_players(db: Session) -> list[dict[str, Any]]:
    """Best game scores for every active user, so the Stats games section is a
    whole-family scoreboard. Kids always appear; parents appear once they have
    played at least one game (keeps non-playing admins out of the list)."""
    users = db.query(User).filter(User.is_active == True).all()
    scores = scores_by_user(db, [u.id for u in users])
    players: list[dict[str, Any]] = []
    for user in users:
        user_scores = scores.get(user.id, {})
        if user.role == "user" or user_scores:
            players.append({**_kid_brief(user), "game_scores": user_scores})
    return players


def _top(counter: dict[int, int], kid_map: dict[int, User], value_key: str) -> dict[str, Any] | None:
    """Return the kid with the highest counter value, or None if all are zero.

    Ties break towards the lowest user id for deterministic output.
    """
    if not counter:
        return None
    uid, value = max(counter.items(), key=lambda kv: (kv[1], -kv[0]))
    if value <= 0:
        return None
    user = kid_map.get(uid)
    if user is None:
        return None
    return {**_kid_brief(user), value_key: value}


def _cumulative(
    history: list[HistoryLedger],
    rewards: list[RewardLedger],
    kid_map: dict[int, User],
) -> dict[str, Any]:
    """Aggregate cross-kid totals for a single time window."""
    earned_by_weekday = [0] * 7  # Monday=0 .. Sunday=6
    earned_by_kid: dict[int, int] = defaultdict(int)
    chores_by_kid: dict[int, int] = defaultdict(int)
    total_chores = 0
    total_earned = 0

    for row in history:
        if row.points_delta > 0:
            local = _to_local(row.timestamp)
            earned_by_weekday[local.weekday()] += row.points_delta
            earned_by_kid[row.user_id] += row.points_delta
            total_earned += row.points_delta
        if row.action_type == "chore_approved":
            total_chores += 1
            chores_by_kid[row.user_id] += 1

    awards_by_kid: dict[int, int] = defaultdict(int)
    total_awards = 0
    for entry in rewards:
        if entry.status in ("claimed", "fulfilled"):
            total_awards += 1
            awards_by_kid[entry.user_id] += 1

    return {
        "earned_per_weekday": [
            {"weekday": i, "stars": earned_by_weekday[i]} for i in range(7)
        ],
        "total_stars_earned": total_earned,
        "total_chores": total_chores,
        "total_awards": total_awards,
        "top_earner": _top(earned_by_kid, kid_map, "stars"),
        "top_chorer": _top(chores_by_kid, kid_map, "count"),
        "top_buyer": _top(awards_by_kid, kid_map, "count"),
    }


def _exercise_stats_by_user(db: Session, user_ids: list[int]) -> dict[int, tuple[int, int]]:
    """Per-kid (completed bundle count, total stars earned) from completions.

    Same rollup the admin exercises view uses, surfaced for the kid Stats tab.
    """
    result: dict[int, tuple[int, int]] = {}
    if not user_ids:
        return result
    rows = (
        db.query(ExerciseCompletion.user_id, ExerciseCompletion.stars_awarded)
        .filter(ExerciseCompletion.user_id.in_(user_ids))
        .all()
    )
    for uid, stars in rows:
        count, total = result.get(uid, (0, 0))
        result[uid] = (count + 1, total + stars)
    return result


def _per_kid(
    history: list[HistoryLedger],
    kids: list[User],
    game_scores: dict[int, dict[str, int]],
    exercise_stats: dict[int, tuple[int, int]],
) -> list[dict[str, Any]]:
    """Per-kid all-time totals plus best day / best week."""
    earned: dict[int, int] = defaultdict(int)
    spent: dict[int, int] = defaultdict(int)
    by_day: dict[int, dict[date, int]] = defaultdict(lambda: defaultdict(int))
    by_week: dict[int, dict[tuple[int, int], int]] = defaultdict(lambda: defaultdict(int))

    for row in history:
        if row.points_delta > 0:
            local = _to_local(row.timestamp)
            earned[row.user_id] += row.points_delta
            by_day[row.user_id][local.date()] += row.points_delta
            iso = local.isocalendar()
            by_week[row.user_id][(iso.year, iso.week)] += row.points_delta
        elif row.points_delta < 0:
            spent[row.user_id] += -row.points_delta

    result: list[dict[str, Any]] = []
    for kid in kids:
        days = by_day.get(kid.id, {})
        weeks = by_week.get(kid.id, {})

        best_day = None
        if days:
            d, stars = max(days.items(), key=lambda kv: kv[1])
            best_day = {"date": d.isoformat(), "stars": stars}

        best_week = None
        if weeks:
            (year, week), stars = max(weeks.items(), key=lambda kv: kv[1])
            week_start = date.fromisocalendar(year, week, 1)
            best_week = {"week_start": week_start.isoformat(), "stars": stars}

        ex_count, ex_stars = exercise_stats.get(kid.id, (0, 0))
        result.append({
            **_kid_brief(kid),
            "current_stars": kid.current_stars,
            "total_earned": earned.get(kid.id, 0),
            "total_spent": spent.get(kid.id, 0),
            "best_day": best_day,
            "best_week": best_week,
            "game_scores": game_scores.get(kid.id, {}),
            "exercises_completed": ex_count,
            "exercises_stars": ex_stars,
        })

    result.sort(key=lambda x: x["total_earned"], reverse=True)
    return result


def compute_stats(db: Session, now: datetime) -> dict[str, Any]:
    """Build the full stats payload: last-week + all-time windows and per-kid rows."""
    kids = db.query(User).filter(User.role == "user", User.is_active == True).all()
    kid_map = {kid.id: kid for kid in kids}
    kid_ids = list(kid_map.keys())

    if not kid_ids:
        empty = _cumulative([], [], kid_map)
        return {"window_week": empty, "window_all": empty, "per_kid": [], "game_players": _game_players(db)}

    history = db.query(HistoryLedger).filter(HistoryLedger.user_id.in_(kid_ids)).all()
    rewards = db.query(RewardLedger).filter(RewardLedger.user_id.in_(kid_ids)).all()

    now_utc = now.astimezone(_UTC).replace(tzinfo=None)
    week_cutoff = now_utc - timedelta(days=7)
    week_history = [r for r in history if r.timestamp >= week_cutoff]
    week_rewards = [e for e in rewards if e.claimed_at >= week_cutoff]

    return {
        "window_week": _cumulative(week_history, week_rewards, kid_map),
        "window_all": _cumulative(history, rewards, kid_map),
        "per_kid": _per_kid(
            history,
            kids,
            scores_by_user(db, kid_ids),
            _exercise_stats_by_user(db, kid_ids),
        ),
        "game_players": _game_players(db),
    }
