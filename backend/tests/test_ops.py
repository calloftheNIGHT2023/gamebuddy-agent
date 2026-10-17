import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services.local_store import LocalStore, local_store

client = TestClient(app)


def sample(name="moba-comeback-window.json"):
    return json.loads((Path(__file__).resolve().parents[2] / "samples" / "game-states" / name).read_text(encoding="utf-8"))


def analyze(**extra):
    response = client.post("/api/v1/analyze/state", json={
        "game": "moba-postmatch-demo", "state": sample(), "question": "Review objective setup", **extra,
    })
    assert response.status_code == 200, response.text
    return response.json()


def test_trace_records_real_input_sources_and_policy():
    response = analyze()
    trace = client.get(f"/api/v1/ops/traces/{response['metadata']['trace_id']}").json()
    assert trace["state"] == sample()
    assert trace["response"] == response
    assert trace["policy_id"] == "builtin-v1"
    assert {step["name"] for step in trace["steps"]} >= {"perception", "profile", "analysis", "retrieval", "llm", "persistence"}
    assert all(step["duration_ms"] >= 0 for step in trace["steps"])
    assert LocalStore(local_store.path).get("traces", trace["id"]) == trace
    summary = client.get("/api/v1/ops/summary").json()
    assert summary["total_requests"] == summary["success_count"] == 1
    assert summary["fallback_count"] == 0


def test_policy_activation_and_explicit_override_are_real():
    policy = client.post("/api/v1/ops/policies", json={
        "name": "One action", "prompt": "Ground all answers", "instructions": "Keep it concise", "max_next_steps": 1,
    }).json()
    assert client.post(f"/api/v1/ops/policies/{policy['id']}/activate").status_code == 200
    response = analyze()
    assert len(response["next_steps"]) == 1
    assert response["metadata"]["policy_id"] == policy["id"]
    default_response = analyze(policy_id="builtin-v1")
    assert len(default_response["next_steps"]) > 1
    assert default_response["metadata"]["policy_id"] == "builtin-v1"
    assert sum(policy["active"] for policy in client.get("/api/v1/ops/policies").json()) == 1


def test_hitl_annotation_exports_canonical_trace():
    response = analyze()
    trace_id = response["metadata"]["trace_id"]
    annotation = client.post(f"/api/v1/ops/traces/{trace_id}/feedback", json={
        "rating": "down", "correction": "Reset together before dragon and avoid entering unwarded river alone.", "tags": ["reviewed"],
    })
    assert annotation.status_code == 200
    assert annotation.json()["response"] == response
    exported = client.get("/api/v1/memory/training-samples.jsonl?sample_type=preference")
    assert exported.status_code == 200
    records = [json.loads(line) for line in exported.text.splitlines()]
    assert len(records) == 1
    assert records[0]["chosen"] != records[0]["rejected"]
    assert records[0]["metadata"]["trace_id"] == trace_id
    assert client.get("/api/v1/ops/summary").json()["feedback_count"] == 1


def test_qa_uses_sources_without_fabricated_snapshot():
    response = client.post("/api/v1/assistant", json={"game": "moba-postmatch-demo", "question": "什么是视野和face-check？", "task": "qa"})
    assert response.status_code == 200
    body = response.json()
    assert body["evidence_status"] == "grounded"
    assert body["sources"][0]["content"] in body["answer"]
    assert client.get(f"/api/v1/ops/traces/{body['trace_id']}").json()["state"] == {}
    unknown = client.post("/api/v1/assistant", json={"game": "moba-postmatch-demo", "question": "quantum-zxqv-unicorn"}).json()
    assert unknown["evidence_status"] == "insufficient"
    assert unknown["sources"] == []
    unrelated = client.post("/api/v1/assistant", json={"game": "moba-postmatch-demo", "question": "quantum-zxqv-unicorn", "state": sample()}).json()
    assert unrelated["evidence_status"] == "insufficient"
    assert unrelated["sources"] == []


def test_build_budget_and_review_actual_events():
    state = sample("rpg-mage-build.json")
    state["available_resources"] = {"gold": 0, "upgrade_stones": 0}
    response = client.post("/api/v1/assistant", json={"game": "rpg-build-demo", "task": "build", "question": "如何养成？", "state": state})
    assert response.status_code == 200
    assert "资源为零" in response.json()["answer"]
    state = sample()
    state["recent_events"] = ["23:40 entered river without vision"]
    body = client.post("/api/v1/assistant", json={"game": "moba-postmatch-demo", "task": "review", "question": "复盘这局", "state": state}).json()
    assert state["recent_events"][0] in body["answer"]
    assert "不能确认因果" in body["answer"]


def test_persisted_profile_changes_subsequent_request():
    client.post("/api/v1/memory/profile", json={"user_id": "returning-player", "skill_level": "beginner", "goals": ["safer setup"]})
    response = analyze(user_profile={"user_id": "returning-player"})
    assert "safest repeatable habit" in response["beginner_explanation"]
    assert "safer setup" in " ".join(response["next_steps"])


def test_invalid_inputs_and_missing_resources_are_reported():
    for state in ({}, {**sample(), "team_gold_diff": "a lot"}, {**sample(), "game_time_minutes": -1}, {**sample(), "team_gold_diff": 10**400}):
        response = client.post("/api/v1/analyze/state", json={"game": "moba-postmatch-demo", "question": "Help", "state": state})
        assert response.status_code == 422
    assert client.post("/api/v1/assistant", json={"task": "build", "question": "Help"}).status_code == 422
    assert client.post("/api/v1/assistant", json={"game": "moba-postmatch-demo", "task": "build", "question": "Help", "state": {**sample(), "available_resources": "invalid"}}).status_code == 422
    assert client.post("/api/v1/assistant", json={"question": "   "}).status_code == 422
    assert client.get("/api/v1/ops/traces/missing").status_code == 404
    assert client.post("/api/v1/ops/policies/missing/activate").status_code == 404
    assert client.post("/api/v1/analyze/state", json={"game": "moba-postmatch-demo", "question": "Help", "state": sample(), "policy_id": "missing"}).status_code == 404
    assert client.post("/api/v1/analyze/screenshot", data={"question": "Help", "user_profile_json": "not-json"}, files={"file": ("x.png", b"x", "image/png")}).status_code == 422


def test_eval_is_offline_versioned_and_does_not_pollute_requests(monkeypatch):
    import httpx

    def forbid(*args, **kwargs):
        raise AssertionError("Offline eval attempted an external request")

    monkeypatch.setattr("app.services.openrouter_client.httpx.Client", forbid)
    from app.core.config import settings
    monkeypatch.setattr(settings, "openrouter_api_key", "mock-key-not-for-network")
    response = client.post("/api/v1/ops/evaluations", json={})
    assert response.status_code == 201
    report = response.json()
    assert report["passed"] == report["total"] == 12, report
    assert report["policy_id"] == "builtin-v1"
    summary = client.get("/api/v1/ops/summary").json()
    assert summary["total_requests"] == 0
    assert summary["eval_runs"] == 1
