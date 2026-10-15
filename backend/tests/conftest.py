"""Every test is offline and writes to an isolated temporary database."""

import pytest


@pytest.fixture(autouse=True)
def isolated_runtime(tmp_path, monkeypatch):
    from app.core.config import settings
    from app.services.local_store import local_store
    from app.services.mongo_store import mongo_store

    monkeypatch.setattr(local_store, "path", tmp_path / "test.sqlite3")
    monkeypatch.setattr(mongo_store, "_local", local_store)
    monkeypatch.setattr(settings, "openrouter_api_key", None)
    monkeypatch.setattr(settings, "mongodb_uri", None)
