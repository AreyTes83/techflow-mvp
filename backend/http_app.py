from __future__ import annotations

from typing import Annotated

import httpx
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config import Settings
from supabase_jwt import mint_access_token
from supabase_url import normalize_supabase_api_url
from telegram_init_data import telegram_user_json_to_id, validate_telegram_miniapp_init_data


class TmaSessionRequest(BaseModel):
    init_data: str = Field(..., min_length=16)


async def lookup_auth_user_by_telegram_id(
    *,
    api_base: str,
    service_role_key: str,
    telegram_user_id: int,
) -> tuple[str | None, str | None]:
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }
    params = {"select": "id", "telegram_id": f"eq.{telegram_user_id}", "limit": "1"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{api_base}/rest/v1/users", headers=headers, params=params)
        r.raise_for_status()
        rows = r.json()

    if not rows:
        return None, None

    auth_user_id = rows[0].get("id")
    if not auth_user_id:
        return None, None

    uid = str(auth_user_id)
    async with httpx.AsyncClient(timeout=30.0) as client:
        ur = await client.get(f"{api_base}/auth/v1/admin/users/{uid}", headers=headers)
        ur.raise_for_status()
        ujson = ur.json()

    email = ujson.get("email")
    return uid, str(email) if email else None


def create_http_app(settings: Settings) -> FastAPI:
    app = FastAPI(title="TECHFLOW bot API", version="0.1")

    async def get_settings() -> Settings:
        return settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.http_cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[],
    )

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/tma/session")
    async def tma_session(body: TmaSessionRequest, cfg: Annotated[Settings, Depends(get_settings)]) -> dict:
        if not cfg.supabase_url or not cfg.supabase_service_role_key:
            raise HTTPException(status_code=503, detail="Supabase admin not configured")

        if not cfg.supabase_jwt_secret:
            raise HTTPException(status_code=503, detail="SUPABASE_JWT_SECRET not configured")

        try:
            fields = validate_telegram_miniapp_init_data(body.init_data, cfg.telegram_token)
            tg_user_id = telegram_user_json_to_id(fields.get("user"))
        except ValueError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

        api_base = normalize_supabase_api_url(cfg.supabase_url)

        auth_user_id, email = await lookup_auth_user_by_telegram_id(
            api_base=api_base,
            service_role_key=cfg.supabase_service_role_key,
            telegram_user_id=tg_user_id,
        )

        if auth_user_id is None:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Telegram-користувача не знайдено в TECHFLOW. "
                    "Адмін має виставити ваш telegram_id у таблиці public.users."
                ),
            )

        issuer = f"{api_base}/auth/v1"
        ttl = min(max(cfg.tma_session_ttl_seconds, 300), 86400)
        access_token = mint_access_token(
            supabase_issuer=issuer,
            user_id=str(auth_user_id),
            email=email,
            jwt_secret=cfg.supabase_jwt_secret,
            ttl_seconds=ttl,
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "expires_in": ttl,
        }

    return app
