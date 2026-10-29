"""Real private-memory round trips, isolation, expiry, recall and provider boundary."""

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.main import app
from app.core.config import settings
from app.models.player_memory import MemoryInput
from app.models.schemas import UserProfile
from app.services import player_memory as memory_module
from app.services.local_store import LocalStore, local_store
from app.services.mongo_store import mongo_store
from app.services.player_memory import MemoryConflict, PlayerMemoryStore, player_memory, resolve_memory
from app.services.runtime import current_player_memory

client = TestClient(app)


@pytest.fixture(autouse=True)
def local_mode(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "development")
    monkeypatch.setattr(settings, "admin_token", None)


def write(**kwargs):
    payload = {"user_id": "alice", "kind": "lesson", "key": "river-vision", "game": "moba-postmatch-demo", "content": "开龙前先回城，再布置视野。", **kwargs}
    response = client.post("/api/v1/memory/items", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


def ask(question="什么是视野？", user="alice", session="new-session", game="moba-postmatch-demo"):
    response = client.post("/api/v1/assistant", json={"game": game, "question": question, "session_id": session, "user_profile": {"user_id": user}})
    assert response.status_code == 200, response.text
    return response.json()


def test_explicit_profile_preferences_survive_new_sessions_and_change_output():
    assert "已记下" in ask("记住：回答简短一点", session="first")["answer"]
    ask("记住：我主玩辅助", session="first")
    profile = client.get("/api/v1/memory/profile/alice").json()
    assert profile["preferred_style"] == "concise" and profile["favorite_role"] == "辅助"
    result = ask("What is vision?", session="second")
    assert result["analysis"]["metadata"]["memory"]["profile_fields"]["favorite_role"] == "辅助"
    assert "[1]" in result["answer"] and "[2]" not in result["answer"]
    assert current_player_memory.get() is None


def test_missing_profile_fields_inherit_but_explicit_null_and_empty_lists_clear():
    mongo_store.upsert_user_profile(UserProfile(user_id="alice", favorite_role="辅助", goals=["练视野"], notes=["提醒"]))
    inherited = mongo_store.merge_user_profile(UserProfile(user_id="alice"))
    assert inherited.favorite_role == "辅助" and inherited.goals
    response = client.patch("/api/v1/memory/profile/alice", json={"favorite_role": None, "goals": [], "notes": []})
    assert response.status_code == 200
    stored = client.get("/api/v1/memory/profile/alice").json()
    assert stored["favorite_role"] is None and stored["goals"] == stored["notes"] == []


def test_id_only_analysis_never_rewrites_loaded_profile(monkeypatch):
    mongo_store.upsert_user_profile(UserProfile(user_id="alice", goals=["global goal"]))
    write(kind="goal", key="current_goal", content="只在 MOBA 练视野")
    monkeypatch.setattr(mongo_store, "upsert_user_profile", lambda *args: pytest.fail("ID-only request rewrote the profile"))
    result = ask()
    assert "只在 MOBA" in result["analysis"]["metadata"]["memory"]["profile_fields"]["goals"][0]
    assert mongo_store.load_user_profile("alice").goals == ["global goal"]


def test_notes_recall_across_sessions_and_never_cross_users_or_games():
    item = write()
    result = ask("怎么准备小龙视野？", session="different")
    assert [entry["id"] for entry in result["analysis"]["metadata"]["memory"]["items"]] == [item["id"]]
    assert item["content"] in " ".join(result["analysis"]["review_report"]["longer_term_improvement"])
    assert ask(user="bob")["analysis"]["metadata"]["memory"]["items"] == []
    assert ask(game="rpg-build-demo")["analysis"]["metadata"]["memory"]["items"] == []
    assert ask("quantum-zxqv-unicorn")["analysis"]["metadata"]["memory"]["items"] == []


def test_game_specific_memory_overrides_same_global_slot():
    global_item = write(game=None, kind="goal", key="practice", content="练通用操作")
    specific = write(kind="goal", key="practice", content="练小龙视野")
    assert [item["id"] for item in player_memory.recall("alice", "moba-postmatch-demo", "goal")] == [specific["id"]]
    assert [item["id"] for item in player_memory.recall("alice", "town", "goal")] == [global_item["id"]]


def test_edits_require_current_revision_and_do_not_append_conflicting_values():
    item = write(kind="goal", key="current_goal", content="先练对线")
    payload = {"user_id": "alice", "content": "改练视野", "ttl_days": 7, "expected_revision": 1}
    edited = client.put(f"/api/v1/memory/items/{item['id']}", json=payload)
    assert edited.status_code == 200 and edited.json()["revision"] == 2
    assert client.put(f"/api/v1/memory/items/{item['id']}", json=payload).status_code == 409
    memories = client.get("/api/v1/memory/items?user_id=alice").json()
    assert len(memories) == 1 and memories[0]["content"] == "改练视野"
    assert client.put(f"/api/v1/memory/items/{item['id']}", json={**payload, "user_id": "bob"}).status_code == 404


def test_two_concurrent_editors_cannot_silently_overwrite_each_other():
    write()
    def update(number):
        try:
            return player_memory.put("alice", MemoryInput(game="moba-postmatch-demo", kind="lesson", key="river-vision", content=f"edit {number}"), 1).revision
        except MemoryConflict:
            return "conflict"
    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(update, [1, 2]))
    assert sorted(map(str, results)) == ["2", "conflict"]


