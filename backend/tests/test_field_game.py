"""Native-board validation, actual tactics, event provenance and access isolation."""

from copy import deepcopy

import pytest
from fastapi.testclient import TestClient
from pydantic import SecretStr

from app.core.config import settings
from app.main import app
from app.services import ops
from app.services.local_store import local_store
from app.services.mongo_store import mongo_store
from app.services import openrouter_client as llm


client = TestClient(app)


def snapshot(scene="town"):
    return {
        "scene": scene,
        "state": {
            "turn": 0, "max_turns": 40, "hp": 20, "max_hp": 20,
            "stamina": 6, "max_stamina": 6, "attack": 4, "defense": 1,
            "potions": 2, "gold": 0, "position": {"x": 0, "y": 0}, "enemies": [],
            "objectives": [{"id": f"o{index}", "name": f"目标{index + 1}", "x": x, "y": y, "done": False}
                           for index, (x, y) in enumerate([(3, 0), (5, 3), (8, 5)][:2 if scene == "dungeon" else 3])],
            "exit": None if scene == "river" else {"x": 0, "y": 0},
            "walls": [], "status": "playing", "events": [], "last_action": "开始探索",
        },
    }


def enemy(**updates):
    return {"id": "e1", "name": "守卫", "x": 1, "y": 0, "hp": 6, "max_hp": 6, "attack": 5, **updates}


@pytest.fixture(autouse=True)
def local_mode(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "development")


def analyze(payload):
    response = client.post("/api/v1/play/analyze", json=payload)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize("scene,title", [("town", "松风镇"), ("river", "河谷争夺"), ("dungeon", "地牢余火")])
def test_native_shapes_and_private_trace(scene, title):
    body = analyze(snapshot(scene))
    assert set(body) == {"summary", "direction_prediction", "tactical_advice", "beginner_explanation", "risks_or_uncertainties", "next_steps", "review_report", "metadata"}
    metadata = body["metadata"]
    assert metadata["scene"] == scene and metadata["game_title"] == title
    assert metadata["source"] == "field-game" and metadata["turn"] == 0
    trace = ops.get_trace(metadata["trace_id"])
    assert trace["task"] == "field-game" and trace["response"] == body
    assert trace["policy_snapshot"]["id"] == "field-game-v1"
    assert trace["state"] == snapshot(scene)["state"]


@pytest.mark.parametrize("path,value", [
    (("position", "x"), 9), (("position", "y"), -1), (("turn",), -1),
    (("turn",), 41), (("max_turns",), 0), (("hp",), 21), (("hp",), True),
    (("hp",), "20"), (("hp",), 2.5), (("stamina",), 7), (("max_stamina",), 0),
    (("attack",), -1), (("defense",), -1), (("potions",), 100), (("gold",), 10000),
    (("last_action",), "x" * 201),
])
def test_invalid_position_numbers_and_bounded_strings(path, value):
    payload = snapshot()
    node = payload["state"]
    for key in path[:-1]:
        node = node[key]
    node[path[-1]] = value
    assert client.post("/api/v1/play/analyze", json=payload).status_code == 422


@pytest.mark.parametrize("field", list(snapshot()["state"]))
def test_every_snapshot_field_is_required(field):
    payload = snapshot()
    del payload["state"][field]
    assert client.post("/api/v1/play/analyze", json=payload).status_code == 422


def test_nonfinite_json_and_unknown_fields_are_rejected():
    payload = snapshot()
    payload["state"]["hp"] = 123
    import json
    raw = json.dumps(payload).replace('"hp": 123', '"hp": NaN')
    assert client.post("/api/v1/play/analyze", content=raw, headers={"Content-Type": "application/json"}).status_code == 422
    payload = snapshot()
    payload["state"]["untrusted_field"] = "not accepted"
    assert client.post("/api/v1/play/analyze", json=payload).status_code == 422


