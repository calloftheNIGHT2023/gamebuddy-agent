"""Persistence and reviewed-data export tests; all databases live in tmp_path."""

import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pymongo.errors import PyMongoError

from app.api.routes import memory
from app.core.config import settings
from app.models.schemas import AnalysisResponse, FeedbackRequest, UserProfile
from app.services import ops
from app.services.local_store import LocalStore
from app.services.mongo_store import MongoStore


@pytest.fixture
def store(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "mongodb_uri", None)
    local = LocalStore(tmp_path / "memory.sqlite3")
    monkeypatch.setattr(ops, "local_store", local)
    return MongoStore(local)


@pytest.fixture
def response():
    return AnalysisResponse.model_validate({
        "summary": "Preserve resources and take the safer route.",
        "direction_prediction": {
            "current_phase": "midgame", "best_direction": "farm", "why_now": "limited resources",
            "avoid_direction": "fight", "confidence": "medium",
        },
        "tactical_advice": [], "beginner_explanation": "Save resources.",
        "risks_or_uncertainties": [], "next_steps": ["Farm"],
        "review_report": {
            "current_situation": "Behind", "likely_mistakes": [],
            "recommended_actions": ["Farm"], "longer_term_improvement": [],
        },
        "metadata": {"trace_id": "trace-reviewed-1"},
    })


def feedback(response, **kwargs):
    return FeedbackRequest(
        game="moba-postmatch-demo", question="How do I recover?", response=response,
        user_id="player-1", session_id="session-1", user_profile=UserProfile(user_id="player-1"),
        extracted_state={"gold_gap": -1000}, **kwargs,
    )


def canonical_trace(store, response, **extra):
    trace = {
        "id": response.metadata["trace_id"], "game": "moba-postmatch-demo",
        "question": "How do I recover?", "state": {"gold_gap": -1000},
        "response": response.model_dump(mode="json"), "user_profile": UserProfile(user_id="player-1").model_dump(),
        "session_id": "session-1", "task": "review", "policy_id": "builtin-v1", **extra,
    }
    store._local.put("traces", trace["id"], trace)
    return trace


def test_local_store_persists_updates_and_separates_collections(tmp_path):
    path = tmp_path / "nested" / "memory.sqlite3"
    first = LocalStore(path)
    assert not path.exists()
    first.put("traces", "a", {"text": "中文", "nested": {"ok": True}})
    first.put("traces", "b", {"order": 2})
    first.put("traces", "a", {"order": 3})
    first.put("policies", "a", {"policy": "safe"})
    reopened = LocalStore(path)
    assert reopened.get("traces", "a") == {"order": 3}
    assert reopened.get("policies", "a") == {"policy": "safe"}
    assert reopened.get("traces", "missing") is None
    assert reopened.list("traces") == [{"order": 3}, {"order": 2}]
    assert reopened.list("traces", limit=1) == [{"order": 3}]
    assert reopened.list("traces", limit=0) == []


def test_local_store_respects_data_directory_environment(tmp_path, monkeypatch):
    monkeypatch.setenv("GAMEBUDDY_DATA_DIR", str(tmp_path / "private"))
    local = LocalStore()
    assert local.path == tmp_path / "private" / "gamebuddy.sqlite3"
    assert not local.path.exists()


def test_local_store_supports_concurrent_request_writes(tmp_path):
    local = LocalStore(tmp_path / "concurrent.sqlite3")
    with ThreadPoolExecutor(max_workers=8) as workers:
        list(workers.map(lambda number: local.put("traces", str(number), {"number": number}), range(24)))
    assert {item["number"] for item in local.list("traces")} == set(range(24))


