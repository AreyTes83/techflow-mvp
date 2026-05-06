from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import httpx


@dataclass(frozen=True)
class TgUpdate:
    update_id: int
    message: dict[str, Any] | None


class TelegramClient:
    def __init__(self, token: str) -> None:
        self._base = f"https://api.telegram.org/bot{token}/"
        self._http = httpx.AsyncClient(timeout=30.0)

    async def close(self) -> None:
        await self._http.aclose()

    async def delete_webhook(self, drop_pending_updates: bool = False) -> None:
        """Якщо на боті колись увімкнули webhook — getUpdates не працює; вимкнути webhook."""
        payload: dict[str, Any] = {"drop_pending_updates": drop_pending_updates}
        r = await self._http.post(self._base + "deleteWebhook", json=payload)
        r.raise_for_status()
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(f"Telegram deleteWebhook failed: {data}")

    async def get_updates(self, offset: int | None = None) -> list[TgUpdate]:
        payload: dict[str, Any] = {"timeout": 25}
        if offset is not None:
            payload["offset"] = offset

        r = await self._http.post(self._base + "getUpdates", json=payload)
        r.raise_for_status()
        data = r.json()
        if not data.get("ok"):
            err = data.get("description") or str(data)
            code = data.get("error_code")
            hint = ""
            if code == 409 or "webhook" in err.lower():
                hint = (
                    " (Конфлікт з webhook: процес на старті викликає deleteWebhook; або вручну в браузері відкрий "
                    "https://api.telegram.org/bot<TOKEN>/deleteWebhook)"
                )
            raise RuntimeError(f"Telegram getUpdates failed: {err}{hint}")
        res = []
        for u in data.get("result", []):
            res.append(TgUpdate(update_id=u["update_id"], message=u.get("message")))
        return res

    async def send_message(self, chat_id: int, text: str, reply_markup: dict[str, Any] | None = None) -> None:
        payload: dict[str, Any] = {"chat_id": chat_id, "text": text}
        if reply_markup is not None:
            payload["reply_markup"] = reply_markup
        r = await self._http.post(self._base + "sendMessage", json=payload)
        r.raise_for_status()
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(f"Telegram sendMessage failed: {data}")

