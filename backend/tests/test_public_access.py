"""Production defaults: stateless public answers and a private operator API."""

import asyncio
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import Settings, settings
from app.main import app
from app.security import RequestBodyLimitMiddleware
from app.services import openrouter_client as llm
from app.services.local_store import local_store
from app.services.mongo_store import mongo_store
from app.services.runtime import public_request
from app.services.tools import ToolRuntimeContext, execute_tool_call


client = TestClient(app)
ADMIN_TOKEN = "test-private-operator-secret"
AUTH = {"Authorization": f"Bearer {ADMIN_TOKEN}"}


@pytest.fixture(autouse=True)
def production_defaults(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "admin_token", SecretStr(ADMIN_TOKEN))
    monkeypatch.setattr(settings, "storage_durability", None)
    monkeypatch.setattr(settings, "max_request_bytes", 256 * 1024)
    marker = public_request.set(False)
    yield
    public_request.reset(marker)


def sample():
    return json.loads((Path(__file__).resolve().parents[2] / "samples/game-states/moba-comeback-window.json").read_text(encoding="utf-8"))


def state_request(**updates):
    return {"game": "moba-postmatch-demo", "question": "Review objective setup", "state": sample(), **updates}


@pytest.mark.parametrize("method,path,payload", [
    ("GET", "/api/v1/ops/summary", None),
    ("GET", "/api/v1/ops/traces", None),
    ("GET", "/api/v1/ops/traces/unknown", None),
    ("GET", "/api/v1/ops/policies", None),
    ("GET", "/api/v1/ops/evaluations", None),
    ("GET", "/api/v1/memory/profile/victim", None),
    ("GET", "/api/v1/memory/history", None),
    ("GET", "/api/v1/memory/feedback", None),
    ("GET", "/api/v1/memory/training-samples", None),
    ("GET", "/api/v1/memory/training-samples.jsonl", None),
    ("POST", "/api/v1/memory/profile", {"user_id": "victim"}),
    ("POST", "/api/v1/memory/feedback", {}),
    ("POST", "/api/v1/ops/policies", {"name": "Untrusted", "prompt": "Untrusted"}),
    ("POST", "/api/v1/ops/policies/builtin-v1/activate", {}),
    ("POST", "/api/v1/ops/evaluations", {}),
    ("POST", "/api/v1/ops/traces/unknown/feedback", {"rating": "up"}),
])
def test_private_routes_require_operator_authentication(method, path, payload):
    response = client.request(method, path, json=payload) if payload is not None else client.request(method, path)
    assert response.status_code == 401, response.text
    assert response.headers["www-authenticate"] == "Bearer"
    assert ADMIN_TOKEN not in response.text


def test_missing_operator_configuration_disables_private_routes(monkeypatch):
    monkeypatch.setattr(settings, "admin_token", None)
    response = client.get("/api/v1/ops/summary")
    assert response.status_code == 503
    assert "not configured" in response.json()["detail"]
    assert client.get("/api/v1/memory/history", headers=AUTH).status_code == 503
    assert client.post("/api/v1/assistant", json={"question": "什么是视野？"}).status_code == 200


@pytest.mark.parametrize("authorization", ["Bearer wrong-token", "Basic anything", "Bearer", "Bearer "])
def test_invalid_credentials_do_not_unlock_any_path(authorization):
    headers = {"Authorization": authorization}
    assert client.get("/api/v1/ops/policies", headers=headers).status_code == 401
    assert client.post("/api/v1/assistant", headers=headers, json={"question": "What is vision?"}).status_code == 401


