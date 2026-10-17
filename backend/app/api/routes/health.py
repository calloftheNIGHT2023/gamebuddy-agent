"""健康检查路由，用于快速确认服务可用。"""

from fastapi import APIRouter

from app.core.config import settings
from app.security import private_access_status

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok", "mode": "public" if settings.is_production else "local",
        "private_access": private_access_status(), "storage": settings.effective_storage_durability,
    }
