"""后端分析链路测试，覆盖健康检查、分析接口和记忆能力。"""

import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import UserProfile
from app.services.mongo_store import mongo_store

client = TestClient(app)


def load_sample(name: str) -> dict:
    path = Path(__file__).resolve().parents[2] / "samples" / "game-states" / name
    return json.loads(path.read_text(encoding="utf-8"))


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_state_analysis_response_shape() -> None:
    payload = {
        "game": "pokemon-battle-demo",
        "question": "What should I do next?",
        "state": load_sample("balanced-position.json"),
    }
    response = client.post("/api/v1/analyze/state", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert "summary" in body
    assert "direction_prediction" in body
    assert len(body["tactical_advice"]) >= 1
    assert "review_report" in body


def test_multiple_game_packs_supported() -> None:
    moba_payload = {
        "game": "moba-postmatch-demo",
        "question": "What should I do next?",
        "state": load_sample("moba-comeback-window.json"),
    }
    rpg_payload = {
        "game": "rpg-build-demo",
        "question": "How should I improve this build?",
        "state": load_sample("rpg-mage-build.json"),
    }
    moba_response = client.post("/api/v1/analyze/state", json=moba_payload)
    rpg_response = client.post("/api/v1/analyze/state", json=rpg_payload)
    assert moba_response.status_code == 200
    assert rpg_response.status_code == 200
    assert moba_response.json()["metadata"]["game"] == "moba-postmatch-demo"
    assert rpg_response.json()["metadata"]["game"] == "rpg-build-demo"
    assert "best_direction" in moba_response.json()["direction_prediction"]
    assert "current_phase" in rpg_response.json()["direction_prediction"]


def test_invalid_game_rejected() -> None:
    payload = {
        "game": "unsupported-demo",
        "question": "Help",
        "state": load_sample("balanced-position.json"),
    }
    response = client.post("/api/v1/analyze/state", json=payload)
    assert response.status_code == 422


def test_state_analysis_accepts_optional_user_profile() -> None:
    payload = {
        "game": "pokemon-battle-demo",
        "question": "Give me a concise next move.",
        "state": load_sample("balanced-position.json"),
        "session_id": "session-123",
        "user_profile": {
            "user_id": "player-7",
            "skill_level": "beginner",
            "preferred_style": "concise",
            "favorite_role": "late-game cleaner",
            "goals": ["safer turn planning"],
        },
    }
    response = client.post("/api/v1/analyze/state", json=payload)
    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["game"] == "pokemon-battle-demo"
    assert "summary" in body


def test_state_analysis_uses_mongodb_persistence_hooks(monkeypatch) -> None:
    calls = {"merge": 0, "upsert": 0, "history": 0}

    def fake_merge(profile):
        calls["merge"] += 1
        return profile

    def fake_upsert(profile):
        calls["upsert"] += 1
        assert isinstance(profile, UserProfile)
        assert profile.user_id == "player-9"

    def fake_save_history(**kwargs):
        calls["history"] += 1
        assert kwargs["session_id"] == "session-mongo"
        assert kwargs["game"] == "pokemon-battle-demo"

    monkeypatch.setattr(mongo_store, "merge_user_profile", fake_merge)
    monkeypatch.setattr(mongo_store, "upsert_user_profile", fake_upsert)
    monkeypatch.setattr(mongo_store, "save_analysis_history", fake_save_history)

    payload = {
        "game": "pokemon-battle-demo",
        "question": "Save this analysis",
        "state": load_sample("balanced-position.json"),
        "session_id": "session-mongo",
        "user_profile": {
            "user_id": "player-9",
            "skill_level": "intermediate",
            "preferred_style": "balanced",
        },
    }
    response = client.post("/api/v1/analyze/state", json=payload)
    assert response.status_code == 200
    assert calls == {"merge": 1, "upsert": 1, "history": 1}


def test_screenshot_analysis_route() -> None:
    response = client.post(
        "/api/v1/analyze/screenshot",
        data={"question": "What should I do next?", "game": "pokemon-battle-demo"},
        files={"file": ("battle.png", b"fake-image-bytes", "image/png")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["game"] == "pokemon-battle-demo"
    assert any("Screenshot mode" in item for item in body["risks_or_uncertainties"])


def test_memory_profile_route_uses_store(monkeypatch) -> None:
    def fake_load(user_id: str):
        assert user_id == "player-1"
        return UserProfile(user_id="player-1", skill_level="advanced", preferred_style="detailed")

    monkeypatch.setattr(mongo_store, "load_user_profile", fake_load)
    response = client.get("/api/v1/memory/profile/player-1")
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == "player-1"
    assert body["skill_level"] == "advanced"


def test_memory_profile_post_route_uses_store(monkeypatch) -> None:
    captured = {"profile": None}

    def fake_upsert(profile: UserProfile):
        captured["profile"] = profile

    monkeypatch.setattr(mongo_store, "upsert_user_profile", fake_upsert)
    response = client.post(
        "/api/v1/memory/profile",
        json={
            "user_id": "player-save",
            "skill_level": "intermediate",
            "preferred_style": "balanced",
            "goals": ["cleaner macro setup"],
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["user_id"] == "player-save"
    assert captured["profile"] is not None
    assert captured["profile"].user_id == "player-save"


def test_memory_history_route_uses_store(monkeypatch) -> None:
    sample_response = client.post(
        "/api/v1/analyze/state",
        json={
            "game": "pokemon-battle-demo",
            "question": "What should I do next?",
            "state": load_sample("balanced-position.json"),
        },
    ).json()

    def fake_list(*, user_id, session_id, limit):
        assert user_id == "player-2"
        assert session_id == "session-2"
        assert limit == 5
        return [
            {
                "game": "pokemon-battle-demo",
                "question": "What should I do next?",
                "session_id": "session-2",
                "user_id": "player-2",
                "source": "json",
                "user_profile": {
                    "user_id": "player-2",
                    "skill_level": "beginner",
                    "preferred_style": "concise",
                    "favorite_role": None,
                    "favorite_character": None,
                    "goals": [],
                    "notes": [],
                    "display_name": None,
                },
                "extracted_state": load_sample("balanced-position.json"),
                "response": sample_response,
                "created_at": "2026-04-21T12:00:00+00:00",
            }
        ]

    monkeypatch.setattr(mongo_store, "list_analysis_history", fake_list)
    response = client.get("/api/v1/memory/history", params={"user_id": "player-2", "session_id": "session-2", "limit": 5})
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["user_id"] == "player-2"
    assert body[0]["session_id"] == "session-2"