def test_delete_really_removes_content_and_it_is_not_recalled_from_command_history():
    ask("记住：下地牢前留一瓶药水", game="rpg-build-demo")
    item = client.get("/api/v1/memory/items?user_id=alice").json()[0]
    assert client.delete(f"/api/v1/memory/items/{item['id']}?user_id=bob&expected_revision=1").status_code == 404
    assert client.delete(f"/api/v1/memory/items/{item['id']}?user_id=alice&expected_revision=9").status_code == 409
    deleted = client.delete(f"/api/v1/memory/items/{item['id']}?user_id=alice&expected_revision=1")
    assert deleted.status_code == 204 and deleted.content == b""
    assert player_memory.list("alice") == []
    assert ask("药水与地牢", game="rpg-build-demo")["analysis"]["metadata"]["memory"]["items"] == []


def test_expiry_removes_data_and_restart_keeps_unexpired_memory(monkeypatch):
    write(ttl_days=1)
    durable = write(key="durable", content="长期练习回城时机")
    reopened = PlayerMemoryStore(LocalStore(local_store.path))
    assert len(reopened.list("alice")) == 2
    tomorrow = (datetime.now(UTC) + timedelta(days=2)).isoformat()
    monkeypatch.setattr(memory_module, "now", lambda: tomorrow)
    assert [item.id for item in reopened.list("alice")] == [durable["id"]]
    with local_store._connect() as connection:
        assert connection.execute("SELECT COUNT(*) FROM player_memories").fetchone()[0] == 1


def test_explicit_requests_deduplicate_and_replace_current_goal():
    ask("记住：每次开龙前先回城")
    ask("记住：每次开龙前先回城")
    assert len(player_memory.list("alice")) == 1 and player_memory.list("alice")[0].revision == 1
    ask("记住：我的目标是练视野")
    ask("记住：我的目标改成练回城时机")
    goals = [item for item in player_memory.list("alice") if item.kind == "goal"]
    assert len(goals) == 1 and goals[0].content == "练回城时机" and goals[0].revision == 2


def test_ordinary_chat_and_match_state_are_not_automatically_player_traits():
    ask("这把我打野很差，金币为零，为什么？")
    assert player_memory.list("alice") == [] and mongo_store.load_user_profile("alice") is None
    ask("队友说记住：我主玩辅助")
    assert mongo_store.load_user_profile("alice") is None


