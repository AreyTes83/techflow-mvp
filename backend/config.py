from __future__ import annotations

from dataclasses import dataclass
import os
from urllib.parse import urlparse


@dataclass(frozen=True)
class Settings:
    telegram_token: str
    tma_url: str
    supabase_url: str | None
    supabase_service_role_key: str | None
    supabase_jwt_secret: str | None
    # HTTP для обміну initData → JWT (паралельно з long-poll ботом).
    http_host: str
    http_port: int
    # Дозволені origins браузера для запитів із міні-апа.
    http_cors_origins: tuple[str, ...]
    tma_session_ttl_seconds: int


def _parse_cors(tma_url: str, raw: str) -> tuple[str, ...]:
    explicit = tuple(s.strip().rstrip("/") for s in raw.split(",") if s.strip())
    if explicit:
        return explicit
    extras: list[str] = []
    parsed = urlparse(tma_url.rstrip("/"))
    if parsed.scheme and parsed.netloc:
        extras.append(f"{parsed.scheme}://{parsed.netloc}")
    extras.append("http://localhost:5173")
    extras.append("http://127.0.0.1:5173")
    dedup = list(dict.fromkeys(extras))
    return tuple(dedup)


def load_settings() -> Settings:
    telegram_token = os.getenv("TELEGRAM_TOKEN", "").strip()
    if not telegram_token:
        raise RuntimeError("Missing TELEGRAM_TOKEN env var")

    tma_url = os.getenv("TMA_URL", "http://localhost:5173/").strip()
    if not tma_url:
        raise RuntimeError("Missing TMA_URL env var")

    supabase_url = os.getenv("SUPABASE_URL", "").strip() or None
    supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip() or None
    supabase_jwt_secret = os.getenv("SUPABASE_JWT_SECRET", "").strip() or None

    cors_raw = os.getenv("TMA_CORS_ORIGINS", "").strip()

    http_host = os.getenv("BOT_HTTP_HOST", "0.0.0.0").strip()
    http_port_raw = os.getenv("BOT_HTTP_PORT", "8787").strip()
    try:
        http_port = int(http_port_raw)
    except ValueError:
        http_port = 8787

    ttl_raw = os.getenv("TMA_SESSION_TTL_SECONDS", "3600").strip()
    try:
        tma_ttl = int(ttl_raw)
    except ValueError:
        tma_ttl = 3600

    return Settings(
        telegram_token=telegram_token,
        tma_url=tma_url,
        supabase_url=supabase_url,
        supabase_service_role_key=supabase_service_role_key,
        supabase_jwt_secret=supabase_jwt_secret,
        http_host=http_host,
        http_port=http_port,
        http_cors_origins=_parse_cors(tma_url, cors_raw),
        tma_session_ttl_seconds=tma_ttl,
    )

