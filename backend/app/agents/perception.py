from pathlib import Path

from app.models.schemas import BattleState, PerceptionResult


class PerceptionAgent:
    def parse_state(self, state: BattleState) -> PerceptionResult:
        return PerceptionResult(
            source="json",
            confidence=0.95,
            extracted_state=state,
            perception_notes=["Structured state provided directly by the user."],
        )

    async def parse_screenshot(self, filename: str | None = None) -> PerceptionResult:
        samples_root = Path(__file__).resolve().parents[3] / "samples" / "game-states"
        placeholder_state = BattleState.model_validate_json(
            (samples_root / "balanced-position.json").read_text(encoding="utf-8")
        )
        notes = [
            "Screenshot mode is intentionally lightweight in the MVP.",
            "Visual parsing is mocked with a sample inferred battle state.",
        ]
        if filename:
            notes.append(f"Uploaded file received: {filename}")
        return PerceptionResult(
            source="screenshot",
            confidence=0.42,
            extracted_state=placeholder_state,
            perception_notes=notes,
        )
