from pathlib import Path
import json
from typing import Any

from app.models.schemas import AnalysisResponse, DirectionPrediction, PerceptionResult, ReviewSection, SupportedGame, TacticalAdviceItem
from app.services.openrouter_client import maybe_enhance_analysis

SUPPORTED_GAMES: tuple[SupportedGame, ...] = (
    "pokemon-battle-demo",
    "moba-postmatch-demo",
    "rpg-build-demo",
)


def _sample_state(game: SupportedGame) -> dict[str, Any]:
    root = Path(__file__).resolve().parents[3] / "samples" / "game-states"
    filename = {
        "pokemon-battle-demo": "balanced-position.json",
        "moba-postmatch-demo": "moba-comeback-window.json",
        "rpg-build-demo": "rpg-mage-build.json",
    }[game]
    return json.loads((root / filename).read_text(encoding="utf-8"))


def build_screenshot_perception(game: SupportedGame, filename: str | None) -> PerceptionResult:
    notes = [
        "Screenshot mode is intentionally lightweight in the MVP.",
        "Visual parsing is mocked with a game-specific sample state.",
    ]
    if filename:
        notes.append(f"Uploaded file received: {filename}")
    return PerceptionResult(
        source="screenshot",
        game=game,
        confidence=0.42,
        extracted_state=_sample_state(game),
        perception_notes=notes,
    )


def build_json_perception(game: SupportedGame, state: dict[str, Any]) -> PerceptionResult:
    return PerceptionResult(
        source="json",
        game=game,
        confidence=0.95,
        extracted_state=state,
        perception_notes=["Structured state provided directly by the user."],
    )


def analyze_game(perception: PerceptionResult, question: str) -> AnalysisResponse:
    handlers = {
        "pokemon-battle-demo": _analyze_pokemon,
        "moba-postmatch-demo": _analyze_moba,
        "rpg-build-demo": _analyze_rpg,
    }
    heuristic = handlers[perception.game](perception, question)
    return maybe_enhance_analysis(
        game=perception.game,
        question=question,
        extracted_state=perception.extracted_state,
        heuristic=heuristic,
    )


def _analyze_pokemon(perception: PerceptionResult, question: str) -> AnalysisResponse:
    state = perception.extracted_state
    player = state["player"]["active"]
    opponent = state["opponent"]["active"]
    momentum = state["player"]["momentum"]
    turn = state["turn"]
    advice: list[TacticalAdviceItem] = []
    risks: list[str] = []
    next_steps: list[str] = []

    if player["current_hp_percent"] <= 40:
        advice.append(
            TacticalAdviceItem(
                title="Protect your win condition",
                recommendation=f"Avoid leaving {player['name']} in unless it secures meaningful value immediately.",
                reasoning="Your active threat is already chipped, so preserving it keeps your late-game route intact.",
                confidence="high",
            )
        )
        next_steps.append("Find the safest pivot that keeps your cleaner alive.")

    if "stealth-rock" in state["opponent"]["hazards"]:
        advice.append(
            TacticalAdviceItem(
                title="Respect hazard chip",
                recommendation="Do not switch casually. Pivot only when the board position clearly improves.",
                reasoning="Chip damage shrinks your comeback lines and makes later turns much less flexible.",
                confidence="medium",
            )
        )

    if momentum == "behind":
        advice.append(
            TacticalAdviceItem(
                title="Stabilize before forcing damage",
                recommendation="Trade for information or safety first, then look for a cleaner attack sequence.",
                reasoning="When behind, low-risk stabilization usually produces better recovery turns than hard reads.",
                confidence="medium",
            )
        )
        next_steps.append("Choose the line that reduces how many threats beat you next turn.")

    if not advice:
        advice.append(
            TacticalAdviceItem(
                title="Convert your edge cleanly",
                recommendation="Keep tempo and avoid overpredicting when a safe line already advances your win condition.",
                reasoning="Disciplined sequencing is stronger than speculative reads from an already-manageable position.",
                confidence="medium",
            )
        )

    if opponent["speed_tier"] == "fast":
        risks.append(f"{opponent['name']} remains an immediate speed threat.")
    if not state.get("revealed_threats"):
        risks.append("Some opposing information is still hidden, so exact planning may change next turn.")

    if state.get("win_condition_hint"):
        next_steps.append(f"Play toward this win condition: {state['win_condition_hint']}")
    if "mistake" in question.lower():
        next_steps.append("Review whether you exposed your cleaner too early before scouting speed control.")

    if momentum == "behind" and player["current_hp_percent"] <= 40:
        direction_prediction = DirectionPrediction(
            current_phase="Defensive stabilization before your late-game cleaner can win",
            best_direction=f"Use a low-risk pivot line that chips or scouts {opponent['name']} without cashing in {player['name']} too early.",
            why_now="This board is not in the stage where hard predictions are rewarded. Your best piece is already damaged, so preserving endgame value matters more than forcing immediate damage.",
            avoid_direction="Do not treat this like an all-in attack turn unless it directly secures a critical knockout.",
            confidence="high",
        )
    else:
        direction_prediction = DirectionPrediction(
            current_phase="Manageable tempo turn with room to convert value",
            best_direction="Advance your win condition through the safest sequence that preserves flexibility next turn.",
            why_now="When the board is not collapsing, the strongest direction is usually the one that keeps your best closer healthy while narrowing the opponent's comeback routes.",
            avoid_direction="Avoid overpredicting into a speculative line when a safer route already improves the position.",
            confidence="medium",
        )

    review = ReviewSection(
        current_situation=f"Turn {turn}: {player['name']} is facing {opponent['name']} with momentum {momentum}.",
        likely_mistakes=[
            "Your active unit may have been exposed too early to chip damage.",
            "You may have ceded tempo without gaining enough information."
        ] if momentum == "behind" else ["No obvious blunder is guaranteed from a single snapshot alone."],
        recommended_actions=[
            "Preserve your best closer.",
            "Prefer lower-risk sequencing if key information is still hidden.",
        ],
        longer_term_improvement=[
            "Name your win condition before choosing a move.",
            "Track hazard chip and speed control more deliberately.",
            "Review when a safe switch would have preserved more endgame value.",
        ],
    )
    return AnalysisResponse(
        summary=f"GameBuddy sees a {momentum} tempo position on turn {turn}. Protect your key piece and avoid unnecessary risk.",
        direction_prediction=direction_prediction,
        tactical_advice=advice[:4],
        beginner_explanation="Think of this turn as balancing damage now against keeping your best piece useful later.",
        risks_or_uncertainties=risks + perception.perception_notes,
        next_steps=next_steps[:4] or ["Take the safest line that preserves your win condition."],
        review_report=review,
        metadata={"game": perception.game, "question": question, "perception_confidence": perception.confidence, "turn": turn},
    )


