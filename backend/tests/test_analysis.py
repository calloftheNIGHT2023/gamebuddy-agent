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
    assert len(body["tactical_advice"]) >= 1
    assert "review_report" in body


def test_invalid_game_rejected() -> None:
    payload = {
        "game": "unsupported-demo",
        "question": "Help",
        "state": load_sample("balanced-position.json"),
    }
    response = client.post("/api/v1/analyze/state", json=payload)
    assert response.status_code == 400


def test_screenshot_analysis_route() -> None:
    response = client.post(
        "/api/v1/analyze/screenshot",
        data={"question": "What should I do next?"},
        files={"file": ("battle.png", b"fake-image-bytes", "image/png")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["metadata"]["game"] == "pokemon-battle-demo"
    assert any("Screenshot mode" in item for item in body["risks_or_uncertainties"])