def test_profiles_history_and_feedback_survive_reopening_without_mongodb(store, response):
    profile = UserProfile(user_id="player-1", skill_level="beginner", goals=["safe play"])
    store.upsert_user_profile(profile)
    store.save_analysis_history(
        game="moba-postmatch-demo", question="How do I recover?", session_id="session-1",
        user_profile=profile, extracted_state={"gold_gap": -1000}, response=response, source="json",
    )
    store.save_feedback(feedback(response, rating="up"))
    reopened = MongoStore(LocalStore(store._local.path))
    assert not reopened.enabled
    assert reopened.load_user_profile("player-1") == profile
    merged = reopened.merge_user_profile(UserProfile(user_id="player-1", preferred_style="concise"))
    assert merged.skill_level == "beginner"
    assert merged.goals == ["safe play"]
    assert merged.preferred_style == "concise"
    history = reopened.list_analysis_history(user_id="player-1", session_id="session-1", limit=10)
    assert len(history) == 1 and history[0].response == response
    assert reopened.list_analysis_history(user_id="other-player", session_id=None, limit=10) == []
    records = reopened.list_feedback(user_id="player-1", session_id="session-1", limit=10)
    assert len(records) == 1 and records[0].rating == "up"
    assert reopened.list_feedback(user_id=None, session_id="other-session", limit=10) == []


def test_local_write_failures_are_not_reported_as_saved(store, response, monkeypatch):
    def fail(*args, **kwargs):
        raise sqlite3.OperationalError("disk unavailable")

    monkeypatch.setattr(store._local, "put", fail)
    with pytest.raises(sqlite3.OperationalError, match="disk unavailable"):
        store.save_feedback(feedback(response, rating="up"))


def test_mongodb_failure_preserves_all_local_records(store, response, monkeypatch, caplog):
    class UnavailableCollection:
        def update_one(self, *args, **kwargs):
            raise PyMongoError("offline")

        insert_one = update_one
        find = update_one
        find_one = update_one

    collection = UnavailableCollection()
    monkeypatch.setattr(settings, "mongodb_uri", "mongodb://unused-test-host")
    store._client = {settings.mongodb_database: {
        settings.mongodb_user_profiles_collection: collection,
        settings.mongodb_analysis_history_collection: collection,
        settings.mongodb_feedback_collection: collection,
    }}
    profile = UserProfile(user_id="player-1", preferred_style="concise")
    store.upsert_user_profile(profile)
    store.save_analysis_history(
        game="moba-postmatch-demo", question="Help", session_id="session-1", user_profile=profile,
        extracted_state={}, response=response, source="json",
    )
    store.save_feedback(feedback(response, rating="up"))
    assert store.load_user_profile("player-1") == profile
    assert store.load_user_profile("unknown") is None
    assert len(store.list_analysis_history(user_id=None, session_id=None, limit=10)) == 1
    assert len(store.list_feedback(user_id=None, session_id=None, limit=10)) == 1
    assert "remains saved locally" in caplog.text
    assert "using local memory" in caplog.text


def test_optional_mongodb_replication_deduplicates_and_caches_remote_records(store, response, monkeypatch):
    class Cursor(list):
        def sort(self, field, direction):
            return Cursor(sorted(self, key=lambda item: str(item[field]), reverse=direction < 0))

        def limit(self, count):
            return self[:count]

    class Collection:
        def __init__(self):
            self.documents = []

        def find(self, query, projection):
            return Cursor(item.copy() for item in self.documents
                          if all(item.get(key) == value for key, value in query.items()))

        def find_one(self, query, projection):
            return next(iter(self.find(query, projection)), None)

        def update_one(self, query, update, upsert):
            self.documents = [item for item in self.documents if item.get("user_id") != query["user_id"]]
            self.documents.append(update["$set"].copy())

        def insert_one(self, document):
            self.documents.append(document.copy())

    profiles, history, reviews = Collection(), Collection(), Collection()
    monkeypatch.setattr(settings, "mongodb_uri", "mongodb://unused-test-host")
    store._client = {settings.mongodb_database: {
        settings.mongodb_user_profiles_collection: profiles,
        settings.mongodb_analysis_history_collection: history,
        settings.mongodb_feedback_collection: reviews,
    }}
    profile = UserProfile(user_id="player-1", preferred_style="concise")
    store.upsert_user_profile(profile)
    store.save_feedback(feedback(response, rating="up"))
    assert profiles.documents[0]["preferred_style"] == "concise"
    assert len(reviews.documents) == 1
    assert len(store.list_feedback(user_id=None, session_id=None, limit=10)) == 1
    reviews.documents.append({
        **feedback(response, rating="down", correction="Review resource timing.").model_dump(mode="json"),
        "created_at": datetime(2026, 1, 1, tzinfo=UTC),
    })
    profiles.documents.append({"user_id": "remote-player", "skill_level": "advanced"})
    assert store.load_user_profile("remote-player").skill_level == "advanced"
    assert len(store.list_feedback(user_id=None, session_id=None, limit=10)) == 2
    monkeypatch.setattr(settings, "mongodb_uri", None)
    reopened = MongoStore(LocalStore(store._local.path))
    assert reopened.load_user_profile("remote-player").skill_level == "advanced"
    assert len(reopened.list_feedback(user_id=None, session_id=None, limit=10)) == 2