def test_anonymous_analysis_never_reads_or_writes_private_store_or_calls_provider(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("Anonymous analysis touched private storage or an external provider")

    for method in ("get", "list", "put"):
        monkeypatch.setattr(local_store, method, forbidden)
    for method in ("merge_user_profile", "upsert_user_profile", "save_analysis_history"):
        monkeypatch.setattr(mongo_store, method, forbidden)
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "configured-but-private-key")
    monkeypatch.setattr(llm.httpx, "Client", forbidden)
    supplied_profile = {"user_id": "victim", "skill_level": "beginner", "goals": ["temporary request goal"]}
    requests = [
        ("/api/v1/analyze/state", state_request(user_profile=supplied_profile, session_id="victim-session")),
        ("/api/v1/assistant", {"game": "moba-postmatch-demo", "task": "qa", "question": "What is face-check?", "user_profile": supplied_profile}),
        ("/api/v1/assistant", {**state_request(user_profile=supplied_profile), "task": "review"}),
    ]
    for path, payload in requests:
        response = client.post(path, json=payload)
        assert response.status_code == 200, response.text
        analysis = response.json().get("analysis", response.json())
        metadata = analysis["metadata"]
        assert metadata["policy_id"] == "builtin-v1"
        assert metadata["llm_status"] == "disabled"
        assert metadata["llm_disabled_reason"] == "public_request"
        assert "eval_offline" not in metadata
        assert "configured-but-private-key" not in response.text
        assert "victim" not in response.text
        assert public_request.get() is False


def test_public_profile_tool_uses_only_request_preferences(monkeypatch):
    from app.models.schemas import UserProfile
    from app.services.assistant import qa_draft

    monkeypatch.setattr(mongo_store, "merge_user_profile", lambda *args, **kwargs: pytest.fail("Public tool read private memory"))
    profile = UserProfile(user_id=None, skill_level="beginner", goals=["temporary goal"])
    context = ToolRuntimeContext(game="moba-postmatch-demo", question="What is vision?", extracted_state={}, heuristic=qa_draft("moba-postmatch-demo", "What is vision?"), user_profile=profile)
    marker = public_request.set(True)
    try:
        result = execute_tool_call("get_user_profile", {}, context)
    finally:
        public_request.reset(marker)
    assert result["ok"] is True
    assert result["user_id"] is None
    assert result["goals"] == ["temporary goal"]


def test_anonymous_cannot_select_a_private_policy(monkeypatch):
    monkeypatch.setattr(local_store, "get", lambda *args, **kwargs: pytest.fail("Public policy selector read private storage"))
    for path, payload in [
        ("/api/v1/analyze/state", state_request(policy_id="policy-private")),
        ("/api/v1/assistant", {"question": "What is vision?", "policy_id": "policy-private"}),
    ]:
        response = client.post(path, json=payload)
        assert response.status_code == 403
        assert "built-in public policy" in response.json()["detail"]


def test_admin_retains_profiles_policies_traces_and_personalization():
    profile = client.post("/api/v1/memory/profile", headers=AUTH, json={"user_id": "private-user", "skill_level": "beginner", "goals": ["private improvement goal"]})
    assert profile.status_code == 200
    assert client.get("/api/v1/memory/profile/private-user", headers=AUTH).json()["goals"] == ["private improvement goal"]
    policy = client.post("/api/v1/ops/policies", headers=AUTH, json={"name": "Private operator policy", "prompt": "Coach carefully", "max_next_steps": 1}).json()
    assert client.post(f"/api/v1/ops/policies/{policy['id']}/activate", headers=AUTH).status_code == 200
    response = client.post("/api/v1/analyze/state", headers=AUTH, json=state_request(user_profile={"user_id": "private-user"}))
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["metadata"]["policy_id"] == policy["id"]
    assert body["metadata"]["llm_disabled_reason"] == "not_configured"
    trace = client.get(f"/api/v1/ops/traces/{body['metadata']['trace_id']}", headers=AUTH).json()
    assert trace["user_profile"]["user_id"] == "private-user"
    assert trace["user_profile"]["goals"] == ["private improvement goal"]
    assert client.get("/api/v1/memory/history", headers=AUTH).json()
    # The active private policy must not become the anonymous default.
    anonymous = client.post("/api/v1/analyze/state", json=state_request(user_profile={"user_id": "private-user"}))
    assert anonymous.status_code == 200
    assert anonymous.json()["metadata"]["policy_id"] == "builtin-v1"
    assert len(anonymous.json()["next_steps"]) > 1
    assert "private improvement goal" not in anonymous.text
    assert client.get("/api/v1/ops/summary", headers=AUTH).json()["total_requests"] == 1


