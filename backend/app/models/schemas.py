from typing import Any, Literal

from pydantic import BaseModel, Field


SupportedGame = Literal["pokemon-battle-demo", "moba-postmatch-demo", "rpg-build-demo"]


class PerceptionResult(BaseModel):
    source: Literal["json", "screenshot"]
    game: SupportedGame
    confidence: float = Field(ge=0.0, le=1.0)
    extracted_state: dict[str, Any]
    perception_notes: list[str] = Field(default_factory=list)


class TacticalAdviceItem(BaseModel):
    title: str
    recommendation: str
    reasoning: str
    confidence: Literal["low", "medium", "high"]


class DirectionPrediction(BaseModel):
    current_phase: str
    best_direction: str
    why_now: str
    avoid_direction: str
    confidence: Literal["low", "medium", "high"]


class ReviewSection(BaseModel):
    current_situation: str
    likely_mistakes: list[str]
    recommended_actions: list[str]
    longer_term_improvement: list[str]


class AnalysisResponse(BaseModel):
    summary: str
    direction_prediction: DirectionPrediction
    tactical_advice: list[TacticalAdviceItem]
    beginner_explanation: str
    risks_or_uncertainties: list[str]
    next_steps: list[str]
    review_report: ReviewSection
    metadata: dict[str, str | float | int]


class StateAnalysisRequest(BaseModel):
    game: SupportedGame = "pokemon-battle-demo"
    question: str
    state: dict[str, Any]