def test_past_episode_recall_uses_user_events_not_generated_mistakes():
    state = json.loads((Path(__file__).resolve().parents[2] / "samples/game-states/moba-comeback-window.json").read_text(encoding="utf-8"))
    state["recent_events"] = ["23:40 河道没视野，我独自探草。"]
    response = client.post("/api/v1/assistant", json={"game": "moba-postmatch-demo", "task": "review", "question": "复盘视野", "state": state, "session_id": "old", "user_profile": {"user_id": "alice"}})
    assert response.status_code == 200
    result = ask("如何避免没视野探草？", session="new")
    episodes = result["analysis"]["metadata"]["memory"]["episodes"]
    assert len(episodes) == 1 and episodes[0]["content"] == state["recent_events"][0]
    assert ask(user="bob")["analysis"]["metadata"]["memory"]["episodes"] == []


def test_recall_has_a_fixed_item_and_character_budget():
    for number in range(12):
        write(key=f"goal-{number}", kind="goal", content="视野" * 150)
    _, context = resolve_memory(UserProfile(user_id="alice"), "moba-postmatch-demo", "视野")
    assert len(context["items"]) == 4
    assert sum(len(item["content"]) for item in context["items"] + context["episodes"]) <= 1400


def test_long_term_memory_cannot_be_sent_to_external_model(monkeypatch):
    import app.services.openrouter_client as provider
    write()
    monkeypatch.setattr(settings, "openrouter_api_key", "test-configured-key")
    monkeypatch.setattr(provider.httpx, "Client", lambda *args, **kwargs: pytest.fail("Private memory sent to provider"))
    result = ask()
    assert result["analysis"]["metadata"]["llm_disabled_reason"] == "private_memory_local_only"
    assert result["analysis"]["metadata"]["memory"]["items"]
    assert current_player_memory.get() is None


@pytest.mark.parametrize("method,path,payload", [
    ("get", "/api/v1/memory/items?user_id=alice", None),
    ("post", "/api/v1/memory/items", {"user_id": "alice", "key": "x", "content": "private"}),
    ("put", "/api/v1/memory/items/x", {"user_id": "alice", "content": "private", "expected_revision": 1}),
    ("delete", "/api/v1/memory/items/x?user_id=alice&expected_revision=1", None),
    ("patch", "/api/v1/memory/profile/alice", {"goals": []}),
])
def test_memory_management_stays_private(method, path, payload, monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "admin_token", SecretStr("private-test-token"))
    response = client.request(method, path, json=payload) if payload is not None else client.request(method, path)
    assert response.status_code == 401


