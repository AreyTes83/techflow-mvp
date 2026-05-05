# TECHFLOW MVP #1 (TMA)

MVP: core тікети в Telegram (TMA) + бот.

## Структура
- `docs/techflow_unified_plan.md` — **повний TECHFLOW AI план** (оригінал із `Імплемент плани`; гейміфікація, фази, AI — див. там)
- `supabase/migrations/` — SQL схема
- `supabase/seed/` — seed-дані для локального MVP (email/password)
- `backend/` — Telegram bot (aiogram)
- `tma/` — Telegram Mini App (Vite + React)

## Supabase (швидкий старт)
1) В Supabase → SQL Editor: запусти `supabase/migrations/001_init.sql`  
2) Потім запусти `supabase/migrations/002_ticket_claim_policy.sql` та `supabase/migrations/003_ticket_select_unassigned.sql`  
3) Потім запусти `supabase/seed/001_seed.sql`  
   Якщо логін у TMA дає *Invalid login credentials* — запусти **`supabase/seed/002_repair_seed_login.sql`** після seed.

Після seed будуть тестові логіни (для входу в TMA під час MVP):
- `manager@techflow.local` / `manager123`
- `tech@techflow.local` / `tech12345`
- `store@techflow.local` / `store12345`

## Локальний запуск
Дивись `LOCAL_RUN.md`.

## Деплой TMA для Telegram (HTTPS)
Дивись **`docs/DEPLOY_TMA_TELEGRAM.md`** (варіант A: Vercel + `TMA_URL` + перевірка з телефона).

## Одне SQL для Supabase
Файл `supabase/apply_full.sql` — усі міграції + seed + ремонт логінів. Його або вставляєш у **SQL Editor**, або виконує `python scripts/apply_mvp_database.py` після того, як у `backend/.env` є `SUPABASE_DB_PASSWORD` (див. `LOCAL_RUN.md`).

