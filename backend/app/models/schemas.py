from typing import Literal

from pydantic import BaseModel, Field


class Combatant(BaseModel):
    name: str
    archetype: str
    current_hp_percent: int = Field(ge=0, le=100)
    known_moves: list[str] = Field(default_factory=list)
    status: str | None = None
    speed_tier: Literal["slow", "medium", "fast"] = "medium"
    likely_role: str


class TeamSnapshot(BaseModel):
    active: Combatant
    bench: list[Combatant] = Field(default_factory=list)
    hazards: list[str] = Field(default_factory=list)
    momentum: Literal["behind", "neutral", "ahead"] = "neutral"


class BattleState(BaseModel):
    battle_id: str
    turn: int = Field(ge=1)
    format: str = "singles"
    skill_level: Literal["beginner", "intermediate", "advanced"] = "beginner"
    player: TeamSnapshot
    opponent: TeamSnapshot
    revealed_threats: list[str] = Field(default_factory=list)
    recent_events: list[str] = Field(default_factory=list)
    win_condition_hint: str | None = None


class PerceptionResult(BaseModel):
    source: Literal["json", "screenshot"]
    confidence: float = Field(ge=0.0, le=1.0)
    extracted_state: BattleState
    perception_notes: list[str] = Field(default_factory=list)


class TacticalAdviceItem(BaseModel):
    title: str
    recommendation: str
    reasoning: str
    confidence: Literal["low", "medium", "high"]


class ReviewSection(BaseModel):
    current_situation: str
    likely_mistakes: list[str]
    recommended_actions: list[str]
    longer_term_improvement: list[str]


class AnalysisResponse(BaseModel):
    summary: str
    tactical_advice: list[TacticalAdviceItem]
    beginner_explanation: str
    risks_or_uncertainties: list[str]
    next_steps: list[str]
    review_report: ReviewSection
    metadata: dict[str, str | float | int]


class StateAnalysisRequest(BaseModel):
    game: str = "pokemon-battle-demo"
    question: str
    state: BattleState
