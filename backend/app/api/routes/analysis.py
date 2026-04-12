from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from app.models.schemas import AnalysisResponse, StateAnalysisRequest
from app.services.orchestrator import GameBuddyOrchestrator

router = APIRouter(tags=["analysis"])
orchestrator = GameBuddyOrchestrator()


@router.post("/analyze/state", response_model=AnalysisResponse)
def analyze_state(payload: StateAnalysisRequest) -> AnalysisResponse:
    if payload.game != "pokemon-battle-demo":
        raise HTTPException(status_code=400, detail="Only pokemon-battle-demo is supported in the MVP.")
    return orchestrator.analyze_state(payload.state, payload.question)


@router.post("/analyze/screenshot", response_model=AnalysisResponse)
async def analyze_screenshot(question: str = Form(...), file: UploadFile = File(...)) -> AnalysisResponse:
    return await orchestrator.analyze_screenshot(file.filename, question)
