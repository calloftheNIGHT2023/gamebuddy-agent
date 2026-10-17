"""工具调用注册表和执行器，供模型在分析过程中访问外部能力。"""

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from app.models.schemas import AnalysisResponse, SupportedGame, UserProfile
from app.services.mongo_store import mongo_store
from app.services.retrieval import load_knowledge_pack, retrieve_knowledge
from app.services.runtime import public_request


MAX_TOOL_CALLS = 4


class KnowledgeArguments(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, str_strip_whitespace=True)

    game: SupportedGame
    topic: str = Field(min_length=1, max_length=240)


class ProfileArguments(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


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
                "parameters": KnowledgeArguments.model_json_schema(),
            }
        },
        {
            "type": "function",
            "function": {
                "name": "get_user_profile",
                "description": "Read the optional user profile and response preferences to personalize the final answer.",
                "parameters": ProfileArguments.model_json_schema(),
            }
        }
    ]


def tool_error(code: str, message: str) -> dict[str, Any]:
    return {"ok": False, "error": {"code": code, "message": message}}


def execute_tool_call(name: str, arguments: Any, context: ToolRuntimeContext) -> dict[str, Any]:
    handlers = {
        "get_game_knowledge": _get_game_knowledge,
        "get_user_profile": _get_user_profile,
    }
    handler = handlers.get(name) if isinstance(name, str) else None
    if handler is None:
        return tool_error("unknown_tool", "This tool is not in the allowed registry.")
    validator = KnowledgeArguments if name == "get_game_knowledge" else ProfileArguments
    try:
        validated = validator.model_validate(arguments)
    except ValidationError as error:
        # Do not include raw input or Pydantic's echoed values in model/user logs.
        fields = sorted({".".join(str(part) for part in item["loc"]) or "arguments" for item in error.errors()})
        return tool_error("invalid_arguments", f"Invalid or unexpected argument fields: {', '.join(fields)}.")
    if isinstance(validated, KnowledgeArguments) and validated.game != context.game:
        return tool_error("game_mismatch", "Knowledge tools must use the current analysis game.")
    try:
        return {"ok": True, **handler(validated.model_dump(), context)}
    except (OSError, ValueError, TypeError, RuntimeError):
        return tool_error("tool_execution_failed", "The local tool could not complete; use the observed state.")


def summarize_tool_names(tool_calls: list[dict[str, Any]]) -> str:
    if not tool_calls:
        return "none"
    return ",".join(str(call.get("name", "unknown")) for call in tool_calls)


def _get_game_knowledge(arguments: dict[str, Any], context: ToolRuntimeContext) -> dict[str, Any]:
    game = arguments["game"]
    topic = arguments["topic"]
    knowledge = load_knowledge_pack(game)
    matches = retrieve_knowledge(game, topic, limit=6)
    return {
        "game": game,
        "topic": topic,
        "matches": matches,
        "status": "matched" if matches else "no_match",
        "pack_sections": sorted(knowledge.keys()),
    }


def _get_user_profile(_: dict[str, Any], context: ToolRuntimeContext) -> dict[str, Any]:
    profile = context.user_profile if public_request.get() else (mongo_store.merge_user_profile(context.user_profile) or context.user_profile)
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
