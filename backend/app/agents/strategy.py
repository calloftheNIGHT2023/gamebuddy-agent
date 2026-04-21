"""策略 agent，根据状态和知识上下文生成启发式建议。"""

from app.models.schemas import BattleState, TacticalAdviceItem


class StrategyAgent:
    def generate(
        self, state: BattleState, question: str, knowledge: dict
    ) -> tuple[list[TacticalAdviceItem], list[str], list[str]]:
        player = state.player.active
        opponent = state.opponent.active
        risks: list[str] = []
        next_steps: list[str] = []
        advice: list[TacticalAdviceItem] = []

        if player.current_hp_percent <= 35:
            advice.append(
                TacticalAdviceItem(
                    title="Protect your main piece",
                    recommendation=f"Avoid leaving {player.name} in unless it secures a high-value trade.",
                    reasoning="Your active unit is already in range of common follow-up pressure, so preserving it can keep your endgame cleaner.",
                    confidence="high",
                )
            )
            next_steps.append("Identify the safest bench switch that keeps your win condition alive.")

        if opponent.speed_tier == "fast" and player.speed_tier != "fast":
            advice.append(
                TacticalAdviceItem(
                    title="Respect speed control",
                    recommendation=f"Assume {opponent.name} acts first and choose a line that still works if you take damage before moving.",
                    reasoning="Fast threats punish greedy plays. Stable positioning is better than a low-odds prediction in the MVP's incomplete-information setting.",
                    confidence="high",
                )
            )
            risks.append(f"{opponent.name} appears faster than your current active unit.")

        if "stealth-rock" in state.opponent.hazards:
            advice.append(
                TacticalAdviceItem(
                    title="Limit unnecessary switching",
                    recommendation="Only pivot if the switch meaningfully improves board position or protects a key closer.",
                    reasoning="Hazard chip compounds quickly in turn-based battles and can remove later options.",
                    confidence="medium",
                )
            )

        if state.player.momentum == "behind":
            advice.append(
                TacticalAdviceItem(
                    title="Stabilize before forcing damage",
                    recommendation="Trade for information or board control first, then convert that into a cleaner attack window.",
                    reasoning="When behind, low-risk stabilization usually creates stronger recovery lines than all-in aggression.",
                    confidence="medium",
                )
            )
            next_steps.append("Pick the move or switch that reduces the number of opponent threats you lose to next turn.")

        if state.win_condition_hint:
            next_steps.append(f"Play toward this win condition: {state.win_condition_hint}.")

        if not advice:
            advice.append(
                TacticalAdviceItem(
                    title="Press the positional edge",
                    recommendation="Keep tempo, avoid overpredicting, and convert chip damage into a clean knockout window.",
                    reasoning="The current state looks manageable, so disciplined sequencing is stronger than a speculative read.",
                    confidence="medium",
                )
            )

        if not state.revealed_threats:
            risks.append("Several opposing options are still hidden, so precise damage planning may shift after the next reveal.")

        if "mistake" in question.lower():
            next_steps.append("Review whether you exposed a fragile attacker before scouting the opponent's speed control.")

        return advice[:4], risks[:4], next_steps[:4]