def test_training_export_filters_unreviewed_and_identical_answers(store, response):
    canonical_trace(store, response)
    cases = [
        {"rating": "neutral"}, {"rating": "down"}, {"rating": "down", "correction": "   "},
        {"rating": "down", "correction": response.summary},
        {"rating": "down", "correction": json.dumps(response.model_dump(mode="json"))},
        {"rating": "up"}, {"rating": "down", "correction": "  Avoid fighting until the next item.  "},
    ]
    for case in cases:
        store.save_feedback(feedback(response, **case))
    samples = store.export_training_samples(user_id="player-1", session_id="session-1", limit=50)
    assert {sample.sample_type for sample in samples} == {"sft", "preference"}
    assert len(samples) == 2
    preference = next(sample for sample in samples if sample.sample_type == "preference")
    assert preference.chosen == "Avoid fighting until the next item."
    assert preference.rejected == response
    assert preference.target == preference.chosen
    assert all(sample.metadata["trace_id"] == "trace-reviewed-1" for sample in samples)
    assert all(sample.metadata["trace_verified"] is True for sample in samples)
    assert all(sample.metadata["policy_id"] == "builtin-v1" for sample in samples)
    assert all(sample.prompt["task"] == "review" for sample in samples)
    assert all(sample.prompt["policy"]["prompt"] == ops.DEFAULT_POLICY["prompt"] for sample in samples)
    assert all(sample.metadata["data_usage"] == "local_private_development" for sample in samples)
    sft = store.export_training_samples(user_id=None, session_id=None, limit=50, sample_type="sft")
    assert len(sft) == 2 and all(sample.sample_type == "sft" for sample in sft)
    assert any(sample.target == preference.chosen for sample in sft)
    pairs = store.export_training_samples(user_id=None, session_id=None, limit=50, sample_type="preference")
    assert len(pairs) == 1 and pairs[0] == preference


def test_memory_routes_persist_and_download_filtered_jsonl(store, response, monkeypatch):
    canonical_trace(store, response)
    monkeypatch.setattr(memory, "mongo_store", store)
    app = FastAPI()
    app.include_router(memory.router, prefix="/api/v1")
    with TestClient(app) as client:
        profile = {"user_id": "player-1", "preferred_style": "concise"}
        assert client.post("/api/v1/memory/profile", json=profile).status_code == 200
        assert client.get("/api/v1/memory/profile/player-1").json()["preferred_style"] == "concise"
        for rating, correction in [("up", None), ("down", "Take the safe route."), ("neutral", None)]:
            result = client.post("/api/v1/memory/feedback", json=feedback(
                response, rating=rating, correction=correction,
            ).model_dump(mode="json"))
            assert result.status_code == 200
        result = client.get("/api/v1/memory/training-samples.jsonl", params={"sample_type": "sft"})
        assert result.status_code == 200
        assert result.headers["content-type"].startswith("application/x-ndjson")
        assert "attachment" in result.headers["content-disposition"]
        assert result.headers["cache-control"] == "no-store"
        rows = [json.loads(line) for line in result.text.splitlines()]
        assert len(rows) == 2 and all(row["sample_type"] == "sft" for row in rows)
        assert all(row["metadata"]["trace_id"] == "trace-reviewed-1" for row in rows)
        pairs = client.get("/api/v1/memory/training-samples", params={"sample_type": "preference"}).json()
        assert len(pairs) == 1 and pairs[0]["chosen"] == "Take the safe route."
        assert client.get("/api/v1/memory/training-samples.jsonl", params={"sample_type": "invalid"}).status_code == 422


