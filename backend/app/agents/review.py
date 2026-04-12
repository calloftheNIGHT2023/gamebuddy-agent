from app.models.schemas import BattleState, ReviewSection


class ReviewAgent:
    def summarize(self, state: BattleState, advice_titles: list[str]) -> ReviewSection:
        likely_mistakes: list[str] = []
        recommended_actions: list[str] = [
            "Protect your most reliable win condition from unnecessary chip.",
            "Choose safer sequencing before attempting a read-heavy play.",
        ]
        longer_term = [
            "Practice naming your win condition before clicking an attacking move.",
            "Review turns where a safe switch would have preserved more endgame value.",
            "Track speed control and hazard chip more deliberately.",
        ]

        if state.player.active.current_hp_percent < 40:
            likely_mistakes.append("Your active unit is low enough that earlier preservation may have produced a cleaner mid-game.")
        if state.player.momentum == "behind":
            likely_mistakes.append("You likely traded tempo on a previous turn without gaining enough information or damage.")
        if "stealth-rock" in state.opponent.hazards:
            likely_mistakes.append("Repeated switches into hazard pressure may have narrowed your comeback lines.")
        if advice_titles:
            recommended_actions.append(f"Immediate focus area: {advice_titles[0]}.")

        return ReviewSection(
            current_situation=(
                f"Turn {state.turn}: {state.player.active.name} is facing {state.opponent.active.name} "
                f"with momentum currently {state.player.momentum} for the player."
            ),
            likely_mistakes=likely_mistakes or ["No obvious blunder is visible from the current snapshot alone."],
            recommended_actions=recommended_actions,
            longer_term_improvement=longer_term,
        )
