"""分析路由，只负责解析请求并转交编排层执行。"""

import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.models.schemas import AnalysisResponse, AssistantRequest, AssistantResponse, StateAnalysisRequest, SupportedGame, UserProfile
from app.services import ops
from app.services.orchestrator import GameBuddyOrchestrator
from app.security import RequestAccess, public_policy_id, public_profile, request_access

# 这个路由模块只做“HTTP 层”的工作：
# - 接收前端请求
# - 校验请求结构（依赖 Pydantic schema）
# - 调用编排器
# - 把结果按统一响应模型返回
# 它本身不承载游戏分析逻辑。
router = APIRouter(tags=["analysis"])
orchestrator = GameBuddyOrchestrator()


@router.post("/analyze/state", response_model=AnalysisResponse)
def analyze_state(payload: StateAnalysisRequest, access: RequestAccess = Depends(request_access)) -> AnalysisResponse:
    # 结构化状态分析入口。
    # 前端会直接提交 JSON 形式的游戏状态，
    # 例如当前回合、双方单位血量、地图目标、装备方向等。
    # 这里不做业务推理，只把数据交给 orchestrator。
    return orchestrator.analyze_state(
        payload.game,
        payload.state,
        payload.question,
        **_execution_options(payload, access),
    )


@router.post("/assistant", response_model=AssistantResponse)
def assistant(payload: AssistantRequest, access: RequestAccess = Depends(request_access)) -> AssistantResponse:
    return orchestrator.assistant(
        payload.game, payload.task, payload.state, payload.question,
        **_execution_options(payload, access),
    )


def _execution_options(payload: StateAnalysisRequest | AssistantRequest, access: RequestAccess) -> dict:
    if access.is_public:
        return {
            "user_profile": public_profile(payload.user_profile), "session_id": None,
            "policy_id": public_policy_id(payload.policy_id), "persist": False, "record_trace": False,
        }
    _check_policy(payload.policy_id)
    return {
        "user_profile": payload.user_profile, "session_id": payload.session_id,
        "policy_id": payload.policy_id, "persist": True, "record_trace": True,
    }


def _check_policy(policy_id: str | None) -> None:
    try:
        ops.get_policy(policy_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Policy version not found") from exc


@router.post("/analyze/screenshot", response_model=AnalysisResponse)
async def analyze_screenshot(
    question: str = Form(...),
    game: SupportedGame = Form("pokemon-battle-demo"),
    file: UploadFile = File(...),
    session_id: str | None = Form(default=None),
    user_profile_json: str | None = Form(default=None),
    access: RequestAccess = Depends(request_access),
) -> AnalysisResponse:
    # 截图分析入口。
    # 当前 MVP 版本里，这条链路还是“占位实现”：
    # 后端会记录文件名，并按所选游戏回退到内置样例状态，
    # 而不是真正执行 OCR / HUD 提取 / 视觉识别。
    if access.is_public:
        raise HTTPException(status_code=403, detail="Screenshot analysis is a private demo; use anonymous structured analysis or knowledge questions instead.")
    if not question.strip() or len(question) > 4000:
        raise HTTPException(status_code=422, detail="question must contain 1 to 4000 characters")
    try:
        user_profile = _parse_user_profile(user_profile_json)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="Invalid user_profile_json") from exc
    return await orchestrator.analyze_screenshot(
        game,
        file.filename,
        question,
        user_profile=user_profile,
        session_id=session_id,
    )


def _parse_user_profile(raw: str | None) -> UserProfile | None:
    if not raw:
        return None
    return UserProfile.model_validate(json.loads(raw))
