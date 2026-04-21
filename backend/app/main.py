from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analysis, health, memory
from app.core.config import settings

# FastAPI 应用的总入口。
# 这里负责：
# 1. 创建 Web 服务实例
# 2. 挂载中间件，例如 CORS
# 3. 注册路由模块
# 4. 暴露一个最基础的根路径，便于快速检查服务是否启动
app = FastAPI(
    title="GameBuddy Agent API",
    description="Backend API for the GameBuddy browser analysis lab and playable sandbox demos.",
    version="0.1.0",
)

# 配置跨域访问。
# 因为前端和后端在本地开发时通常运行在不同端口上，
# 浏览器会把它们视为不同源；如果这里不放开允许的来源，
# 前端页面虽然能打开，但向后端发请求时会被浏览器直接拦截。
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册健康检查与分析接口。
# 最终会形成：
# - /health
# - /api/v1/analyze/state
# - /api/v1/analyze/screenshot
app.include_router(health.router)
app.include_router(analysis.router, prefix="/api/v1")
app.include_router(memory.router, prefix="/api/v1")


@app.get("/")
def root() -> dict[str, str]:
    # 根路径只返回一个极简状态对象，
    # 主要用于手工访问或部署平台探活时快速确认服务在线。
    return {"name": "GameBuddy Agent API", "status": "ok"}
