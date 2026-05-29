"""Restore the database from a JSON dump produced by backup_db.py.

Usage:
    cd backend && python scripts/restore_db.py <dump.json> [--force]

Runs migrations to head, then DELETES all existing rows and reinserts the dump
verbatim (primary keys preserved). This is destructive: pass --force to skip the
confirmation prompt (e.g. in scripts). Datetimes/times are parsed back from their
ISO-8601 strings based on each column's declared type.
"""

import json
import sys
from datetime import datetime, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from sqlalchemy import DateTime, Time

from app.db.engine import LocalSession, init_db
from app.db.models import (
    Chore,
    HistoryLedger,
    PendingClaim,
    Reward,
    RewardLedger,
    User,
)

# Parents before children for insert; reverse for the wipe.
MODELS = [User, Chore, Reward, HistoryLedger, RewardLedger, PendingClaim]

DUMP_VERSION = 1


def _deserialize_row(model: type, raw: dict[str, object]) -> object:
    """Reconstruct a model instance, parsing datetime/time columns from ISO strings."""
    columns = {col.name: col for col in model.__table__.columns}  # type: ignore[attr-defined]
    kwargs: dict[str, object] = {}
    for name, value in raw.items():
        if name not in columns:
            raise KeyError(f"Column '{name}' not found on {model.__tablename__}")
        col_type = columns[name].type
        if value is not None and isinstance(col_type, DateTime):
            kwargs[name] = datetime.fromisoformat(str(value))
        elif value is not None and isinstance(col_type, Time):
            kwargs[name] = time.fromisoformat(str(value))
        else:
            kwargs[name] = value
    return model(**kwargs)


def restore(dump_path: Path) -> None:
    dump = json.loads(dump_path.read_text(encoding="utf-8"))
    version = dump.get("version")
    if version != DUMP_VERSION:
        raise ValueError(f"Unsupported dump version {version!r}; expected {DUMP_VERSION}")
    tables = dump["tables"]

    init_db()  # ensure schema is at head before loading

    db = LocalSession()
    try:
        # Wipe in reverse FK order.
        for model in reversed(MODELS):
            db.query(model).delete()
        db.flush()

        total = 0
        for model in MODELS:
            rows = tables.get(model.__tablename__, [])
            for raw in rows:
                db.add(_deserialize_row(model, raw))
            total += len(rows)
            print(f"[restore] {model.__tablename__}: {len(rows)} rows")
        db.commit()
        print(f"[restore] Restored {total} rows across {len(MODELS)} tables from {dump_path}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--force"]
    force = "--force" in sys.argv[1:]
    if not args:
        raise SystemExit("Usage: python scripts/restore_db.py <dump.json> [--force]")
    dump_path = Path(args[0])
    if not dump_path.is_file():
        raise SystemExit(f"Dump file not found: {dump_path}")

    if not force:
        answer = input("This will DELETE all current data and replace it. Type 'yes' to continue: ")
        if answer.strip().lower() != "yes":
            raise SystemExit("Aborted.")

    restore(dump_path)


if __name__ == "__main__":
    main()
