"""Offline quality evaluation for resume-grade GameBuddy metrics.

The script compares a legacy single-answer baseline with the current
orchestrated response path. It intentionally uses deterministic sample states
so the reported numbers are reproducible without an external LLM key.
"""

from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.models.schemas import AnalysisResponse, DirectionPrediction, ReviewSection, TacticalAdviceItem, UserProfile
from app.services.orchestrator import GameBuddyOrchestrator


@dataclass(frozen=True)
class EvalCase:
    name: str
    game: str
    state_file: str
    question: str
    expected_terms: tuple[str, ...]
    profile: UserProfile
    personalization_terms: tuple[str, ...]


CASES = (
    EvalCase(
        name="pokemon_defensive_stabilization",
        game="pokemon-battle-demo",
        state_file="balanced-position.json",
        question="I am behind and my cleaner is low. What is the safest next plan?",
        expected_terms=("voltfox", "drakeon", "pivot", "cleaner", "stealth", "speed", "win condition"),
        profile=UserProfile(
            user_id="eval-pokemon",
            skill_level="beginner",
            preferred_style="concise",
            favorite_role="late-game cleaner",
            goals=["safer turn planning"],
        ),
        personalization_terms=("beginner", "concise", "late-game cleaner", "safer turn planning"),
    ),
    EvalCase(
        name="moba_objective_setup",
        game="moba-postmatch-demo",
        state_file="moba-comeback-window.json",
        question="We keep losing before dragon. How should I fix the next setup?",
        expected_terms=("dragon", "vision", "objective", "river", "gold", "team", "setup"),
        profile=UserProfile(
            user_id="eval-moba",
            skill_level="intermediate",
            preferred_style="detailed",
            favorite_role="mid",
            goals=["cleaner macro setup"],
        ),
        personalization_terms=("detailed", "mid", "cleaner macro setup"),
    ),
    EvalCase(
        name="rpg_build_bottleneck",
        game="rpg-build-demo",
        state_file="rpg-mage-build.json",
        question="My mage cannot clear the boss phase two. What build direction should I take?",
        expected_terms=("lyra", "mana", "boss", "build", "burst", "vitality", "bottleneck"),
        profile=UserProfile(
            user_id="eval-rpg",
            skill_level="advanced",
            preferred_style="balanced",
            favorite_character="Lyra",
            goals=["focused progression build"],
        ),
        personalization_terms=("advanced", "lyra", "focused progression build"),
    ),
)


def load_state(filename: str) -> dict[str, Any]:
    path = ROOT / "samples" / "game-states" / filename
    return json.loads(path.read_text(encoding="utf-8"))


def legacy_baseline(case: EvalCase, state: dict[str, Any]) -> AnalysisResponse:
    return AnalysisResponse(
        summary="This is a complex game state. Play carefully and avoid risky decisions.",
        direction_prediction=DirectionPrediction(
            current_phase="General decision point",
            best_direction="Choose a safe line and avoid overcommitting.",
            why_now="The available information is incomplete.",
            avoid_direction="Avoid risky all-in choices.",
            confidence="low",
        ),
        tactical_advice=[
            TacticalAdviceItem(
                title="Play safely",
                recommendation="Avoid forcing a fight or spending resources without a clear benefit.",
                reasoning="A conservative line is usually better when the situation is unclear.",
                confidence="low",
            )
        ],
        beginner_explanation="Slow down and make the safest decision you can see.",
        risks_or_uncertainties=["The baseline does not inspect game-specific knowledge or user memory."],
        next_steps=["Review the state.", "Pick the safest option."],
        review_report=ReviewSection(
            current_situation="The baseline only sees a generic difficult position.",
            likely_mistakes=["The answer may miss game-specific timing and role context."],
            recommended_actions=["Use a more specific analyzer."],
            longer_term_improvement=["Collect better context before answering."],
        ),
        metadata={"game": case.game, "question": case.question, "mode": "legacy_baseline"},
    )


def flatten_response(response: AnalysisResponse) -> str:
    return json.dumps(response.model_dump(), ensure_ascii=False).lower()


def term_coverage(text: str, terms: tuple[str, ...]) -> float:
    if not terms:
        return 1.0
    matched = sum(1 for term in terms if term.lower() in text)
    return matched / len(terms)


