import json
from pathlib import Path
from typing import Any

from app.models.schemas import BattleState


class KnowledgeAgent:
    def __init__(self) -> None:
        knowledge_path = Path(__file__).resolve().parents[1] / "knowledge" / "pokemon_demo_knowledge.json"
        self.knowledge = json.loads(knowledge_path.read_text(encoding="utf-8"))

    def build_context(self, state: BattleState) -> dict[str, Any]:
        active_archetype = state.player.active.archetype
        opponent_archetype = state.opponent.active.archetype
        return {
            "glossary": self.knowledge["glossary"],
            "beginner_tips": self.knowledge["beginner_tips"],
            "player_archetype": self.knowledge["archetypes"].get(active_archetype, {}),
            "opponent_archetype": self.knowledge["archetypes"].get(opponent_archetype, {}),
            "threat_labels": {
                threat: self.knowledge["threat_tags"].get(threat, "unknown threat")
                for threat in state.revealed_threats
            },
        }
