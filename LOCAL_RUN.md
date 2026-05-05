# LOCAL RUN (MVP #1)

## 0) Supabase
### Варіант А — один скрипт (рекомендовано на Windows)

1. Додай у `backend/.env` пароль бази (**Supabase → Project Settings → Database → Database password**):  
   `SUPABASE_DB_PASSWORD=...`

2. Встанови залежності та запуск:
```powershell
cd d:\Tesliuk\Cursor\techflow-mvp
python -m pip install -r scripts\requirements-apply.txt
python scripts\apply_mvp_database.py
```

Це виконує готовий файл `supabase/apply_full.sql` (міграції 001–003 + seed + ремонт Auth).

### Варіант B — як не хочеш давати пароль БД у .env

Один файл **`supabase/apply_full.sql`** уже містить усе (міграції, seed і `002_repair_seed_login`): відкрий його, скопіюй, встав у **SQL Editor → Run**.

<details>
<summary>Старий покроковий спосіб (якщо потрібен по частинах)</summary>

- `supabase/migrations/001_init.sql`
- `supabase/migrations/002_ticket_claim_policy.sql`
- `supabase/migrations/003_ticket_select_unassigned.sql`
- `supabase/seed/001_seed.sql`
- `supabase/seed/002_repair_seed_login.sql`

Пароль тестового магазину з seed: **`store12345`**.

</details>

## 1) TMA (Vite+React)
1. Створи файл `tma/.env.local`:

```env
# Same Project URL as in Supabase Settings → API (https://<ref>.supabase.co), not dashboard.
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

2. Запуск:

```powershell
cd d:\Tesliuk\Cursor\techflow-mvp\tma
npm install
npm run dev
```

TMA буде на `http://localhost:5173/`.

## 2) Telegram Bot (long polling)
1. Налаштування змінних можна покласти в **`backend/.env`** (краще для секретів) або в **`backend/.env.example`**: бот завантажує `.env`, а відсутні ключі доповнює з `.env.example`.

   Або створи лише **`backend/.env`** на основі `backend/.env.example`:

```env
TELEGRAM_TOKEN=...
TMA_URL=http://localhost:5173/
# SUPABASE_URL must be the REST API host: https://<ref>.supabase.co (Settings → API → Project URL).
# Links like https://supabase.com/dashboard/project/... will give 404 on /rest/v1.
SUPABASE_URL=...                     # optional, for notifier
SUPABASE_SERVICE_ROLE_KEY=...        # optional, for notifier
```

2. Запуск:

```powershell
cd d:\Tesliuk\Cursor\techflow-mvp\backend
python -m pip install -r requirements.txt
python main.py
```

## 3) E2E чек-лист (що має працювати)
1. Відкрий бот → `/start` → кнопка **“Відкрити TECHFLOW (TMA)”**
2. В TMA залогінься одним із seed-логінів:
   - `store@techflow.local` / `store12345`
   - `tech@techflow.local` / `tech12345`
   - `manager@techflow.local` / `manager123`
3. **StoreStaff**: створи заявку (SOS)
4. **Technician**: побач “new без tech_id” → натисни **“Взяти в роботу”**
5. **Technician**: натисни **“Виконано → на підтвердження”**
6. **StoreStaff**: підтверди виконання → постав оцінку
7. **Manager**: бачить всі тікети в списку
8. **(Опційно) Bot notifier**:
   - новий тікет → повідомлення техніку
   - `pending_confirmation` → повідомлення працівнику магазину