def test_local_development_stays_compatible(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "admin_token", None)
    assert client.get("/api/v1/ops/summary").status_code == 200
    profile = client.post("/api/v1/memory/profile", json={"user_id": "local-player", "skill_level": "beginner"})
    assert profile.status_code == 200
    response = client.post("/api/v1/analyze/state", json=state_request(user_profile={"user_id": "local-player"}))
    assert response.status_code == 200
    assert response.json()["metadata"]["llm_disabled_reason"] == "not_configured"
    assert client.get("/api/v1/ops/summary").json()["total_requests"] == 1
    assert client.get("/health").json() == {"status": "ok", "mode": "local", "private_access": "local", "storage": "persistent"}


def test_health_reports_explicit_deployment_mode_without_secrets(monkeypatch):
    assert client.get("/health").json() == {"status": "ok", "mode": "public", "private_access": "configured", "storage": "ephemeral"}
    monkeypatch.setattr(settings, "mongodb_uri", "mongodb://not-used-by-health")
    assert client.get("/health").json()["storage"] == "ephemeral"
    monkeypatch.setattr(settings, "storage_durability", "persistent")
    monkeypatch.setattr(settings, "admin_token", None)
    health = client.get("/health")
    assert health.json()["storage"] == "persistent"
    assert health.json()["private_access"] == "disabled"
    assert ADMIN_TOKEN not in health.text


def test_public_screenshot_is_explicitly_private_but_admin_multipart_still_works():
    options = {"data": {"question": "Help", "game": "moba-postmatch-demo"}, "files": {"file": ("demo.png", b"fake image", "image/png")}}
    assert client.post("/api/v1/analyze/screenshot", **options).status_code == 403
    admin = client.post("/api/v1/analyze/screenshot", headers=AUTH, **options)
    assert admin.status_code == 200, admin.text
    assert admin.json()["metadata"]["game"] == "moba-postmatch-demo"


def test_content_length_limit_has_cors_and_does_not_parse_large_body():
    response = client.post("/api/v1/assistant", content=b"x" * (settings.max_request_bytes + 1), headers={"Content-Type": "application/json", "Origin": "http://localhost:3000"})
    assert response.status_code == 413
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_actual_received_bytes_limit_cannot_be_bypassed_with_small_content_length():
    response = client.post("/api/v1/assistant", content=b"x" * (settings.max_request_bytes + 1), headers={"Content-Type": "application/json", "Content-Length": "1"})
    assert response.status_code == 413


def test_chunked_stream_limit_counts_all_chunks_without_content_length():
    calls = []
    sent = []
    messages = iter([
        {"type": "http.request", "body": b"a" * 150_000, "more_body": True},
        {"type": "http.request", "body": b"b" * 150_000, "more_body": False},
    ])

    async def application(scope, receive, send):
        calls.append(True)

    async def receive():
        return next(messages)

    async def send(message):
        sent.append(message)

    asyncio.run(RequestBodyLimitMiddleware(application)({"type": "http", "method": "POST", "path": "/api/v1/assistant", "headers": []}, receive, send))
    assert calls == []
    assert sent[0]["status"] == 413


def test_settings_mask_the_private_token_and_have_mode_aware_storage_defaults():
    public = Settings(_env_file=None, GAMEBUDDY_ENV="production", GAMEBUDDY_ADMIN_TOKEN=ADMIN_TOKEN)
    local = Settings(_env_file=None, GAMEBUDDY_ENV="development")
    assert ADMIN_TOKEN not in repr(public)
    assert public.effective_storage_durability == "ephemeral"
    assert local.effective_storage_durability == "persistent"
