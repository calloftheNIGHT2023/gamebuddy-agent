"""集中管理后端配置，统一处理环境变量和默认值。"""

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="", extra="ignore", env_file=".env", env_file_encoding="utf-8")

    app_env: str = Field(default="development", alias="GAMEBUDDY_ENV")
    backend_cors_origins: str = Field(
        default="http://localhost:3000,http://127.0.0.1:3000,http://localhost:3001,http://127.0.0.1:3001,http://localhost:3002,http://127.0.0.1:3002",
        alias="BACKEND_CORS_ORIGINS",
    )
    openrouter_api_key: str | None = Field(default=None, alias="OPENROUTER_API_KEY")
    openrouter_model: str = Field(default="openrouter/free", alias="OPENROUTER_MODEL")
    openrouter_base_url: str = Field(default="https://openrouter.ai/api/v1", alias="OPENROUTER_BASE_URL")
    openrouter_site_url: str = Field(default="http://localhost:3002", alias="OPENROUTER_SITE_URL")
    openrouter_app_name: str = Field(default="GameBuddy Agent", alias="OPENROUTER_APP_NAME")
    mongodb_uri: str | None = Field(default=None, alias="MONGODB_URI")
    mongodb_database: str = Field(default="gamebuddy", alias="MONGODB_DATABASE")
    mongodb_user_profiles_collection: str = Field(default="user_profiles", alias="MONGODB_USER_PROFILES_COLLECTION")
    mongodb_analysis_history_collection: str = Field(default="analysis_history", alias="MONGODB_ANALYSIS_HISTORY_COLLECTION")
    mongodb_feedback_collection: str = Field(default="feedback", alias="MONGODB_FEEDBACK_COLLECTION")

    @property
    def cors_origins(self) -> list[str]:
        return [item.strip() for item in self.backend_cors_origins.split(",") if item.strip()]

    @property
    def has_openrouter(self) -> bool:
        return bool(self.openrouter_api_key)

    @property
    def has_mongodb(self) -> bool:
        return bool(self.mongodb_uri)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
