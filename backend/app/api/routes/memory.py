"""记忆相关路由，封装画像和历史记录的读写接口。"""

import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response as ApiResponse
from fastapi.responses import Response

from app.models.schemas import AnalysisHistoryItem, AnalysisResponse, FeedbackItem, FeedbackRequest, TrainingSample, UserProfile, UserProfileUpsertRequest
from app.services import ops
from app.services.mongo_store import mongo_store
from app.security import require_private_access
from app.models.player_memory import MemoryEdit, MemoryGame, MemoryWrite, PlayerMemory
from app.services.player_memory import MemoryConflict, player_memory


def no_cache(response: ApiResponse):
    response.headers["Cache-Control"] = "no-store"

router = APIRouter(tags=["memory"], dependencies=[Depends(require_private_access), Depends(no_cache)])


def memory_result(operation):
    try:
        return operation()
    except MemoryConflict as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except KeyError as error:
        raise HTTPException(status_code=404, detail=str(error.args[0])) from error


@router.get("/memory/items", response_model=list[PlayerMemory])
def list_player_memories(user_id: str = Query(min_length=1, max_length=128), game: MemoryGame | None = None):
    return player_memory.list(user_id, game)


@router.post("/memory/items", response_model=PlayerMemory)
def write_player_memory(payload: MemoryWrite):
    return memory_result(lambda: player_memory.put(payload.user_id, payload, payload.expected_revision))


@router.put("/memory/items/{memory_id}", response_model=PlayerMemory)
def edit_player_memory(memory_id: str, payload: MemoryEdit):
    return memory_result(lambda: player_memory.edit(payload.user_id, memory_id, payload.content, payload.ttl_days, payload.expected_revision))


@router.delete("/memory/items/{memory_id}", status_code=204)
def delete_player_memory(memory_id: str, user_id: str = Query(min_length=1, max_length=128), expected_revision: int = Query(ge=1)):
    memory_result(lambda: player_memory.delete(user_id, memory_id, expected_revision))
    return Response(status_code=204, headers={"Cache-Control": "no-store"})


@router.patch("/memory/profile/{user_id}", response_model=UserProfile)
def patch_user_profile(user_id: str, payload: UserProfile):
    if not user_id.strip() or len(user_id) > 128 or (payload.user_id is not None and payload.user_id != user_id):
        raise HTTPException(status_code=422, detail="Player ID must match the profile")
    profile = mongo_store.merge_user_profile(payload.model_copy(update={"user_id": user_id}))
    mongo_store.upsert_user_profile(profile)
    return profile


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


@router.post("/memory/feedback", response_model=FeedbackItem)
def save_feedback(payload: FeedbackRequest) -> FeedbackItem:
    if "trace_id" in payload.response.metadata:
        trace_id = payload.response.metadata["trace_id"]
        if not isinstance(trace_id, str) or not trace_id:
            raise HTTPException(status_code=422, detail="Feedback trace_id must identify a completed trace")
        try:
            trace = ops.get_trace(trace_id)
        except KeyError as exc:
            raise HTTPException(status_code=422, detail="Feedback trace_id was not found") from exc
        if not trace.get("response"):
            raise HTTPException(status_code=422, detail="Only completed traces can be annotated")
        try:
            profile = UserProfile.model_validate(trace["user_profile"]) if trace.get("user_profile") else None
            # Every execution field comes from the stored trace; clients only
            # supply their human judgement and correction.
            payload = FeedbackRequest(
                game=trace["game"], question=trace["question"],
                response=AnalysisResponse.model_validate(trace["response"]),
                extracted_state=trace["state"], user_profile=profile,
                session_id=trace.get("session_id"), user_id=profile.user_id if profile else None,
                rating=payload.rating, correction=payload.correction, tags=payload.tags,
            )
        except (KeyError, ValueError, TypeError) as exc:
            raise HTTPException(status_code=422, detail="Stored trace cannot be annotated") from exc
    return mongo_store.save_feedback(payload)


@router.get("/memory/feedback", response_model=list[FeedbackItem])
def get_feedback(
    user_id: str | None = Query(default=None),
    session_id: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=100),
) -> list[FeedbackItem]:
    return mongo_store.list_feedback(user_id=user_id, session_id=session_id, limit=limit)


@router.get("/memory/training-samples", response_model=list[TrainingSample])
def export_training_samples(
    user_id: str | None = Query(default=None),
    session_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    sample_type: Literal["sft", "preference"] | None = Query(default=None),
) -> list[TrainingSample]:
    kwargs = {"sample_type": sample_type} if sample_type else {}
    return mongo_store.export_training_samples(user_id=user_id, session_id=session_id, limit=limit, **kwargs)


@router.get("/memory/training-samples.jsonl", response_class=Response)
def download_training_samples(
    user_id: str | None = Query(default=None),
    session_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    sample_type: Literal["sft", "preference"] | None = Query(default=None),
) -> Response:
    """Download reviewed records for local private development use."""
    kwargs = {"sample_type": sample_type} if sample_type else {}
    samples = mongo_store.export_training_samples(user_id=user_id, session_id=session_id, limit=limit, **kwargs)
    content = "".join(json.dumps(item.model_dump(mode="json"), ensure_ascii=False) + "\n" for item in samples)
    return Response(
        content=content,
        media_type="application/x-ndjson",
        headers={
            "Content-Disposition": 'attachment; filename="gamebuddy-training-samples.jsonl"',
            "Cache-Control": "no-store",
            "X-Data-Usage": "local-private-development",
        },
    )
