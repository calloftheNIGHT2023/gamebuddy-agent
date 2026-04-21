"""OpenRouter 客户端，负责可选的大模型增强和工具调用闭环。"""

import json
from typing import Any

import httpx

from app.core.config import settings
from app.models.schemas import AnalysisResponse, DirectionPrediction, ReviewSection, TacticalAdviceItem, UserProfile
from app.services.tools import ToolRuntimeContext, execute_tool_call, get_tool_definitions, summarize_tool_names


def maybe_enhance_analysis(
    *,
    game: str,
    question: str,
    extracted_state: dict[str, Any],
    heuristic: AnalysisResponse,
    user_profile: UserProfile | None = None,
    session_id: str | None = None,
) -> AnalysisResponse:
    if not settings.has_openrouter:
        return heuristic

    context = ToolRuntimeContext(
        game=game,
        question=question,
        extracted_state=extracted_state,
        heuristic=heuristic,
        user_profile=user_profile,
        session_id=session_id,
    )
    payload, tool_trace = _request_analysis(
        game=game,
        question=question,
        extracted_state=extracted_state,
        heuristic=heuristic,
        context=context,
    )
    if not payload:
        return heuristic

    try:
        return AnalysisResponse(
            summary=payload["summary"],
            direction_prediction=DirectionPrediction(**payload["direction_prediction"]),
            tactical_advice=[TacticalAdviceItem(**item) for item in payload["tactical_advice"]],
            beginner_explanation=payload["beginner_explanation"],
            risks_or_uncertainties=payload["risks_or_uncertainties"],
            next_steps=payload["next_steps"],
            review_report=ReviewSection(**payload["review_report"]),
            metadata={
                **heuristic.metadata,
                "llm_provider": "openrouter",
                "llm_model": settings.openrouter_model,
                "function_calling_used": 1 if tool_trace else 0,
                "tools_used": summarize_tool_names(tool_trace),
            },
        )
    except Exception:
        return heuristic


def _request_analysis(
    *,
    game: str,
    question: str,
    extracted_state: dict[str, Any],
    heuristic: AnalysisResponse,
    context: ToolRuntimeContext,
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    prompt = _build_prompt(game=game, question=question, extracted_state=extracted_state, heuristic=heuristic)
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.openrouter_site_url,
        "X-OpenRouter-Title": settings.openrouter_app_name,
    }
    system_message = {
        "role": "system",
        "content": (
            "You are an AI game analysis agent. "
            "Use tools when they materially improve factual grounding or personalization. "
            "After tool use, return valid JSON only. "
            "Do not wrap in markdown. Keep the structure exactly as requested."
        ),
    }
    user_message = {"role": "user", "content": prompt}
    tool_trace: list[dict[str, Any]] = []

    try:
        with httpx.Client(timeout=30.0) as client:
            first_body = {
                "model": settings.openrouter_model,
                "messages": [system_message, user_message],
                "tools": get_tool_definitions(),
                "tool_choice": "auto",
                "temperature": 0.3,
                "max_tokens": 1200,
            }
            first_response = client.post(
                f"{settings.openrouter_base_url}/chat/completions",
                headers=headers,
                json=first_body,
            )
            first_response.raise_for_status()
            first_message = first_response.json()["choices"][0]["message"]

            tool_calls = first_message.get("tool_calls") or []
            if tool_calls:
                followup_messages: list[dict[str, Any]] = [
                    system_message,
                    user_message,
                    {
                        "role": "assistant",
                        "content": first_message.get("content") or "",
                        "tool_calls": tool_calls,
                    },
                ]

                for tool_call in tool_calls:
                    name = tool_call["function"]["name"]
                    arguments = _parse_tool_arguments(tool_call["function"].get("arguments", "{}"))
                    result = execute_tool_call(name, arguments, context)
                    tool_trace.append({"name": name, "arguments": arguments})
                    followup_messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "name": name,
                            "content": json.dumps(result, ensure_ascii=False),
                        }
                    )

                second_body = {
                    "model": settings.openrouter_model,
                    "messages": followup_messages,
                    "temperature": 0.2,
                    "max_tokens": 1200,
                }
                second_response = client.post(
                    f"{settings.openrouter_base_url}/chat/completions",
                    headers=headers,
                    json=second_body,
                )
                second_response.raise_for_status()
                second_message = second_response.json()["choices"][0]["message"]
                return json.loads(_extract_json(_message_to_text(second_message))), tool_trace

        return json.loads(_extract_json(_message_to_text(first_message))), tool_trace
    except Exception:
        return None, []


def _extract_json(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object returned")
    return text[start : end + 1]


def _message_to_text(message: dict[str, Any]) -> str:
    content = message.get("content", "")
    if isinstance(content, list):
        return "".join(part.get("text", "") for part in content if isinstance(part, dict))
    return str(content)


def _parse_tool_arguments(raw_arguments: str) -> dict[str, Any]:
    if not raw_arguments:
        return {}
    return json.loads(raw_arguments)


def _build_prompt(
    *,
    game: str,
    question: str,
    extracted_state: dict[str, Any],
    heuristic: AnalysisResponse,
) -> str:
    return f"""
Analyze this game state and return JSON with exactly these top-level keys:
summary
direction_prediction
tactical_advice
beginner_explanation
risks_or_uncertainties
next_steps
review_report

Rules:
- direction_prediction must contain: current_phase, best_direction, why_now, avoid_direction, confidence
- tactical_advice is an array of 2 to 4 items with: title, recommendation, reasoning, confidence
- review_report must contain: current_situation, likely_mistakes, recommended_actions, longer_term_improvement
- confidence values must be one of: low, medium, high
- keep the answer practical and specific to the provided state
- if the heuristic draft is already strong, improve clarity but keep the same strategic direction
- if tools provide user profile or local knowledge, use them to improve grounding and personalization without contradicting the observed state

Game: {game}
User question: {question}

State JSON:
{json.dumps(extracted_state, ensure_ascii=False)}

Heuristic draft to improve:
{heuristic.model_dump_json(indent=2)}
""".strip()
