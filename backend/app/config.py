"""Application settings loaded from environment variables / .env file."""

import json
from functools import lru_cache
from typing import Annotated, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. No secrets are hardcoded; supply them via env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Pallankuzhi"
    DATABASE_URL: str
    SECRET_KEY: str = Field(min_length=32)
    ALGORITHM: Literal["HS256"] = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    # Optional explicit Google redirect URI (use behind proxies); falls back to
    # the URL derived from the incoming request when empty.
    OAUTH_REDIRECT_URI: str = ""
    # Serve /docs, /redoc and /openapi.json.
    ENABLE_DOCS: bool = True
    # Comma-separated string or JSON list in env.
    CORS_ORIGINS: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    @field_validator("SECRET_KEY")
    @classmethod
    def _reject_placeholder_secret(cls, value: str) -> str:
        lowered = value.lower()
        if any(m in lowered for m in ("change-me", "changeme", "your-secret")):
            raise ValueError("SECRET_KEY must not be a placeholder value")
        return value

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        text = value.strip()
        if text.startswith("["):
            return json.loads(text)
        return [o.strip() for o in text.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return cached settings (constructed lazily so importing needs no env)."""
    return Settings()  # type: ignore[call-arg]
