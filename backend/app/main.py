from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import analysis, health
from app.core.config import settings

app = FastAPI(
    title="GameBuddy Agent API",
    description="AI coaching backend for turn-based battle analysis.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(analysis.router, prefix="/api/v1")


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "GameBuddy Agent API", "status": "ok"}