def _analyze_moba(perception: PerceptionResult, question: str) -> AnalysisResponse:
    state = perception.extracted_state
    role = state["player_role"]
    champion = state["champion"]
    game_time = state["game_time_minutes"]
    gold_diff = state["team_gold_diff"]
    objective = state["next_objective"]

    advice = [
        TacticalAdviceItem(
            title="Play for the next objective window",
            recommendation=f"Use the next {objective} timer as your anchor instead of taking isolated fights.",
            reasoning="MOBA mid-game mistakes often come from fighting before waves, vision, and item spikes are aligned.",
            confidence="high" if gold_diff >= -2500 else "medium",
        ),
        TacticalAdviceItem(
            title="Reduce unforced deaths",
            recommendation="Only contest side vision or deep space if your nearest teammates can collapse with you.",
            reasoning="When behind or even, solo face-checking is usually the fastest way to lose map control.",
            confidence="high",
        ),
        TacticalAdviceItem(
            title="Translate farm into impact",
            recommendation=f"As {champion}, show up early to the setup phase rather than arriving late after one more wave.",
            reasoning="Strong post-match reviews usually reveal that timing errors matter more than one missed camp or wave.",
            confidence="medium",
        ),
    ]

    risks = [
        f"Current team gold difference is {gold_diff}, so forcing low-information fights is risky.",
        f"The enemy carry threat identified in this snapshot is {state['enemy_carry_threat']}.",
    ]

    next_steps = [
        f"Sync vision, lane priority, and cooldown tracking before the next {objective} fight.",
        "Review the last two deaths and ask whether they happened before your team was actually in range.",
        "Ping your intended timing earlier so teammates can arrive on the same page.",
    ]

    setup_confidence = "high" if gold_diff >= -2500 and game_time >= 14 else "medium"
    direction_prediction = DirectionPrediction(
        current_phase=f"Mid-game pre-{objective} setup window",
        best_direction=f"Shift the team into objective setup mode: arrive early, stabilize vision, and use waves to create a cleaner {objective} contest.",
        why_now=f"At {game_time} minutes with a {gold_diff} gold state, the next swing comes more from coordinated setup than from taking another disconnected fight. The snapshot already points to late arrivals and river picks as the main leak.",
        avoid_direction="Do not spend this phase on one more greedy side wave, blind river face-checks, or isolated skirmishes away from the objective timer.",
        confidence=setup_confidence,
    )

    review = ReviewSection(
        current_situation=f"{game_time} minutes, role {role}, champion {champion}, next objective {objective}.",
        likely_mistakes=[
            "Taking fights before wave priority or vision setup was complete.",
            "Giving away deaths in transition between lanes and objectives.",
            "Arriving to objective setups too late to control space.",
        ],
        recommended_actions=[
            "Anchor your decisions to objective timing rather than random skirmishes.",
            "Shorten your pathing risk when key enemy engage tools are off vision.",
            "Treat every death before objective spawn as a strategic cost, not just a stat line.",
        ],
        longer_term_improvement=[
            "Review map movement 45 seconds before every major objective.",
            "Track whether your recalls and rotations line up with item breakpoints.",
            "Build the habit of asking what fight your team is actually trying to take.",
        ],
    )
    return AnalysisResponse(
        summary=f"Your strongest MOBA improvement point is cleaner setup around {objective}, not more random fighting.",
        direction_prediction=direction_prediction,
        tactical_advice=advice,
        beginner_explanation="In MOBAs, the best next move is often about map timing and positioning, not raw mechanics.",
        risks_or_uncertainties=risks + perception.perception_notes,
        next_steps=next_steps,
        review_report=review,
        metadata={"game": perception.game, "question": question, "perception_confidence": perception.confidence, "minute": game_time},
    )


