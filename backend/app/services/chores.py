"""Chore visibility engine — pure function for computing active chores."""

from datetime import date, datetime, time, timedelta

from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Chore, HistoryLedger, PendingClaim

TZ = ZoneInfo("Europe/Athens")


def visible_chores_for(user_id: int, now: datetime, db: Session) -> list[Chore]:
    """Return chores visible to the user right now.

    A chore is visible when:
    - it is active and repeating,
    - the current local time falls inside today's window (start_time .. start_time + window_hours),
      or the chore has no time window set (visible all day),
    - no one (pooled) or the user (individual) has already claimed or been approved for this window.
    """
    local_now = now.replace(tzinfo=TZ) if now.tzinfo is None else now.astimezone(TZ)
    today = local_now.date()
    now_time = local_now.time()

    active = (
        db.query(Chore)
        .filter(Chore.is_active == True, Chore.is_repeating == True)
        .all()
    )

    result: list[Chore] = []
    for chore in active:
        if not _matches_day(chore, today):
            continue
        if not _is_in_window(chore.start_time, chore.window_hours, today, now_time):
            continue
        if _is_already_done(chore, user_id, today, db):
            continue
        result.append(chore)

    return result


def _is_in_window(start: time | None, window: int | None, today: date, now: time) -> bool:
    """Check whether `now` falls inside [start, start + window_hours) on `today`, allowing wrap past midnight."""
    if start is None and window is None:
        # No time window set → visible all day (24h window from midnight)
        return True
    if start is None or window is None:
        return False
    from datetime import datetime as _dt

    window_start = _dt.combine(today, start).replace(tzinfo=TZ)
    window_end = window_start + timedelta(hours=window)
    now_dt = _dt.combine(today, now).replace(tzinfo=TZ)

    # If now is before window_start, the window might be yesterday's wrap-around.
    if now_dt < window_start:
        yesterday = today - timedelta(days=1)
        window_start = _dt.combine(yesterday, start).replace(tzinfo=TZ)
        window_end = window_start + timedelta(hours=window)

    return window_start <= now_dt < window_end


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


def _is_already_done(chore: Chore, user_id: int, today: date, db: Session) -> bool:
    """Check whether the chore is already claimed/approved for today's window."""
    if chore.scope == "pooled":
        target_user_id = None
    else:
        target_user_id = user_id

    has_pending = False
    if target_user_id is None:
        has_pending = bool(
            db.query(PendingClaim)
            .filter(PendingClaim.chore_id == chore.id)
            .filter(PendingClaim.claimed_at >= _start_of(today))
            .filter(PendingClaim.claimed_at < _start_of(today + timedelta(days=1)))
            .first()
        )
    else:
        has_pending = bool(
            db.query(PendingClaim)
            .filter(PendingClaim.chore_id == chore.id, PendingClaim.user_id == target_user_id)
            .filter(PendingClaim.claimed_at >= _start_of(today))
            .filter(PendingClaim.claimed_at < _start_of(today + timedelta(days=1)))
            .first()
        )
    if has_pending:
        return True

    has_approved = bool(
        db.query(HistoryLedger)
        .filter(HistoryLedger.ref_table == "chore", HistoryLedger.ref_id == chore.id)
        .filter(HistoryLedger.action_type == "chore_approved")
        .filter(HistoryLedger.timestamp >= _start_of(today))
        .filter(HistoryLedger.timestamp < _start_of(today + timedelta(days=1)))
        .first()
    )
    return has_approved


def _start_of(d: date) -> datetime:
    return datetime.combine(d, time.min).replace(tzinfo=TZ)