def test_feedback_route_uses_trace_context_instead_of_client_claims(store, response, monkeypatch):
    trace = canonical_trace(store, response)
    monkeypatch.setattr(memory, "mongo_store", store)
    app = FastAPI()
    app.include_router(memory.router, prefix="/api/v1")
    payload = feedback(response, rating="down", correction="Review timing.", tags=["reviewed"]).model_dump(mode="json")
    payload.update({
        "game": "rpg-build-demo", "question": "forged question", "extracted_state": {"forged": True},
        "session_id": "forged-session", "user_id": "forged-user", "user_profile": {"user_id": "forged-user"},
    })
    payload["response"]["summary"] = "Forged response with a real trace_id"
    with TestClient(app) as client:
        result = client.post("/api/v1/memory/feedback", json=payload)
        assert result.status_code == 200
        saved = result.json()
        assert saved["response"] == trace["response"]
        assert saved["game"] == trace["game"] and saved["question"] == trace["question"]
        assert saved["extracted_state"] == trace["state"]
        assert saved["user_profile"] == trace["user_profile"]
        assert saved["session_id"] == trace["session_id"] and saved["user_id"] == "player-1"
        assert saved["rating"] == "down" and saved["correction"] == "Review timing." and saved["tags"] == ["reviewed"]
        exported = client.get("/api/v1/memory/training-samples").json()
        assert exported[0]["metadata"]["trace_verified"] is True
        payload["response"]["metadata"]["trace_id"] = "unknown-trace"
        assert client.post("/api/v1/memory/feedback", json=payload).status_code == 422
        assert len(store.list_feedback(user_id=None, session_id=None, limit=10)) == 1


@pytest.mark.parametrize("field", ["missing_trace", "response", "game", "question", "state", "profile", "session", "user"])
def test_unmatched_feedback_cannot_claim_verified_trace(store, response, field):
    canonical_trace(store, response)
    item = feedback(response, rating="up")
    if field == "missing_trace":
        item.response.metadata["trace_id"] = "missing-trace"
    elif field == "response":
        item.response.summary = "Tampered answer"
    elif field == "state":
        item.extracted_state = {"gold_gap": 1000}
    elif field == "profile":
        item.user_profile = UserProfile(user_id="forged-user")
    elif field == "session":
        item.session_id = "forged-session"
    elif field == "user":
        item.user_id = "forged-user"
    elif field == "game":
        item.game = "rpg-build-demo"
    else:
        item.question = "Tampered question"
    store.save_feedback(item)
    sample = store.export_training_samples(user_id=None, session_id=None, limit=10)[0]
    assert sample.metadata["trace_id"] is None
    assert sample.metadata["trace_verified"] is False
    assert sample.metadata["provenance"] == "legacy_feedback"
    assert sample.metadata["policy_id"] is None and sample.metadata["policy_verified"] is False
    assert sample.prompt["policy"] is None


def test_legacy_feedback_stays_compatible_and_explicitly_unverified(store, response, monkeypatch):
    response.metadata = {"task": "qa", "policy_id": "client-claimed-policy"}
    monkeypatch.setattr(memory, "mongo_store", store)
    app = FastAPI()
    app.include_router(memory.router, prefix="/api/v1")
    with TestClient(app) as client:
        assert client.post("/api/v1/memory/feedback", json=feedback(response, rating="up").model_dump(mode="json")).status_code == 200
    sample = store.export_training_samples(user_id=None, session_id=None, limit=10)[0]
    assert sample.metadata["trace_id"] is None and sample.metadata["trace_verified"] is False
    assert sample.metadata["provenance"] == "legacy_feedback"
    assert sample.metadata["policy_id"] is None and sample.metadata["unverified_policy_id"] == "client-claimed-policy"
    assert sample.prompt["task"] == "qa" and sample.prompt["policy"] is None


def test_verified_sample_captures_immutable_task_and_policy(store, response):
    policy = {
        "id": "policy-reviewed-1", "prompt": "Explain each expense.",
        "instructions": "Respect the budget.", "max_next_steps": 2,
    }
    store._local.put("policies", policy["id"], policy)
    canonical_trace(store, response, task="build", policy_id=policy["id"])
    store.save_feedback(feedback(response, rating="up"))
    sample = store.export_training_samples(user_id=None, session_id=None, limit=10)[0]
    assert sample.prompt["task"] == "build"
    assert sample.prompt["policy"] == policy
    assert sample.metadata["policy_id"] == policy["id"] and sample.metadata["policy_verified"] is True
