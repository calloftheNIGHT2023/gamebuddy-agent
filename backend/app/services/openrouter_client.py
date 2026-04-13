import json
from typing import Any

import httpx

from app.core.config import settings
from app.models.schemas import AnalysisResponse, DirectionPrediction, ReviewSection, TacticalAdviceItem


def maybe_enhance_analysis(
    *,
    game: str,
    question: str,
    extracted_state: dict[str, Any],
    heuristic: AnalysisResponse,
) -> AnalysisResponse:
    if not settings.has_openrouter:
        return heuristic

    payload = _request_analysis(game=game, question=question, extracted_state=extracted_state, heuristic=heuristic)
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
) -> dict[str, Any] | None:
    prompt = _build_prompt(game=game, question=question, extracted_state=extracted_state, heuristic=heuristic)
    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.openrouter_site_url,
        "X-OpenRouter-Title": settings.openrouter_app_name,
    }
    body = {
        "model": settings.openrouter_model,
        "messages": [
          {
            "role": "system",
            "content": (
                "You are an AI game analysis agent. Return valid JSON only. "
                "Do not wrap in markdown. Keep the structure exactly as requested."
            ),
          },
          {
            "role": "user",
            "content": prompt,
          },
        ],
        "temperature": 0.3,
        "max_tokens": 1200,
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.post(f"{settings.openrouter_base_url}/chat/completions", headers=headers, json=body)
            response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        if isinstance(content, list):
            text = "".join(part.get("text", "") for part in content if isinstance(part, dict))
        else:
            text = content
        return json.loads(_extract_json(text))
    except Exception:
        return None


def _extract_json(text: str) -> str:
    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON object returned")
    return text[start : end + 1]


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

Game: {game}
User question: {question}

State JSON:
{json.dumps(extracted_state, ensure_ascii=False)}

Heuristic draft to improve:
{heuristic.model_dump_json(indent=2)}
""".strip()
