from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from urllib.parse import urlencode

from dotenv import load_dotenv

from config import load_settings
from notifier import NotifierState, notifier_loop
from supabase_admin import SupabaseAdmin
from supabase_url import normalize_supabase_api_url
from telegram_api import TelegramClient


logger = logging.getLogger("techflow.bot")


def load_backend_env() -> None:
    """Load `.env`; then fill missing keys from `.env.example` (dev convenience).

    Prefer real `.env` for secrets; `.env.example` is only a fallback.
    Paths are anchored to this file so launching from another cwd still works.
    """
    backend_dir = Path(__file__).resolve().parent
    load_dotenv(backend_dir / ".env")
    load_dotenv(backend_dir / ".env.example", override=False)


def build_tma_link(base_url: str, role: str | None = None) -> str:
    # For local MVP we keep it simple: role is only a hint for the frontend.
    # Auth in MVP happens via Supabase email/password login screen.
    if not role:
        return base_url

    sep = "&" if "?" in base_url else "?"
    return f"{base_url}{sep}{urlencode({'role': role})}"


def webapp_button(url: str) -> dict:
    return {
        "inline_keyboard": [
            [{"text": "Відкрити TECHFLOW (TMA)", "web_app": {"url": url}}],
        ]
    }


async def handle_command(tg: TelegramClient, chat_id: int, user_id: int, text: str, tma_url: str) -> None:
    cmd = text.strip().split()[0].lower()

    if cmd in ("/start",):
        await tg.send_message(
            chat_id,
            "TECHFLOW MVP #1\n\n"
            "Це демо-версія: відкрий TMA і увійди тестовим логіном (email/password).",
            reply_markup=webapp_button(build_tma_link(tma_url)),
        )
        return

    if cmd in ("/whoami",):
        await tg.send_message(chat_id, f"Ваш Telegram ID: {user_id}\nЧат: {chat_id}")
        return

    if cmd in ("/open",):
        parts = text.strip().split()
        role = parts[1] if len(parts) > 1 else None
        await tg.send_message(chat_id, "Відкриваю TMA.", reply_markup=webapp_button(build_tma_link(tma_url, role=role)))
        return

    await tg.send_message(chat_id, "Команди: /start, /whoami, /open [technician|store_staff|manager]")


async def main() -> None:
    load_backend_env()
    settings = load_settings()

    logging.basicConfig(level=logging.INFO)
    tg = TelegramClient(settings.telegram_token)

    notifier_task: asyncio.Task | None = None
    if settings.supabase_url and settings.supabase_service_role_key:
        try:
            api_url = normalize_supabase_api_url(settings.supabase_url)
        except ValueError as e:
            logger.error(
                "Notifier disabled: invalid SUPABASE_URL (%s). "
                "Fix: Supabase → Settings → API → Project URL (https://<ref>.supabase.co), not dashboard.",
                e,
            )
        else:
            sb = SupabaseAdmin(url=api_url, service_role_key=settings.supabase_service_role_key)
            notifier_task = asyncio.create_task(notifier_loop(tg, sb, NotifierState()))
            logger.info("Notifier enabled (API URL: %s)", api_url)
    else:
        logger.info("Notifier disabled (missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).")

    offset: int | None = None
    logger.info("Bot started (long polling).")
    try:
        while True:
            updates = await tg.get_updates(offset=offset)
            for u in updates:
                offset = u.update_id + 1
                if not u.message:
                    continue

                text = u.message.get("text")
                if not isinstance(text, str):
                    continue

                chat = u.message.get("chat") or {}
                from_user = u.message.get("from") or {}
                chat_id = int(chat.get("id"))
                user_id = int(from_user.get("id"))

                await handle_command(tg, chat_id=chat_id, user_id=user_id, text=text, tma_url=settings.tma_url)

            await asyncio.sleep(0.2)
    finally:
        if notifier_task:
            notifier_task.cancel()
        await tg.close()


if __name__ == "__main__":
    asyncio.run(main())

