"""Validate fields actually consumed by the demo rules before running them."""

import math
from typing import Any


def validate_state(game: str, state: dict[str, Any]) -> None:
    def value(path: str):
        node: Any = state
        for key in path.split("."):
            if not isinstance(node, dict) or key not in node:
                raise ValueError(f"state.{path} is required for {game}")
            node = node[key]
        return node

    def text(path: str):
        item = value(path)
        if not isinstance(item, str) or not item.strip():
            raise ValueError(f"state.{path} must be a non-empty string")

    def number(path: str, minimum: float | None = None, maximum: float | None = None):
        item = value(path)
        try:
            finite = math.isfinite(item)
        except (OverflowError, TypeError):
            finite = False
        if isinstance(item, bool) or not isinstance(item, (int, float)) or not finite:
            raise ValueError(f"state.{path} must be a finite number")
        if minimum is not None and item < minimum or maximum is not None and item > maximum:
            raise ValueError(f"state.{path} is outside the permitted range")

    if game == "pokemon-battle-demo":
        number("turn", 1)
        for path in ("player.active.name", "opponent.active.name", "opponent.active.speed_tier", "player.momentum"):
            text(path)
        number("player.active.current_hp_percent", 0, 100)
        hazards = value("opponent.hazards")
        if not isinstance(hazards, list) or any(not isinstance(item, str) for item in hazards):
            raise ValueError("state.opponent.hazards must be a list of strings")
    elif game == "moba-postmatch-demo":
        for path in ("player_role", "champion", "next_objective", "enemy_carry_threat"):
            text(path)
        number("game_time_minutes", 0)
        number("team_gold_diff")
    elif game == "rpg-build-demo":
        for path in ("build_focus", "character_name", "current_goal", "pain_point"):
            text(path)
        for path in ("level", "core_stats.mana_regen", "core_stats.vitality"):
            number(path, 0)
        resources = state.get("available_resources", {})
        if not isinstance(resources, dict):
            raise ValueError("state.available_resources must be an object")
        for key in resources:
            number(f"available_resources.{key}", 0)
