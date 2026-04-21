from app.models.schemas import AnalysisResponse, SupportedGame, UserProfile
from app.services.game_packs import analyze_game, build_json_perception, build_screenshot_perception
from app.services.mongo_store import mongo_store


class GameBuddyOrchestrator:
    def analyze_state(
        self,
        game: SupportedGame,
        state: dict,
        question: str,
        user_profile: UserProfile | None = None,
        session_id: str | None = None,
    ) -> AnalysisResponse:
        perception = build_json_perception(game, state)
        resolved_profile = mongo_store.merge_user_profile(user_profile) or user_profile
        response = analyze_game(perception, question, user_profile=resolved_profile, session_id=session_id)
        mongo_store.upsert_user_profile(resolved_profile)
        mongo_store.save_analysis_history(
            game=game,
            question=question,
            session_id=session_id,
            user_profile=resolved_profile,
            extracted_state=perception.extracted_state,
            response=response,
            source=perception.source,
        )
        return response

    async def analyze_screenshot(
        self,
        game: SupportedGame,
        filename: str | None,
        question: str,
        user_profile: UserProfile | None = None,
        session_id: str | None = None,
    ) -> AnalysisResponse:
        perception = build_screenshot_perception(game, filename)
        resolved_profile = mongo_store.merge_user_profile(user_profile) or user_profile
        response = analyze_game(perception, question, user_profile=resolved_profile, session_id=session_id)
        mongo_store.upsert_user_profile(resolved_profile)
        mongo_store.save_analysis_history(
            game=game,
            question=question,
            session_id=session_id,
            user_profile=resolved_profile,
            extracted_state=perception.extracted_state,
            response=response,
            source=perception.source,
        )
        return response
