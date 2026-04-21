import json

from fastapi import APIRouter, File, Form, UploadFile

from app.models.schemas import AnalysisResponse, StateAnalysisRequest, SupportedGame, UserProfile
from app.services.orchestrator import GameBuddyOrchestrator

# 这个路由模块只做“HTTP 层”的工作：
# - 接收前端请求
# - 校验请求结构（依赖 Pydantic schema）
# - 调用编排器
# - 把结果按统一响应模型返回
# 它本身不承载游戏分析逻辑。
router = APIRouter(tags=["analysis"])
orchestrator = GameBuddyOrchestrator()


@router.post("/analyze/state", response_model=AnalysisResponse)
def analyze_state(payload: StateAnalysisRequest) -> AnalysisResponse:
    # 结构化状态分析入口。
    # 前端会直接提交 JSON 形式的游戏状态，
    # 例如当前回合、双方单位血量、地图目标、装备方向等。
    # 这里不做业务推理，只把数据交给 orchestrator。
    return orchestrator.analyze_state(
        payload.game,
        payload.state,
        payload.question,
        user_profile=payload.user_profile,
        session_id=payload.session_id,
    )


@router.post("/analyze/screenshot", response_model=AnalysisResponse)
async def analyze_screenshot(
    question: str = Form(...),
    game: SupportedGame = Form("pokemon-battle-demo"),
    file: UploadFile = File(...),
    session_id: str | None = Form(default=None),
    user_profile_json: str | None = Form(default=None),
) -> AnalysisResponse:
    # 截图分析入口。
    # 当前 MVP 版本里，这条链路还是“占位实现”：
    # 后端会记录文件名，并按所选游戏回退到内置样例状态，
    # 而不是真正执行 OCR / HUD 提取 / 视觉识别。
    user_profile = _parse_user_profile(user_profile_json)
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
