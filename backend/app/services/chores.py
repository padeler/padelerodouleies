"""Chore visibility engine — pure functions for computing active chores with claim status."""

from datetime import date, datetime, time, timedelta
from typing import Literal

from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.db.models import Chore, HistoryLedger, PendingClaim, User

TZ = ZoneInfo("Europe/Athens")

ClaimStatus = Literal["available", "pending", "approved"]


def chores_for_dashboard(user_id: int, now: datetime, db: Session) -> list[dict]:
    """Return all in-window chores for today with claim status for the given user.

    Each entry contains:
      - chore: Chore ORM object
      - status: "available" | "pending" | "approved"
      - claimed_by: None or {"user_id", "name", "avatar_kind", "avatar_value"}

    For claim_mode="each": status reflects this user's own claim state.
    For claim_mode="one": status reflects any user's claim state (first-come-first-served).
    """
    local_now = now.replace(tzinfo=TZ) if now.tzinfo is None else now.astimezone(TZ)
    today = local_now.date()
    now_time = local_now.time()

    active = (
        db.query(Chore)
        .filter(Chore.is_active == True, Chore.is_repeating == True)
        .all()
    )

    result: list[dict] = []
    for chore in active:
        if not _matches_day(chore, today):
            continue
        if not _is_in_window(chore.start_time, chore.window_hours, today, now_time):
            continue
        status, claimed_by = _get_claim_status(chore, user_id, today, db)
        result.append({"chore": chore, "status": status, "claimed_by": claimed_by})

    return result


def chore_is_available_for(user_id: int, chore: Chore, now: datetime, db: Session) -> bool:
    """Return True if the chore is claimable by this user right now."""
    local_now = now.replace(tzinfo=TZ) if now.tzinfo is None else now.astimezone(TZ)
    today = local_now.date()
    now_time = local_now.time()

    if not chore.is_active or not chore.is_repeating:
        return False
    if not _matches_day(chore, today):
        return False
    if not _is_in_window(chore.start_time, chore.window_hours, today, now_time):
        return False
    status, _ = _get_claim_status(chore, user_id, today, db)
    return status == "available"


def _get_claim_status(
    chore: Chore, user_id: int, today: date, db: Session
) -> tuple[ClaimStatus, dict | None]:
    """Return (status, claimed_by_info) for the given chore and user.

    For claim_mode="one": checks any user's claim (first-come-first-served).
    For claim_mode="each": checks only this user's claim.

    The claim period spans the whole ISO week for weekly chores (so a weekly
    chore done once stays "done" until the next week) and a single day for
    daily / n-day chores.
    """
    day_start, day_end = _period_bounds(chore, today)

    if chore.claim_mode == "one":
        pending = (
            db.query(PendingClaim)
            .filter(
                PendingClaim.chore_id == chore.id,
                PendingClaim.claimed_at >= day_start,
                PendingClaim.claimed_at < day_end,
            )
            .first()
        )
        if pending:
            claimer = db.query(User).filter(User.id == pending.user_id).first()
            return "pending", _user_info(claimer) if claimer else None

        approved = (
            db.query(HistoryLedger)
            .filter(
                HistoryLedger.ref_table == "chore",
                HistoryLedger.ref_id == chore.id,
                HistoryLedger.action_type == "chore_approved",
                HistoryLedger.timestamp >= day_start,
                HistoryLedger.timestamp < day_end,
            )
            .first()
        )
        if approved:
            claimer = db.query(User).filter(User.id == approved.user_id).first()
            return "approved", _user_info(claimer) if claimer else None

        return "available", None

    else:  # each
        pending = (
            db.query(PendingClaim)
            .filter(
                PendingClaim.chore_id == chore.id,
                PendingClaim.user_id == user_id,
                PendingClaim.claimed_at >= day_start,
                PendingClaim.claimed_at < day_end,
            )
            .first()
        )
        if pending:
            claimer = db.query(User).filter(User.id == pending.user_id).first()
            return "pending", _user_info(claimer) if claimer else None

        approved = (
            db.query(HistoryLedger)
            .filter(
                HistoryLedger.ref_table == "chore",
                HistoryLedger.ref_id == chore.id,
                HistoryLedger.user_id == user_id,
                HistoryLedger.action_type == "chore_approved",
                HistoryLedger.timestamp >= day_start,
                HistoryLedger.timestamp < day_end,
            )
            .first()
        )
        if approved:
            claimer = db.query(User).filter(User.id == approved.user_id).first()
            return "approved", _user_info(claimer) if claimer else None

        return "available", None


def _user_info(user: User) -> dict:
    return {
        "user_id": user.id,
        "name": user.name,
        "avatar_kind": user.avatar_kind,
        "avatar_value": user.avatar_value,
    }


def _is_in_window(start: time | None, window: int | None, today: date, now: time) -> bool:
    """Check whether `now` falls inside [start, start + window_hours) on `today`, allowing wrap past midnight."""
    if start is None and window is None:
        return True
    if start is None or window is None:
        return False
    from datetime import datetime as _dt

    window_start = _dt.combine(today, start).replace(tzinfo=TZ)
    window_end = window_start + timedelta(hours=window)
    now_dt = _dt.combine(today, now).replace(tzinfo=TZ)

    if now_dt < window_start:
        yesterday = today - timedelta(days=1)
        window_start = _dt.combine(yesterday, start).replace(tzinfo=TZ)
        window_end = window_start + timedelta(hours=window)

    return window_start <= now_dt < window_end


def _is_weekly(chore: Chore) -> bool:
    """A chore is weekly when it targets specific weekdays (repeat_days set)."""
    return chore.repeat_days is not None and len(chore.repeat_days) > 0


def _period_bounds(chore: Chore, today: date) -> tuple[datetime, datetime]:
    """Return the [start, end) claim period for the chore as naive-UTC datetimes.

    Weekly chores claim once per ISO week (Monday-to-Monday), so a completed
    weekly chore stays "done" for the rest of that week and only reappears the
    following week. All other chores claim once per day.
    """
    if _is_weekly(chore):
        week_start = today - timedelta(days=today.weekday())  # Monday of this week
        return _start_of(week_start), _start_of(week_start + timedelta(days=7))
    return _start_of(today), _start_of(today + timedelta(days=1))


def _matches_day(chore: Chore, today: date) -> bool:
    """Check if today is a valid day for this chore's recurrence pattern."""
    if chore.n_day_interval is not None and chore.n_day_interval > 0:
        days_since = (today - chore.created_at.date()).days
        return days_since % chore.n_day_interval == 0
    if chore.repeat_days is not None and len(chore.repeat_days) > 0:
        weekday_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        today_name = weekday_names[today.weekday()]
        return today_name in chore.repeat_days
    return True


def _start_of(d: date) -> datetime:
    """Return Athens midnight for date d as a naive UTC datetime (for SQLite comparison)."""
    from zoneinfo import ZoneInfo
    athens_midnight = datetime.combine(d, time.min).replace(tzinfo=TZ)
    return athens_midnight.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
