"""Back up the SQLite database to a portable JSON dump.

Usage:
    cd backend && python scripts/backup_db.py [output.json]

If no path is given, writes to ./backup-<UTC-timestamp>.json. The dump captures
every row of every table (including PIN hashes and the append-only ledger) so it
can be restored verbatim with restore_db.py. Datetimes/times are serialized as
ISO-8601 strings; JSON columns are kept as-is.
"""

import json
import sys
from datetime import datetime, time, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.db.engine import LocalSession
from app.db.models import (
    Chore,
    HistoryLedger,
    PendingClaim,
    Reward,
    RewardLedger,
    User,
)

# Order matters for restore (parents before children); backup follows the same order.
MODELS = [User, Chore, Reward, HistoryLedger, RewardLedger, PendingClaim]

DUMP_VERSION = 1


def _serialize_value(value: object) -> object:
    """Convert a column value into a JSON-safe representation."""
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, time):
        return value.isoformat()
    return value


def _serialize_row(row: object) -> dict[str, object]:
    table = row.__table__  # type: ignore[attr-defined]
    return {col.name: _serialize_value(getattr(row, col.name)) for col in table.columns}


def backup(output_path: Path) -> None:
    db = LocalSession()
    try:
        tables: dict[str, list[dict[str, object]]] = {}
        total = 0
        for model in MODELS:
            rows = db.query(model).all()
            tables[model.__tablename__] = [_serialize_row(r) for r in rows]
            count = len(rows)
            total += count
            print(f"[backup] {model.__tablename__}: {count} rows")
        dump = {
            "version": DUMP_VERSION,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "tables": tables,
        }
    finally:
        db.close()

    output_path.write_text(json.dumps(dump, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[backup] Wrote {total} rows across {len(MODELS)} tables to {output_path}")


def main() -> None:
    if len(sys.argv) > 1:
        output_path = Path(sys.argv[1])
    else:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        output_path = Path(f"backup-{stamp}.json")
    backup(output_path)


if __name__ == "__main__":
    main()
