from app.models.schemas import AnalysisResponse, SupportedGame
from app.services.game_packs import analyze_game, build_json_perception, build_screenshot_perception


class GameBuddyOrchestrator:
    def analyze_state(self, game: SupportedGame, state: dict, question: str) -> AnalysisResponse:
        perception = build_json_perception(game, state)
        return analyze_game(perception, question)

    async def analyze_screenshot(self, game: SupportedGame, filename: str | None, question: str) -> AnalysisResponse:
        perception = build_screenshot_perception(game, filename)
        return analyze_game(perception, question)
