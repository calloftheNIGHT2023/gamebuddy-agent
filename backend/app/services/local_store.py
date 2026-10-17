"""SQLite persistence for local, private development data.

The database is created on first use. An explicit ``path`` names a SQLite file.
"""

import json
import os
import sqlite3
from contextlib import closing
from pathlib import Path
from time import time_ns
from typing import Any


class LocalStore:
    def __init__(self, path: str | Path | None = None) -> None:
        data_dir = Path(os.environ.get("GAMEBUDDY_DATA_DIR") or Path(__file__).resolve().parents[2] / "data")
        self.path = Path(path) if path is not None else data_dir / "gamebuddy.sqlite3"

    def _connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path, timeout=10)
        connection.execute(
            "CREATE TABLE IF NOT EXISTS records ("
            "collection TEXT NOT NULL, record_key TEXT NOT NULL, payload TEXT NOT NULL, "
            "updated_at INTEGER NOT NULL, PRIMARY KEY (collection, record_key))"
        )
        return connection

    def put(self, collection: str, key: str, payload: dict[str, Any]) -> None:
        serialized = json.dumps(payload, ensure_ascii=False, allow_nan=False)
        with closing(self._connect()) as connection, connection:
            connection.execute(
                "INSERT INTO records (collection, record_key, payload, updated_at) VALUES (?, ?, ?, ?) "
                "ON CONFLICT(collection, record_key) DO UPDATE SET "
                "payload = excluded.payload, updated_at = excluded.updated_at",
                (collection, key, serialized, time_ns()),
            )

    def get(self, collection: str, key: str) -> dict[str, Any] | None:
        with closing(self._connect()) as connection:
            row = connection.execute(
                "SELECT payload FROM records WHERE collection = ? AND record_key = ?", (collection, key)
            ).fetchone()
        return json.loads(row[0]) if row else None

    def list(self, collection: str, limit: int = 1000) -> list[dict[str, Any]]:
        if limit <= 0:
            return []
        with closing(self._connect()) as connection:
            rows = connection.execute(
                "SELECT payload FROM records WHERE collection = ? "
                "ORDER BY updated_at DESC, record_key DESC LIMIT ?",
                (collection, limit),
            ).fetchall()
        return [json.loads(row[0]) for row in rows]


local_store = LocalStore()
