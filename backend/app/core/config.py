from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = (
        "postgresql+asyncpg://travelbuddy:travelbuddy@localhost:5432/travelbuddy"
    )
    ANTHROPIC_API_KEY: str = ""
    JWT_SECRET: str = "change-me"
    JWT_ALG: str = "HS256"
    JWT_EXP_HOURS: int = 72
    CORS_ORIGINS: str = "http://localhost:5173"
    USE_WHISPER: bool = True
    STT_MODEL: str = "small"
    SEED_RAG_ON_STARTUP: bool = True
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_BOT_USERNAME: str = "travel_buddy_ru_bot"
    NOMINATIM_USER_AGENT: str = "travel-buddy-ru/0.1 (dgornin@gmail.com)"

    # Disable TLS cert verification for outgoing Anthropic calls.
    # Needed in corporate MITM environments (e.g. Yandex internal proxy);
    # DO NOT enable in production.
    ANTHROPIC_DISABLE_TLS_VERIFY: bool = False

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
