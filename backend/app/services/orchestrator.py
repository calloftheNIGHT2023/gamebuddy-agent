from app.agents.knowledge import KnowledgeAgent
from app.agents.perception import PerceptionAgent
from app.agents.review import ReviewAgent
from app.agents.strategy import StrategyAgent
from app.models.schemas import AnalysisResponse, BattleState, PerceptionResult


class GameBuddyOrchestrator:
    def __init__(self) -> None:
        self.perception = PerceptionAgent()
        self.knowledge = KnowledgeAgent()
        self.strategy = StrategyAgent()
        self.review = ReviewAgent()

    def analyze_state(self, state: BattleState, question: str) -> AnalysisResponse:
        perception = self.perception.parse_state(state)
        return self._build_response(perception, question)

    def _build_response(self, perception: PerceptionResult, question: str) -> AnalysisResponse:
        knowledge = self.knowledge.build_context(perception.extracted_state)
        tactical_advice, risks, next_steps = self.strategy.generate(perception.extracted_state, question, knowledge)
        review = self.review.summarize(perception.extracted_state, [item.title for item in tactical_advice])

        summary = (
            f"GameBuddy sees a {perception.extracted_state.player.momentum} tempo position on turn "
            f"{perception.extracted_state.turn}. The best next move is to protect your win condition while "
            f"respecting the opponent's immediate pressure."
        )
        beginner_explanation = (
            "Think of this turn as a choice between short-term damage and keeping your best piece alive for later. "
            "Beginners usually improve fastest by choosing the safer line when key information is still hidden."
        )

        return AnalysisResponse(
            summary=summary,
            tactical_advice=tactical_advice,
            beginner_explanation=beginner_explanation,
            risks_or_uncertainties=risks + perception.perception_notes,
            next_steps=next_steps or knowledge["beginner_tips"][:3],
            review_report=review,
            metadata={
                "game": "pokemon-battle-demo",
                "question": question,
                "perception_confidence": perception.confidence,
                "turn": perception.extracted_state.turn,
            },
        )

    async def analyze_screenshot(self, filename: str | None, question: str) -> AnalysisResponse:
        perception = await self.perception.parse_screenshot(filename=filename)
        return self._build_response(perception, question)