def test_list_bounds_ids_cells_and_event_times():
    invalid = []
    payload = snapshot(); payload["state"]["walls"] = [{"x": 1, "y": 1}] * 55; invalid.append(payload)
    payload = snapshot(); payload["state"]["walls"] = [{"x": 0, "y": 0}]; invalid.append(payload)
    payload = snapshot(); payload["state"]["enemies"] = [enemy(), enemy()]; invalid.append(payload)
    payload = snapshot(); payload["state"]["enemies"] = [enemy(x=0, y=0)]; invalid.append(payload)
    payload = snapshot(); payload["state"]["enemies"] = [enemy(hp=7)]; invalid.append(payload)
    payload = snapshot(); payload["state"]["events"] = [{"turn": 1, "text": "尚未发生", "kind": "move"}]; invalid.append(payload)
    payload = snapshot(); payload["state"]["objectives"][1]["id"] = "o0"; invalid.append(payload)
    payload = snapshot("river"); payload["state"]["exit"] = {"x": 0, "y": 0}; invalid.append(payload)
    payload = snapshot("dungeon"); payload["state"]["exit"] = None; invalid.append(payload)
    for payload in invalid:
        assert client.post("/api/v1/play/analyze", json=payload).status_code == 422


def test_low_health_uses_real_potion_and_caps_healing():
    payload = snapshot("river")
    payload["state"].update(hp=3, potions=1)
    body = analyze(payload)
    assert "先喝1瓶药水" in body["next_steps"][0]
    assert "恢复8点生命至11/20" in body["next_steps"][0]
    payload["state"]["potions"] = 0
    assert "喝1瓶" not in analyze(payload)["next_steps"][0]


def test_empty_stamina_rests_instead_of_an_illegal_attack_or_move():
    payload = snapshot("river")
    payload["state"].update(stamina=0, enemies=[enemy()])
    body = analyze(payload)
    assert "先休息" in body["next_steps"][0]
    assert "恢复到4/6" in body["next_steps"][0]


@pytest.mark.parametrize("hp,stamina,expected", [(4, 6, "普攻"), (6, 6, "技能"), (6, 1, "普攻")])
def test_adjacent_enemy_action_respects_damage_range_and_cost(hp, stamina, expected):
    payload = snapshot("river")
    payload["state"].update(enemies=[enemy(hp=hp)], stamina=stamina)
    body = analyze(payload)
    assert expected in body["next_steps"][0]
    assert "第2列第1行" in body["next_steps"][0]
    assert body["metadata"]["adjacent_damage"] == 4


def test_range_two_skill_is_never_suggested_with_one_stamina():
    payload = snapshot("river")
    payload["state"].update(enemies=[enemy(x=2)], stamina=1)
    assert "技能" not in analyze(payload)["next_steps"][0]
    payload["state"]["stamina"] = 2
    assert "技能" in analyze(payload)["next_steps"][0]


def test_town_enemy_cadence_uses_the_next_turn():
    payload = snapshot()
    payload["state"]["enemies"] = [enemy()]
    assert analyze(payload)["metadata"]["adjacent_damage"] == 0
    payload["state"]["turn"] = 1
    assert analyze(payload)["metadata"]["adjacent_damage"] == 4


def test_bfs_detours_around_walls_and_living_enemies():
    payload = snapshot()
    payload["state"]["walls"] = [{"x": 1, "y": 0}, {"x": 1, "y": 1}]
    payload["state"]["enemies"] = [enemy(x=2, y=1)]
    body = analyze(payload)
    metadata = body["metadata"]
    assert metadata["nearest_target"]["name"] == "目标1"
    assert metadata["distance"] == 7
    assert metadata["path"][0] == {"x": 0, "y": 1}
    assert "向下" in body["next_steps"][0]
    assert "7步" in body["tactical_advice"][1]["recommendation"]
    assert {"x": 2, "y": 1} not in metadata["path"]


def test_dead_enemies_do_not_block_shortest_path():
    payload = snapshot()
    payload["state"]["enemies"] = [enemy(hp=0)]
    assert analyze(payload)["metadata"]["distance"] == 3


def test_guard_in_the_only_opening_produces_a_legal_approach_step():
    payload = snapshot("dungeon")
    payload["state"].update(position={"x": 0, "y": 4}, enemies=[enemy(x=2, y=1)])
    payload["state"]["walls"] = [{"x": 2, "y": y} for y in range(6) if y != 1]
    body = analyze(payload)
    metadata = body["metadata"]
    assert metadata["path_target_kind"] == "blocker-approach"
    assert metadata["blocker_id"] == "e1"
    assert metadata["path"] and {"x": 2, "y": 1} not in metadata["path"]
    assert metadata["path"][0] == {"x": 0, "y": 3}
    assert "先向上移动到第1列第4行" in body["next_steps"][0]
    assert "靠近堵路的守卫" in body["next_steps"][0]


