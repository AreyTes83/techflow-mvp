from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from supabase_admin import SupabaseAdmin
from telegram_api import TelegramClient


logger = logging.getLogger("techflow.notifier")

# У seed у public.users стоять вигадані telegram_id (для демо). Telegram API не доставляє на них — 400.
SEED_PLACEHOLDER_TELEGRAM_IDS = frozenset({900000001, 900000002, 900000003, 900000004})


def _real_notify_telegram_ids(ids: list[int]) -> list[int]:
    return [i for i in ids if i not in SEED_PLACEHOLDER_TELEGRAM_IDS]


async def _send_or_warn(tg: TelegramClient, chat_id: int, text: str) -> None:
    try:
        await tg.send_message(chat_id, text)
    except httpx.HTTPStatusError as e:
        detail = ""
        if e.response is not None:
            try:
                j = e.response.json()
                detail = str(j.get("description") or j)
            except Exception:
                detail = (e.response.text or "")[:300]
        logger.warning("Telegram sendMessage не вдався (chat_id=%s): %s", chat_id, detail or e)
    except RuntimeError as e:
        # telegram_api.send_message: HTTP 200, але поле ok=false у JSON.
        logger.warning("Telegram sendMessage не вдався (chat_id=%s): %s", chat_id, e)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class NotifierState:
    last_new_created_at: str | None = None
    last_pending_updated_at: str | None = None


async def notifier_loop(
    tg: TelegramClient,
    sb: SupabaseAdmin,
    state: NotifierState,
    poll_seconds: float = 15.0,
) -> None:
    """
    Minimal polling notifier for MVP.
    - New ticket -> notify all technicians
    - pending_confirmation -> notify ticket creator (store staff)
    """

    while True:
        try:
            # New tickets
            new_tickets = await sb.list_new_tickets(since_iso=state.last_new_created_at)
            if new_tickets:
                tech_tg_ids = _real_notify_telegram_ids(await sb.list_technician_telegram_ids())
                for t in new_tickets:
                    text = (
                        "Нова заявка (SOS)\n"
                        f"ID: {t['id'][:8]}\n"
                        f"Опис: {t.get('description','')}"
                    )
                    for tid in tech_tg_ids:
                        await _send_or_warn(tg, tid, text)
                state.last_new_created_at = new_tickets[-1]["created_at"]

            # Tickets pending confirmation
            pending = await sb.list_pending_confirmation(since_iso=state.last_pending_updated_at)
            if pending:
                for t in pending:
                    creator = t.get("created_by")
                    if not creator:
                        continue
                    creator_tg = await sb.get_user_telegram_id(creator)
                    if not creator_tg:
                        continue
                    if creator_tg in SEED_PLACEHOLDER_TELEGRAM_IDS:
                        continue
                    text = (
                        "Заявка очікує підтвердження\n"
                        f"ID: {t['id'][:8]}\n"
                        "Відкрий TMA → підтверди виконання."
                    )
                    await _send_or_warn(tg, creator_tg, text)
                state.last_pending_updated_at = pending[-1]["updated_at"]

        except httpx.HTTPStatusError as e:
            # Common misconfig: dashboard URL instead of API URL → 404 on /rest/v1
            if e.response is not None and e.response.status_code == 404:
                logger.error(
                    "Notifier: 404 from Supabase REST. Check SUPABASE_URL is the API URL "
                    "(https://<ref>.supabase.co), not the dashboard. Response: %s",
                    e.response.text[:200],
                )
            else:
                logger.exception("Notifier loop error (HTTP)")
        except Exception:
            logger.exception("Notifier loop error")

        await asyncio.sleep(poll_seconds)

