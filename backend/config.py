from __future__ import annotations

from dataclasses import dataclass
import os


@dataclass(frozen=True)
class Settings:
    telegram_token: str
    tma_url: str
    supabase_url: str | None
    supabase_service_role_key: str | None


def load_settings() -> Settings:
    telegram_token = os.getenv("TELEGRAM_TOKEN", "").strip()
    if not telegram_token:
        raise RuntimeError("Missing TELEGRAM_TOKEN env var")

    tma_url = os.getenv("TMA_URL", "http://localhost:5173/").strip()
    if not tma_url:
        raise RuntimeError("Missing TMA_URL env var")

    supabase_url = os.getenv("SUPABASE_URL", "").strip() or None
    supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip() or None

    return Settings(
        telegram_token=telegram_token,
        tma_url=tma_url,
        supabase_url=supabase_url,
        supabase_service_role_key=supabase_service_role_key,
    )

