"""工具调用注册表和执行器，供模型在分析过程中访问外部能力。"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.models.schemas import AnalysisResponse, SupportedGame, UserProfile
from app.services.mongo_store import mongo_store


@dataclass
class ToolRuntimeContext:
    game: SupportedGame
    question: str
    extracted_state: dict[str, Any]
    heuristic: AnalysisResponse
    user_profile: UserProfile | None = None
    session_id: str | None = None


def get_tool_definitions() -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": "get_game_knowledge",
                "description": "Look up local game-specific strategy terms, beginner tips, and macro or build references before answering.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "game": {
                            "type": "string",
                            "enum": ["pokemon-battle-demo", "moba-postmatch-demo", "rpg-build-demo"]
                        },
                        "topic": {
                            "type": "string",
                            "description": "The concept, term, or topic to look up from the local knowledge pack."
                        }
                    },
                    "required": ["game", "topic"],
                    "additionalProperties": False
                }
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_user_profile",
                "description": "Read the optional user profile and response preferences to personalize the final answer.",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "additionalProperties": False
                }
            }
        }
    ]


def execute_tool_call(name: str, arguments: dict[str, Any], context: ToolRuntimeContext) -> dict[str, Any]:
    handlers = {
        "get_game_knowledge": _get_game_knowledge,
        "get_user_profile": _get_user_profile,
    }
    handler = handlers.get(name)
    if handler is None:
        raise ValueError(f"Unsupported tool: {name}")
    return handler(arguments, context)


def summarize_tool_names(tool_calls: list[dict[str, Any]]) -> str:
    if not tool_calls:
        return "none"
    return ",".join(call["name"] for call in tool_calls)


def _get_game_knowledge(arguments: dict[str, Any], context: ToolRuntimeContext) -> dict[str, Any]:
    game = arguments.get("game") or context.game
    topic = str(arguments.get("topic", "")).strip()
    knowledge = _load_knowledge_pack(game)
    matches = _collect_matches(knowledge, topic)
    return {
        "game": game,
        "topic": topic,
        "matches": matches[:6],
        "pack_sections": sorted(knowledge.keys()),
    }


def _get_user_profile(_: dict[str, Any], context: ToolRuntimeContext) -> dict[str, Any]:
    profile = mongo_store.merge_user_profile(context.user_profile) or context.user_profile
    inferred_skill_level = (
        profile.skill_level
        if profile and profile.skill_level
        else str(context.extracted_state.get("skill_level", "intermediate"))
    )
    preferred_style = profile.preferred_style if profile and profile.preferred_style else "balanced"
    goals = profile.goals if profile and profile.goals else [_infer_goal(context.game, context.question)]
    notes = list(profile.notes) if profile and profile.notes else []
    if context.session_id:
        notes.append(f"Current session id: {context.session_id}")

    return {
        "user_id": profile.user_id if profile else None,
        "display_name": profile.display_name if profile else None,
        "favorite_role": profile.favorite_role if profile else None,
        "favorite_character": profile.favorite_character if profile else None,
        "skill_level": inferred_skill_level,
        "preferred_style": preferred_style,
        "goals": goals,
        "notes": notes[:5],
        "personalization_hints": _build_personalization_hints(inferred_skill_level, preferred_style, goals),
        "mongodb_enabled": 1 if mongo_store.enabled else 0,
    }


def _load_knowledge_pack(game: SupportedGame) -> dict[str, Any]:
    root = Path(__file__).resolve().parents[1] / "knowledge"
    filename = {
        "pokemon-battle-demo": "pokemon_demo_knowledge.json",
        "moba-postmatch-demo": "moba_demo_knowledge.json",
        "rpg-build-demo": "rpg_demo_knowledge.json",
    }[game]
    return json.loads((root / filename).read_text(encoding="utf-8"))


def _collect_matches(node: Any, topic: str, path: str = "") -> list[dict[str, str]]:
    matches: list[dict[str, str]] = []
    lowered_topic = topic.lower()

    if isinstance(node, dict):
        for key, value in node.items():
            current_path = f"{path}.{key}" if path else key
            if lowered_topic and lowered_topic in key.lower():
                matches.append({"path": current_path, "content": _stringify(value)})
            matches.extend(_collect_matches(value, topic, current_path))
    elif isinstance(node, list):
        for index, value in enumerate(node):
            current_path = f"{path}[{index}]"
            text = _stringify(value)
            if lowered_topic and lowered_topic in text.lower():
                matches.append({"path": current_path, "content": text})
            matches.extend(_collect_matches(value, topic, current_path))
    elif isinstance(node, str):
        if lowered_topic and lowered_topic in node.lower():
            matches.append({"path": path or "root", "content": node})

    if not matches and path == "":
        matches.extend(_top_level_fallback(node))
    return matches


def _top_level_fallback(node: Any) -> list[dict[str, str]]:
    if not isinstance(node, dict):
        return []
    fallback: list[dict[str, str]] = []
    for key, value in list(node.items())[:3]:
        fallback.append({"path": key, "content": _stringify(value)})
    return fallback


def _stringify(value: Any) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False)


def _infer_goal(game: SupportedGame, question: str) -> str:
    lowered = question.lower()
    if "review" in lowered or "mistake" in lowered:
        return "review and improvement"
    if game == "moba-postmatch-demo":
        return "cleaner macro setup"
    if game == "rpg-build-demo":
        return "focused progression build"
    return "safer turn planning"


def _build_personalization_hints(skill_level: str, preferred_style: str, goals: list[str]) -> list[str]:
    hints = [
        f"Target skill level: {skill_level}.",
        f"Preferred response style: {preferred_style}.",
    ]
    if skill_level == "beginner":
        hints.append("Prefer clearer explanations over jargon-heavy compression.")
    elif skill_level == "advanced":
        hints.append("You can use tighter strategic language and assume stronger baseline knowledge.")
    if preferred_style == "concise":
        hints.append("Keep recommendations compact and action-first.")
    elif preferred_style == "detailed":
        hints.append("Include more reasoning and tradeoff detail.")
    if goals:
        hints.append(f"Primary user goal: {goals[0]}.")
    return hints
