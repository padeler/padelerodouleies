"""SQLAlchemy ORM models.

All model classes are defined here so Alembic autogenerate discovers them
via Base.metadata.
"""

from datetime import datetime, time

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    JSON,
    String,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from app.db.engine import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, unique=True)
    avatar_kind = Column(String(10), nullable=False, default="icon")  # "icon" | "image"
    avatar_value = Column(String(255), nullable=False, default="user")
    pin_hash = Column(String(255), nullable=True)  # NULL for first-run before bootstrap
    role = Column(String(10), nullable=False, default="user")  # "admin" | "user"
    current_stars = Column(Integer, nullable=False, default=0)
    preferred_locale = Column(String(5), nullable=False, default="el")
    preferred_theme = Column(String(10), nullable=False, default="system")
    accent_color = Column(String(7), nullable=True)  # "#RRGGBB" — NULL uses the theme default
    birthdate = Column(Date, nullable=True)  # admin-set; drives age-targeted exercises
    failed_pin_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    history_entries = relationship("HistoryLedger", back_populates="user", foreign_keys="HistoryLedger.user_id")
    reward_entries = relationship("RewardLedger", back_populates="user")
    pending_claims = relationship("PendingClaim", back_populates="user")


class Chore(Base):
    __tablename__ = "chores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    description = Column(String(500), nullable=True)
    icon_name = Column(String(100), nullable=False)
    claim_mode = Column(String(20), nullable=False, default="each")  # "each" | "one"
    points_value = Column(Integer, nullable=False)
    is_repeating = Column(Boolean, nullable=False, default=True)
    start_time = Column(Time, nullable=True)  # NULL for one-time or flexible chores
    window_hours = Column(Integer, nullable=True)  # NULL for one-time or flexible chores
    repeat_days = Column(JSON, nullable=True)  # e.g. ["Mon", "Wed", "Fri"] — NULL means daily
    n_day_interval = Column(Integer, nullable=True)  # e.g. 7 — NULL means not used
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    pending_claims = relationship("PendingClaim", back_populates="chore")


class Reward(Base):
    __tablename__ = "rewards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    description = Column(String(500), nullable=True)
    icon_name = Column(String(100), nullable=False)
    cost_stars = Column(Integer, nullable=False)
    is_collaborative = Column(Boolean, nullable=False, default=False)
    is_enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    ledger_entries = relationship("RewardLedger", back_populates="reward")


class HistoryLedger(Base):
    """Unified ledger recording every star movement."""

    __tablename__ = "history_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action_type = Column(
        String(30),
        nullable=False,
    )  # chore_approved | chore_declined | manual_adjust | reward_purchase | reward_refund
    points_delta = Column(Integer, nullable=False)
    ref_table = Column(String(20), nullable=True)  # "chore" | "reward"
    ref_id = Column(Integer, nullable=True)
    # Admin who performed the action (e.g. approved/declined a chore). Nullable:
    # not every ledger row originates from an admin action (e.g. reward purchases).
    actor_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_note = Column(String(500), nullable=True)
    timestamp = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User", back_populates="history_entries", foreign_keys=[user_id])
    actor = relationship("User", foreign_keys=[actor_user_id])


class RewardLedger(Base):
    """Tracks individual and collaborative reward redemptions."""

    __tablename__ = "reward_ledger"

    id = Column(Integer, primary_key=True, autoincrement=True)
    reward_id = Column(Integer, ForeignKey("rewards.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String(20), nullable=False, default="claimed")  # claimed | fulfilled | refunded
    claimed_at = Column(DateTime, nullable=False, server_default=func.now())
    fulfilled_at = Column(DateTime, nullable=True)
    stars_contributed = Column(Integer, nullable=False, default=0)
    admin_note = Column(String(500), nullable=True)

    reward = relationship("Reward", back_populates="ledger_entries")
    user = relationship("User", back_populates="reward_entries")


class GameScore(Base):
    """Per-user best score for each mini-game on the Games tab.

    One row per (user, game); the games service only overwrites a row when the
    new score beats the stored best (direction depends on the game — see
    app/services/games.py). No star economy involvement.
    """

    __tablename__ = "game_scores"
    __table_args__ = (UniqueConstraint("user_id", "game", name="uq_game_scores_user_game"),)

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    game = Column(String(40), nullable=False)  # e.g. "memory.easy" | "simon" | "catcher"
    best_score = Column(Integer, nullable=False)
    updated_at = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User")


class ExerciseAttempt(Base):
    """Append-only record of every exercise answer a kid submits.

    One row per submission (right or wrong). "Progress" is always derived from
    these rows — they are never mutated — so any future star policy is
    computable retroactively. Timestamps are naive UTC, matching
    the ledger convention (see the _start_of history).
    """

    __tablename__ = "exercise_attempts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    bundle_id = Column(String(80), nullable=False)
    bundle_version = Column(Integer, nullable=False)
    exercise_id = Column(String(40), nullable=False)
    response_json = Column(JSON, nullable=False)  # the raw kid response, as posted
    correct = Column(Boolean, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User")


class ExerciseCompletion(Base):
    """Records the one-time star award for finishing a (kid, bundle, version).

    Unique on (user_id, bundle_id, bundle_version) so completion — and the star
    award — is idempotent. The history_ledger_id FK ties the star delta to its
    visible ledger row (invariant #4).
    """

    __tablename__ = "exercise_completions"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "bundle_id", "bundle_version", name="uq_exercise_completion"
        ),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    bundle_id = Column(String(80), nullable=False)
    bundle_version = Column(Integer, nullable=False)
    stars_awarded = Column(Integer, nullable=False)
    history_ledger_id = Column(Integer, ForeignKey("history_ledger.id"), nullable=True)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User")


class PendingClaim(Base):
    """Chore claims awaiting admin approval."""

    __tablename__ = "pending_claims"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    chore_id = Column(Integer, ForeignKey("chores.id"), nullable=False)
    claimed_at = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User", back_populates="pending_claims")
    chore = relationship("Chore", back_populates="pending_claims")
