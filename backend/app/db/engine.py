"""SQLAlchemy engine and session configuration."""

import os
from pathlib import Path

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DB_PATH = os.getenv("DB_PATH", str(Path(__file__).parents[2] / "data" / "padelerodouleies.db"))

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    echo=False,
    connect_args={"check_same_thread": False},
)

LocalSession = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Run Alembic migrations to head."""
    from alembic.config import Config
    from alembic import command

    alembic_cfg = Config(str(Path(__file__).parents[2] / "alembic.ini"))
    command.upgrade(alembic_cfg, "head")


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a DB session."""
    session: Session = LocalSession()
    try:
        yield session
    finally:
        session.close()
