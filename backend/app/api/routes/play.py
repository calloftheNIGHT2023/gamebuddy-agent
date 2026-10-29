"""Native browser games: stateless public coaching and optional private traces."""

from time import perf_counter
from uuid import uuid4

from fastapi import APIRouter, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from app.models.field_game import FieldAnalysisRequest
from app.models.schemas import AnalysisResponse, UserProfile
from app.security import RequestAccess, request_access
from app.services import ops
from app.services.field_game import LEGACY_GAMES, POLICY, analyze_field_game
from app.services.game_packs import _apply_profile_hints
from app.services.mongo_store import mongo_store
from app.services.player_memory import attach_memory, game_memory_key, remember_game, resolve_memory


class NativeGameRoute(APIRoute):
    def get_route_handler(self):
        handler = super().get_route_handler()

        async def validate(request: Request):
            try:
                return await handler(request)
            except RequestValidationError as error:
                # Raw NaN/Infinity inputs cannot be echoed in a JSON response.
                # This route only needs the bounded field path and explanation.
                detail = [{key: item[key] for key in ("type", "loc", "msg")} for item in error.errors()]
                return JSONResponse(status_code=422, content={"detail": detail})

        return validate


router = APIRouter(prefix="/play", tags=["native-games"], route_class=NativeGameRoute)


@router.post("/analyze", response_model=AnalysisResponse)
def analyze(payload: FieldAnalysisRequest, access: RequestAccess = Depends(request_access)) -> AnalysisResponse:
    started = perf_counter()
    response = analyze_field_game(payload)
    profile = None
    if not access.is_public:
        if payload.player_id:
            profile = mongo_store.merge_user_profile(UserProfile(user_id=payload.player_id))
            profile, memory = resolve_memory(profile, payload.scene, f"{payload.scene} 移动 体力 休息 药水 战斗 {payload.state.last_action}", exclude_memory_key=game_memory_key(payload.state, payload.run_id))
            response = _apply_profile_hints(response, profile)
            attach_memory(response, memory)
        identifier = uuid4().hex
        response.metadata["trace_id"] = identifier
        if payload.player_id:
            recorded = remember_game(payload.player_id, payload.scene, payload.state, payload.run_id, identifier)
            if recorded:
                response.metadata["memory"]["recorded_episode_id"] = recorded.id
        ops.save_trace({
            "id": identifier, "created_at": ops.now(), "game": LEGACY_GAMES[payload.scene],
            "task": "field-game", "question": "分析当前棋盘的下一步行动", "policy_id": POLICY["id"],
            "policy_snapshot": {key: POLICY[key] for key in ("id", "prompt", "instructions", "max_next_steps")},
            "session_id": None, "user_profile": profile.model_dump() if profile else None, "state": payload.state.model_dump(),
            "status": "success", "response": response.model_dump(),
            "steps": [{"name": "native-board-analysis", "duration_ms": round((perf_counter() - started) * 1000, 3), "data": {"scene": payload.scene, "source": "field-game", "distance": response.metadata.get("distance"), "path": response.metadata.get("path")}}],
            "latency_ms": round((perf_counter() - started) * 1000, 3),
        })
    return response
