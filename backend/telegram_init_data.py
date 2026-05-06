from __future__ import annotations

import hashlib
import hmac
import json
import time
from urllib.parse import unquote


def _parse_init_data(init_data: str) -> dict[str, str]:
    """
    Парсинг query-string з Telegram.WebApp.initData без втрати кодування всередині JSON user=...
    """
    pairs: dict[str, str] = {}
    for raw_part in init_data.strip().split("&"):
        if not raw_part or "=" not in raw_part:
            continue
        key, _, enc_val = raw_part.partition("=")
        if not key:
            continue
        pairs[key] = unquote(enc_val, errors="strict")
    return pairs


def validate_telegram_miniapp_init_data(
    init_data: str,
    bot_token: str,
    *,
    max_age_seconds: int = 86400,
) -> dict[str, str]:
    """
    Перевірка підпису за https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    if not init_data or not bot_token:
        raise ValueError("init_data and bot_token are required")

    data = _parse_init_data(init_data)
    hash_hex = data.pop("hash", None)
    if not hash_hex:
        raise ValueError("missing hash")

    # Для third-party режиму використовується поле signature — у класичній Mini App залишаємо лише HMAC.
    data.pop("signature", None)

    pairs_sorted = "\n".join(f"{k}={v}" for k, v in sorted(data.items()))

    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()

    digest = hmac.new(secret_key, pairs_sorted.encode("utf-8"), hashlib.sha256).hexdigest()

    if digest.lower() != hash_hex.lower():
        raise ValueError("invalid initData signature")

    auth_raw = data.get("auth_date")
    if auth_raw is None:
        raise ValueError("missing auth_date")
    try:
        auth_ts = int(auth_raw)
    except ValueError as exc:
        raise ValueError("bad auth_date") from exc
    if auth_ts <= 0:
        raise ValueError("bad auth_date")

    if time.time() - auth_ts > max_age_seconds:
        raise ValueError("initData expired")

    return data


def telegram_user_json_to_id(user_json: str | None) -> int:
    if not user_json:
        raise ValueError("missing user field in initData")
    try:
        obj = json.loads(user_json)
    except json.JSONDecodeError as exc:
        raise ValueError("bad user json") from exc
    tid = obj.get("id")
    if tid is None:
        raise ValueError("missing telegram user id")
    return int(tid)