def _analyze_rpg(perception: PerceptionResult, question: str) -> AnalysisResponse:
    state = perception.extracted_state
    build_focus = state["build_focus"]
    character = state["character_name"]
    level = state["level"]
    target = state["current_goal"]
    pain_point = state["pain_point"]
    mana_regen = state["core_stats"]["mana_regen"]
    vitality = state["core_stats"]["vitality"]

    advice = [
        TacticalAdviceItem(
            title="Commit to one build direction",
            recommendation=f"Center {character}'s next upgrades around {build_focus} instead of spreading resources across unrelated stats.",
            reasoning="RPG builds usually feel weak when they invest broadly without reaching a meaningful threshold.",
            confidence="high",
        ),
        TacticalAdviceItem(
            title="Fix the weakest slot first",
            recommendation=f"Upgrade or replace the lowest-impact item before chasing a premium late-game piece for {target}.",
            reasoning="Early-to-mid build strength usually comes from removing bottlenecks, not from dreaming about the final perfect item.",
            confidence="medium",
        ),
        TacticalAdviceItem(
            title="Align gear with the content goal",
            recommendation=f"Optimize for {target} specifically, even if that means passing on generally good but mismatched stats.",
            reasoning="A build that is excellent for bosses may still be inefficient for farming, survivability, or mana stability.",
            confidence="medium",
        ),
    ]

    risks = [
        f"Current pain point: {state['pain_point']}.",
        "If resources are limited, respec pressure or over-upgrading temporary gear can slow progress.",
    ]

    next_steps = [
        "Pick the next 2-3 upgrades that directly reinforce your chosen build identity.",
        "Stop investing in side stats that do not improve your target content.",
        "Compare your current itemization against the minimum thresholds your goal actually demands.",
    ]

    if mana_regen <= 18 or vitality <= 26:
        direction_prediction = DirectionPrediction(
            current_phase="Pre-boss bottleneck-fixing stage",
            best_direction=f"Prioritize mana stability and mistake tolerance for {target} before investing into more hybrid damage scaling.",
            why_now=f"Your current blocker is not abstract late-game optimization. It is the concrete failure pattern: {pain_point}. That means the strongest direction is the one that gets the build through the second phase consistently.",
            avoid_direction="Do not branch into hybrid fire and ice scaling or luxury damage upgrades until the boss-specific sustain checks are solved.",
            confidence="high",
        )
    else:
        direction_prediction = DirectionPrediction(
            current_phase="Focused progression optimization stage",
            best_direction=f"Keep the build narrow and tune the next upgrades directly around clearing {target}.",
            why_now="Once the biggest survivability and resource bottlenecks are under control, the strongest route is targeted optimization for the exact content gate in front of you.",
            avoid_direction="Avoid broad, comfort-driven upgrades that do not move the target clear condition.",
            confidence="medium",
        )

    review = ReviewSection(
        current_situation=f"{character} is level {level} and currently aiming for {target}.",
        likely_mistakes=[
            "Too many upgrade resources may be spread across competing priorities.",
            "The build may be carrying flexible items that do not meaningfully support the chosen goal.",
            "The current stat mix may be solving comfort problems instead of the real progression bottleneck.",
        ],
        recommended_actions=[
            f"Lock the build identity around {build_focus}.",
            "Use upgrades to remove bottlenecks before chasing luxury optimization.",
            "Treat every item slot as part of one coherent progression plan.",
        ],
        longer_term_improvement=[
            "Document which upgrades gave the biggest jump in survivability or damage.",
            "Build one reliable progression path before experimenting with hybrid setups.",
            "Match your build review to the exact activity you want to clear next.",
        ],
    )
    return AnalysisResponse(
        summary=f"Your RPG build should get narrower and more goal-driven before it gets more expensive.",
        direction_prediction=direction_prediction,
        tactical_advice=advice,
        beginner_explanation="Most RPG builds improve faster when they focus on one clear plan instead of trying to be good at everything.",
        risks_or_uncertainties=risks + perception.perception_notes,
        next_steps=next_steps,
        review_report=review,
        metadata={"game": perception.game, "question": question, "perception_confidence": perception.confidence, "level": level},
    )