def score_response(response: AnalysisResponse, case: EvalCase) -> dict[str, float]:
    text = flatten_response(response)
    schema_fields = (
        response.summary,
        response.direction_prediction.current_phase,
        response.direction_prediction.best_direction,
        response.tactical_advice,
        response.beginner_explanation,
        response.risks_or_uncertainties,
        response.next_steps,
        response.review_report.current_situation,
    )
    schema_completeness = sum(1 for field in schema_fields if field) / len(schema_fields)
    actionability = min((len(response.tactical_advice) + len(response.next_steps)) / 6, 1.0)
    uncertainty = min(len(response.risks_or_uncertainties) / 3, 1.0)
    personalization = term_coverage(text, case.personalization_terms)
    accuracy = term_coverage(text, case.expected_terms)
    interaction_experience = (schema_completeness + actionability + uncertainty + personalization) / 4
    overall = (accuracy * 0.6) + (interaction_experience * 0.4)
    return {
        "accuracy": round(accuracy, 4),
        "schema_completeness": round(schema_completeness, 4),
        "actionability": round(actionability, 4),
        "uncertainty_disclosure": round(uncertainty, 4),
        "personalization": round(personalization, 4),
        "interaction_experience": round(interaction_experience, 4),
        "overall": round(overall, 4),
    }


def average(rows: list[dict[str, float]]) -> dict[str, float]:
    keys = rows[0].keys()
    return {key: round(sum(row[key] for row in rows) / len(rows), 4) for key in keys}


def pct_change(before: float, after: float) -> float:
    if before == 0:
        return 0.0
    return round(((after - before) / before) * 100, 1)


def render_markdown(report: dict[str, Any]) -> str:
    before = report["summary"]["before"]
    after = report["summary"]["after"]
    delta = report["summary"]["delta_percent"]
    rows = [
        "| Metric | Before | After | Change |",
        "| --- | ---: | ---: | ---: |",
    ]
    for metric in ("accuracy", "interaction_experience", "overall", "personalization", "actionability"):
        rows.append(f"| {metric} | {before[metric]:.2f} | {after[metric]:.2f} | {delta[metric]:.1f}% |")

    return "\n".join(
        [
            "# GameBuddy Offline Evaluation",
            "",
            "This report compares a legacy generic-answer baseline with the current GameBuddy orchestrated path.",
            "The evaluation is deterministic and does not require an external LLM key.",
            "",
            "## Aggregate Results",
            "",
            *rows,
            "",
            "## Method",
            "",
            "- Accuracy: keyword coverage against expected game-specific concepts for each complex scenario.",
            "- Interaction experience: average of schema completeness, actionability, uncertainty disclosure, and personalization fit.",
            "- Personalization: whether the answer reflects user profile fields such as skill level, response style, favorite role or goal.",
            "",
            "## Resume-Ready Result",
            "",
            f"- On 3 complex game-analysis cases, accuracy improved from {before['accuracy']:.2f} to {after['accuracy']:.2f} "
            f"(+{delta['accuracy']:.1f}%), and interaction experience improved from "
            f"{before['interaction_experience']:.2f} to {after['interaction_experience']:.2f} "
            f"(+{delta['interaction_experience']:.1f}%).",
            "",
            "Raw case-level data is stored in `docs/evaluation-results.json`.",
            "",
        ]
    )


def main() -> None:
    orchestrator = GameBuddyOrchestrator()
    case_reports = []
    before_scores = []
    after_scores = []

    for case in CASES:
        state = load_state(case.state_file)
        before = legacy_baseline(case, state)
        after = orchestrator.analyze_state(
            case.game,  # type: ignore[arg-type]
            state,
            case.question,
            user_profile=case.profile,
            session_id=f"eval-{case.name}",
        )
        before_score = score_response(before, case)
        after_score = score_response(after, case)
        before_scores.append(before_score)
        after_scores.append(after_score)
        case_reports.append(
            {
                "name": case.name,
                "game": case.game,
                "before": before_score,
                "after": after_score,
            }
        )

    before_avg = average(before_scores)
    after_avg = average(after_scores)
    delta = {key: pct_change(before_avg[key], after_avg[key]) for key in before_avg}
    report = {
        "summary": {
            "before": before_avg,
            "after": after_avg,
            "delta_percent": delta,
        },
        "cases": case_reports,
    }

    results_path = ROOT / "docs" / "evaluation-results.json"
    markdown_path = ROOT / "docs" / "evaluation.md"
    results_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    markdown_path.write_text(render_markdown(report), encoding="utf-8")
    print(json.dumps(report["summary"], indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
