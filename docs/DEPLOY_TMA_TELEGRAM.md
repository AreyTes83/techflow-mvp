# Деплой TMA (HTTPS) для Telegram Web App — варіант A

Telegram відкриває Mini App **лише за HTTPS**. Локальний `http://localhost:5173` на телефоні зазвичай не підходить.

## Що підготувати

1. Обліковий запис на хостингу з безкоштовним HTTPS (нижче — **Vercel**; можна аналогічно **Netlify**, **Cloudflare Pages**).
2. У Supabase: **Project URL** і **anon key** (Settings → API) — їх треба задати як змінні середовища на хостингу (не класти в репозиторій).

## 1. Змінні середовища для продакшен-збірки TMA

У панелі хостингу додай (назви для Vite):

| Змінна | Значення |
|--------|----------|
| `VITE_SUPABASE_URL` | `https://<ref>.supabase.co` (без `/rest/v1/`) |
| `VITE_SUPABASE_ANON_KEY` | anon public key з Supabase |

Після кожної зміни змінних — **перезібрати** проєкт (redeploy).

## 2. Деплой на Vercel (рекомендовано для старту)

1. Зайди на [vercel.com](https://vercel.com), увійди через GitHub/GitLab і **імпортуй репозиторій**, або використай CLI.
2. **Root Directory** вибери: `tma` (не корінь монорепо).
3. **Build Command:** `npm run build`  
4. **Output Directory:** `dist`  
5. **Install Command:** `npm install`  
6. Додай змінні `VITE_SUPABASE_*` (див. таблицю вище).
7. Deploy. Скопіюй URL виду `https://techflow-xxx.vercel.app`.

У репозиторії вже є `tma/vercel.json` з rewrite на `index.html` (на майбутнє для клієнтських маршрутів).

### CLI (якщо без Git-інтеграції)

```powershell
cd D:\Tesliuk\Cursor\techflow-mvp\tma
npm install
npx vercel
```

Далі слідуй підказкам; змінні задай у Vercel → Project → Settings → Environment Variables.

## 3. Швидкий тест без «вічного» хостингу (тунель)

Якщо потрібно лише перевірити з телефона:

- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) або [ngrok](https://ngrok.com/) на `http://127.0.0.1:5173` після `npm run dev`.

Отримаєш тимчасовий `https://....` — його можна тимчасово поставити в `TMA_URL`. Для демо ок, для продакшену краще Vercel/Pages.

## 4. Бот: `TMA_URL`

У файлі **`backend/.env`** (на сервері або локально, де крутиться бот):

```env
TMA_URL=https://techflow-xxx.vercel.app/
```

- Завжди **HTTPS**
- Бажано **слеш в кінці** або без — головне, щоб збігалось з тим, що відкривається в браузері
- Перезапусти бота після зміни

Код бота читає цю змінну при формуванні кнопки Web App.

## 5. BotFather / домен

1. Відкрий [@BotFather](https://t.me/BotFather) → **/mybots** → свій бот.
2. Якщо є пункт на кшталт **Domain / Web App / Mini App** — додай **домен без шляху** (наприклад `techflow-xxx.vercel.app`), якщо Telegram це вимагає.
3. Якщо кнопка Web App задається **тільки з коду** бота — достатньо правильного `TMA_URL` і перезапуску.

Якщо при відкритті міні-апа з’являється помилка домену — перевір документацію BotFather для твоєї версії клієнта Telegram і додай домен у налаштуваннях бота.

## 6. Перевірка з телефона

1. Відкрий бота в Telegram на телефоні → **/start** → **Відкрити TECHFLOW (TMA)** (або аналогічна кнопка).
2. Має відкритись твій HTTPS URL, логін seed-користувачем, сценарій: магазин → технік → підтвердження → оцінка.

## 7. Часті проблеми

| Симптом | Що зробити |
|---------|------------|
| Біла сторінка / немає даних | Перевір `VITE_*` на хостингу і **redeploy** |
| `Invalid path` / Supabase | У `VITE_SUPABASE_URL` не має бути суфікса `/rest/v1/` |
| Бот відкриває localhost | Онови `TMA_URL` у **тому** `.env`, з якого реально стартує `python main.py` |
| CORS | У Supabase зазвичай ок для hosted URL; при кастомних доменах див. Supabase → API settings |

Повний продуктовий план: `docs/techflow_unified_plan.md`.
