from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    database_url: str = "sqlite:///./data/youtubeplaylist.db"
    default_playlist_id: str = ""
    host: str = "0.0.0.0"
    port: int = 8080
    cors_origins: str = "http://localhost:8080,http://127.0.0.1:8080"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_test(self) -> bool:
        return self.app_env == "test"

    @property
    def frontend_dist(self) -> Path:
        return FRONTEND_DIST


@lru_cache
def get_settings() -> Settings:
    return Settings()
