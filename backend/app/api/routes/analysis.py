from fastapi import APIRouter, File, Form, UploadFile

from app.models.schemas import AnalysisResponse, StateAnalysisRequest, SupportedGame
from app.services.orchestrator import GameBuddyOrchestrator

router = APIRouter(tags=["analysis"])
orchestrator = GameBuddyOrchestrator()


@router.post("/analyze/state", response_model=AnalysisResponse)
def analyze_state(payload: StateAnalysisRequest) -> AnalysisResponse:
    return orchestrator.analyze_state(payload.game, payload.state, payload.question)


@router.post("/analyze/screenshot", response_model=AnalysisResponse)
async def analyze_screenshot(
    question: str = Form(...),
    game: SupportedGame = Form("pokemon-battle-demo"),
    file: UploadFile = File(...),
) -> AnalysisResponse:
    return await orchestrator.analyze_screenshot(game, file.filename, question)