def test_anonymous_requests_never_open_memory_database(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(local_store, "_connect", lambda: pytest.fail("Anonymous memory database access"))
    result = ask("记住：我主玩辅助")
    assert "memory" not in result["analysis"]["metadata"]
    assert result["analysis"]["metadata"]["llm_disabled_reason"] == "public_request"


def test_sql_filter_is_applied_before_limit_and_rejects_dynamic_paths():
    local_store.put("analysis_history", "old-alice", {"user_id": "alice", "game": "town", "number": 1})
    for number in range(5):
        local_store.put("analysis_history", str(number), {"user_id": "bob", "game": "town", "number": number})
    assert local_store.find("analysis_history", {"user_id": "alice", "game": "town"}, 1)[0]["number"] == 1
    with pytest.raises(ValueError):
        local_store.find("analysis_history", {"user_id') OR 1=1 --": "alice"})


def native_snapshot(status="playing"):
    return {"scene": "town", "player_id": "alice", "run_id": "first-run", "state": {
        "turn": 3, "max_turns": 40, "hp": 0 if status == "lost" else 20, "max_hp": 20,
        "stamina": 6, "max_stamina": 6, "attack": 4, "defense": 1, "potions": 2, "gold": 0,
        "position": {"x": 0, "y": 0}, "enemies": [], "exit": {"x": 0, "y": 0}, "walls": [],
        "objectives": [{"id": str(index), "name": "物资", "x": index + 2, "y": 0, "done": status == "won"} for index in range(3)],
        "status": status, "events": [], "last_action": "休息恢复体力"}}


def test_native_coaching_uses_scoped_memory_and_records_only_reviewed_finished_runs():
    note = write(game="town", content="休息前先看敌人距离和体力。")
    playing = client.post("/api/v1/play/analyze", json=native_snapshot()).json()
    assert playing["metadata"]["memory"]["items"][0]["id"] == note["id"]
    assert len(player_memory.list("alice")) == 1
    finished = client.post("/api/v1/play/analyze", json=native_snapshot("won"))
    assert finished.status_code == 200
    episode_id = finished.json()["metadata"]["memory"]["recorded_episode_id"]
    episode = next(item for item in player_memory.list("alice") if item.id == episode_id)
    assert episode.kind == "episode" and episode.source == "game" and episode.expires_at
    repeated = client.post("/api/v1/play/analyze", json=native_snapshot("won")).json()
    assert repeated["metadata"]["memory"]["episodes"] == []  # no self-recall
    assert next(item for item in player_memory.list("alice") if item.id == episode_id).revision == 1
    next_run = native_snapshot()
    next_run["run_id"] = "second-run"
    assert client.post("/api/v1/play/analyze", json=next_run).json()["metadata"]["memory"]["episodes"][0]["id"] == episode_id


def test_forgotten_finished_run_does_not_reappear_on_repeated_analysis():
    finished = client.post("/api/v1/play/analyze", json=native_snapshot("lost")).json()
    episode_id = finished["metadata"]["memory"]["recorded_episode_id"]
    assert client.delete(f"/api/v1/memory/items/{episode_id}?user_id=alice&expected_revision=1").status_code == 204
    repeated = client.post("/api/v1/play/analyze", json=native_snapshot("lost"))
    assert repeated.status_code == 200 and "recorded_episode_id" not in repeated.json()["metadata"]["memory"]
    assert player_memory.list("alice") == []


def test_public_native_player_id_cannot_read_memory_or_write_episode(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(local_store, "_connect", lambda: pytest.fail("Public native memory access"))
    result = client.post("/api/v1/play/analyze", json=native_snapshot("won"))
    assert result.status_code == 200 and "memory" not in result.json()["metadata"]


def test_memory_context_is_reset_after_analysis_failure(monkeypatch):
    import app.services.orchestrator as orchestrator
    monkeypatch.setattr(orchestrator, "maybe_enhance_analysis", lambda **kwargs: (_ for _ in ()).throw(RuntimeError("test failure")))
    with pytest.raises(RuntimeError, match="test failure"):
        ask()
    assert current_player_memory.get() is None


def test_memory_limit_reports_conflict_without_breaking_native_play():
    for number in range(200):
        player_memory.put("alice", MemoryInput(key=f"note-{number}", content="个人记录"))
    result = client.post("/api/v1/assistant", json={"question": "记住：新的一件事", "user_profile": {"user_id": "alice"}})
    assert result.status_code == 409 and "200" in result.json()["detail"]
    native = client.post("/api/v1/play/analyze", json=native_snapshot("won"))
    assert native.status_code == 200 and "recorded_episode_id" not in native.json()["metadata"]["memory"]
    assert current_player_memory.get() is None


def test_private_memory_responses_are_not_cacheable():
    response = client.get("/api/v1/memory/items?user_id=alice")
    assert response.status_code == 200 and response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("changes", [{"content": " "}, {"ttl_days": 0}, {"ttl_days": 366}, {"content": "x" * 301}, {"key": "../../x"}, {"user_id": " "}])
def test_invalid_memory_is_rejected(changes):
    response = client.post("/api/v1/memory/items", json={"user_id": "alice", "key": "x", "content": "test", **changes})
    assert response.status_code == 422
