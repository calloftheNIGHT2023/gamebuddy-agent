from fastapi import APIRouter, Query

from app.models.schemas import AnalysisHistoryItem, UserProfile, UserProfileUpsertRequest
from app.services.mongo_store import mongo_store

router = APIRouter(tags=["memory"])


@router.get("/memory/profile/{user_id}", response_model=UserProfile | None)
def get_user_profile(user_id: str) -> UserProfile | None:
    return mongo_store.load_user_profile(user_id)


@router.post("/memory/profile", response_model=UserProfile)
def upsert_user_profile(payload: UserProfileUpsertRequest) -> UserProfile:
    profile = UserProfile.model_validate(payload.model_dump())
    mongo_store.upsert_user_profile(profile)
    return profile


@router.get("/memory/history", response_model=list[AnalysisHistoryItem])
def get_analysis_history(
    user_id: str | None = Query(default=None),
    session_id: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
) -> list[AnalysisHistoryItem]:
    return mongo_store.list_analysis_history(user_id=user_id, session_id=session_id, limit=limit)
