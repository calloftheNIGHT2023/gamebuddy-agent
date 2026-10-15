"""Local development operations API; use a private network for deployment."""

from typing import Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.models.schemas import AnalysisResponse, FeedbackRequest, UserProfile
from app.services import ops
from app.services.local_store import local_store
from app.services.mongo_store import mongo_store

router = APIRouter(prefix="/ops", tags=["agent-ops"])


class PolicyRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    prompt: str = Field(min_length=1, max_length=8000)
    instructions: str = Field(default="", max_length=8000)
    max_next_steps: int = Field(default=4, ge=1, le=8)


class EvalRequest(BaseModel):
    policy_id: str | None = None


class AnnotationRequest(BaseModel):
    rating: Literal["up", "down", "neutral"]
    correction: str | None = Field(default=None, max_length=20000)
    tags: list[str] = Field(default_factory=list, max_length=20)


def found(func, identifier):
    try:
        return func(identifier)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc.args[0])) from exc


@router.get("/summary")
def get_summary():
    return ops.summary()


@router.get("/traces")
def traces(limit: int = Query(default=100, ge=1, le=1000)):
    return ops.list_traces(limit)


@router.get("/traces/{trace_id}")
def trace(trace_id: str):
    return found(ops.get_trace, trace_id)


@router.post("/traces/{trace_id}/feedback")
def annotate(trace_id: str, payload: AnnotationRequest):
    item = found(ops.get_trace, trace_id)
    if not item.get("response"):
        raise HTTPException(status_code=422, detail="Only completed traces can be annotated")
    profile = UserProfile.model_validate(item["user_profile"]) if item.get("user_profile") else None
    return mongo_store.save_feedback(FeedbackRequest(
        game=item["game"], question=item["question"], response=AnalysisResponse.model_validate(item["response"]),
        rating=payload.rating, correction=payload.correction, tags=payload.tags,
        session_id=item.get("session_id"), user_id=profile.user_id if profile else None,
        user_profile=profile, extracted_state=item["state"],
    ))


@router.get("/policies")
def policies():
    return ops.list_policies()


@router.post("/policies", status_code=201)
def create_policy(payload: PolicyRequest):
    return ops.create_policy(payload.model_dump())


@router.post("/policies/{policy_id}/activate")
def activate(policy_id: str):
    return found(ops.activate_policy, policy_id)


@router.get("/evaluations")
def evaluations():
    return local_store.list("evaluations", limit=100)


@router.post("/evaluations", status_code=201)
def evaluate(payload: EvalRequest):
    found(ops.get_policy, payload.policy_id)
    from app.services.evaluation import run_evaluation

    return run_evaluation(payload.policy_id)
