"""后端共享数据模型，统一约束请求、响应和工具调用结构。"""

from typing import Any, Literal

from pydantic import BaseModel, Field


# 当前后端允许的游戏类型枚举。
# 这里直接用 Literal，既简单，也能让 FastAPI / Pydantic 自动做校验和文档生成。
SupportedGame = Literal["pokemon-battle-demo", "moba-postmatch-demo", "rpg-build-demo"]


class PerceptionResult(BaseModel):
    # source 表示输入来源：
    # - json: 用户直接提交结构化状态
    # - screenshot: 用户上传截图，后端做感知或占位模拟
    source: Literal["json", "screenshot"]
    game: SupportedGame
    # confidence 表示“感知阶段”对提取状态的信心，不是最终策略正确率。
    confidence: float = Field(ge=0.0, le=1.0)
    # extracted_state 是后续策略分析真正依赖的统一状态对象。
    extracted_state: dict[str, Any]
    # perception_notes 用来显式记录感知层限制与补充信息，
    # 比如“截图模式当前只是模拟状态”。
    perception_notes: list[str] = Field(default_factory=list)


class TacticalAdviceItem(BaseModel):
    # 单条战术建议的结构。
    # 前端会把它渲染成卡片列表。
    title: str
    recommendation: str
    reasoning: str
    confidence: Literal["low", "medium", "high"]


class DirectionPrediction(BaseModel):
    # 对“当前局面属于哪个阶段、最该朝哪个方向处理”的抽象总结。
    # 它比单条 advice 更宏观，也更接近“教练式判断”。
    current_phase: str
    best_direction: str
    why_now: str
    avoid_direction: str
    confidence: Literal["low", "medium", "high"]


class ReviewSection(BaseModel):
    # 复盘模块。
    # 核心目标不是告诉用户“按哪个键”，
    # 而是帮助用户理解：局面、误区、修正动作和长期训练方向。
    current_situation: str
    likely_mistakes: list[str]
    recommended_actions: list[str]
    longer_term_improvement: list[str]


class AnalysisResponse(BaseModel):
    # 后端输出给前端的统一响应模型。
    # 无论是哪种游戏、哪种输入方式，最终都会落到这个结构里，
    # 这样前端就可以复用同一套展示组件。
    summary: str
    direction_prediction: DirectionPrediction
    tactical_advice: list[TacticalAdviceItem]
    beginner_explanation: str
    risks_or_uncertainties: list[str]
    next_steps: list[str]
    review_report: ReviewSection
    metadata: dict[str, str | float | int]


class UserProfile(BaseModel):
    user_id: str | None = None
    display_name: str | None = None
    skill_level: Literal["beginner", "intermediate", "advanced"] | None = None
    preferred_style: Literal["concise", "balanced", "detailed"] | None = None
    favorite_role: str | None = None
    favorite_character: str | None = None
    goals: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class UserProfileUpsertRequest(BaseModel):
    user_id: str
    display_name: str | None = None
    skill_level: Literal["beginner", "intermediate", "advanced"] | None = None
    preferred_style: Literal["concise", "balanced", "detailed"] | None = None
    favorite_role: str | None = None
    favorite_character: str | None = None
    goals: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class AnalysisHistoryItem(BaseModel):
    game: SupportedGame
    question: str
    session_id: str | None = None
    user_id: str | None = None
    source: Literal["json", "screenshot"]
    user_profile: UserProfile | None = None
    extracted_state: dict[str, Any]
    response: AnalysisResponse
    created_at: str


class StateAnalysisRequest(BaseModel):
    # 结构化状态分析接口的请求体。
    # game 和 question 决定分析上下文，
    # state 则是实际被推理的游戏状态。
    game: SupportedGame = "pokemon-battle-demo"
    question: str
    state: dict[str, Any]
    session_id: str | None = None
    user_profile: UserProfile | None = None
