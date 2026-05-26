"""Alembic environment configuration."""

import os
from pathlib import Path

from alembic import context
from sqlalchemy import create_engine, pool

from app.db.engine import Base
from app.db.models import (  # noqa:F401 ensure models are registered with metadata
    Chore,
    HistoryLedger,
    PendingClaim,
    Reward,
    RewardLedger,
    User,
)

config = context.config

db_path = os.getenv("DB_PATH", str(Path(__file__).parents[1] / "data" / "padelerodouleies.db"))
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=f"sqlite:///{db_path}",
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = create_engine(f"sqlite:///{db_path}", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