def test_review_only_quotes_actual_events_and_keeps_snapshot_unchanged():
    payload = snapshot()
    payload["state"].update(turn=3, events=[
        {"turn": 1, "text": "向南走了一格", "kind": "move"},
        {"turn": 2, "text": "守卫造成4点伤害", "kind": "enemy_attack"},
        {"turn": 3, "text": "在桥头休息", "kind": "rest"},
    ])
    original = deepcopy(payload)
    body = analyze(payload)
    assert "第2回合：守卫造成4点伤害" in body["review_report"]["current_situation"]
    assert "守卫造成4点伤害" in body["review_report"]["likely_mistakes"][0]
    assert "施法" not in body["review_report"]["current_situation"]
    assert payload == original


@pytest.mark.parametrize("scene", ["town", "river", "dungeon"])
def test_finished_snapshot_uses_actual_win_conditions(scene):
    payload = snapshot(scene)
    for objective in payload["state"]["objectives"]:
        objective["done"] = True
    payload["state"].update(turn=7, status="won")
    body = analyze(payload)
    assert "通关" in body["summary"] and "7回合" in body["summary"]
    assert body["tactical_advice"] == []
    assert "重新开局" in body["next_steps"][0]
    payload["state"]["hp"] = 0
    assert client.post("/api/v1/play/analyze", json=payload).status_code == 422


def test_inconsistent_playing_won_and_lost_are_rejected():
    for updates in [{"hp": 0}, {"turn": 40}, {"status": "won"}, {"status": "lost"}]:
        payload = snapshot()
        payload["state"].update(updates)
        assert client.post("/api/v1/play/analyze", json=payload).status_code == 422


def test_death_and_timeout_have_distinct_reports():
    payload = snapshot()
    payload["state"].update(hp=0, status="lost", turn=5)
    assert "生命归零" in analyze(payload)["summary"]
    payload["state"].update(hp=8, turn=40)
    assert "40回合上限" in analyze(payload)["summary"]


def test_last_step_can_win_before_an_enemy_turn_or_deadline():
    payload = snapshot("river")
    payload["state"].update(turn=39, hp=1, enemies=[enemy(x=0, y=1)])
    for objective in payload["state"]["objectives"]:
        objective["done"] = True
    payload["state"]["objectives"][0].update(done=False, x=1, y=0)
    body = analyze(payload)
    assert "向右" in body["next_steps"][0]
    assert "到达即通关" in body["next_steps"][0]


def test_damage_text_reports_actual_lost_health():
    payload = snapshot("river")
    payload["state"]["enemies"] = [enemy(hp=2)]
    body = analyze(payload)
    assert "造成2点伤害" in body["next_steps"][0]
    assert "可直接击倒" in body["next_steps"][0]
    assert "原地不处理敌人" in body["risks_or_uncertainties"][-1]


def test_fatal_healing_does_not_replace_a_surviving_escape():
    payload = snapshot("river")
    payload["state"].update(hp=2, potions=1, enemies=[enemy(attack=20)])
    body = analyze(payload)
    assert "先向下移动" in body["next_steps"][0]
    assert "本回合承受0点" in body["next_steps"][0]
    assert "喝药后也只有10点生命" in body["direction_prediction"]["why_now"]


def test_anonymous_native_analysis_never_reads_stores_or_calls_provider(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "admin_token", SecretStr("test-admin-token"))

    def forbidden(*args, **kwargs):
        pytest.fail("Anonymous native analysis touched storage or a provider")

    for method in ("get", "list", "put"):
        monkeypatch.setattr(local_store, method, forbidden)
    for method in ("merge_user_profile", "upsert_user_profile", "save_analysis_history", "save_feedback"):
        monkeypatch.setattr(mongo_store, method, forbidden)
    monkeypatch.setattr(llm.httpx, "Client", forbidden)
    monkeypatch.setattr(llm.settings, "openrouter_api_key", "should-not-be-used")
    body = analyze(snapshot())
    assert body["metadata"]["source"] == "field-game"
    assert body["metadata"]["llm_status"] == "disabled"
    assert "trace_id" not in body["metadata"]


def test_native_private_access_inherits_existing_credentials(monkeypatch):
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "admin_token", SecretStr("test-admin-token"))
    assert client.post("/api/v1/play/analyze", json=snapshot(), headers={"Authorization": "Bearer wrong"}).status_code == 401
    response = client.post("/api/v1/play/analyze", json=snapshot(), headers={"Authorization": "Bearer test-admin-token"})
    assert response.status_code == 200
    assert response.json()["metadata"]["trace_id"]
