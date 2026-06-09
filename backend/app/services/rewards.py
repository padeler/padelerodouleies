"""Reward redemption rules.

Individual rewards are redeemable at most once per kid per calendar day (Athens
local time) — a kid cannot, e.g., claim two ice-creams the same day even with
enough stars. Collaborative rewards are unaffected (they pool over time).
"""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.db.models import RewardLedger

TZ = ZoneInfo("Europe/Athens")
UTC = ZoneInfo("UTC")


def _athens_day_bounds_utc(now: datetime) -> tuple[datetime, datetime]:
    """Return [start, end) of the Athens day containing `now` as naive-UTC datetimes.

    A naive `now` is treated as UTC (matching how `RewardLedger.claimed_at` is
    stored — SQLite `CURRENT_TIMESTAMP`); an aware `now` is converted. The
    boundary is Athens local midnight, so the daily limit resets at midnight in
    the single locale this app runs in. The returned bounds are naive UTC so they
    compare directly against the stored `claimed_at` values.
    """
    local = (now.replace(tzinfo=UTC) if now.tzinfo is None else now).astimezone(TZ)
    start_local = datetime.combine(local.date(), time.min).replace(tzinfo=TZ)
    end_local = start_local + timedelta(days=1)
    return (
        start_local.astimezone(UTC).replace(tzinfo=None),
        end_local.astimezone(UTC).replace(tzinfo=None),
    )


def redeemed_today(db: Session, user_id: int, reward_id: int, now: datetime) -> bool:
    """True if the user already redeemed this individual reward in today's Athens day."""
    start, end = _athens_day_bounds_utc(now)
    existing = (
        db.query(RewardLedger)
        .filter(
            RewardLedger.reward_id == reward_id,
            RewardLedger.user_id == user_id,
            RewardLedger.claimed_at >= start,
            RewardLedger.claimed_at < end,
        )
        .first()
    )
    return existing is not None


def next_reset_at_iso(now: datetime) -> str:
    """ISO timestamp (UTC) of the next Athens midnight — when a redeemed reward frees up."""
    _, end = _athens_day_bounds_utc(now)
    return end.replace(tzinfo=UTC).isoformat()
