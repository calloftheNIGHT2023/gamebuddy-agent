import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app

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
