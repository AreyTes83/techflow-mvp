"""
Застосовує supabase/apply_full.sql до проєкту Supabase через прямий Postgres (postgres user).

Потрібні змінні в backend/.env (або в оточенні):
  SUPABASE_SERVICE_ROLE_KEY  — сервісний JWT (для витягування project ref)
  SUPABASE_DB_PASSWORD       — пароль користувача postgres (Supabase → Settings → Database)

Опційно:
  SUPABASE_DB_HOST          — якщо не стандартний db.<ref>.supabase.co

Безпека: не друкуй паролі в логах.
"""

from __future__ import annotations

import base64
import json
import os
import sys
from pathlib import Path
from urllib.parse import quote_plus

import psycopg
import sqlparse
from dotenv import load_dotenv


REPO_ROOT = Path(__file__).resolve().parent.parent
BACKEND_ENV = REPO_ROOT / "backend" / ".env"
BACKEND_ENV_EXAMPLE = REPO_ROOT / "backend" / ".env.example"
SQL_FILE = REPO_ROOT / "supabase" / "apply_full.sql"


def load_env() -> None:
    load_dotenv(BACKEND_ENV)
    load_dotenv(BACKEND_ENV_EXAMPLE, override=False)


def jwt_payload_dict(token: str) -> dict:
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("JWT має 3 частини")
    body = parts[1] + "=" * (-len(parts[1]) % 4)
    return json.loads(base64.urlsafe_b64decode(body.encode("utf-8")))


def build_conninfo() -> str:
    service = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    password = os.getenv("SUPABASE_DB_PASSWORD", "").strip()
    if not service:
        raise SystemExit("Немає SUPABASE_SERVICE_ROLE_KEY у backend/.env")
    if not password:
        raise SystemExit(
            "Немає SUPABASE_DB_PASSWORD.\n"
            "Додай у backend/.env рядок:\n"
            "  SUPABASE_DB_PASSWORD=...   (пароль з Supabase → Settings → Database → Database password)\n"
            "Або один раз встав SQL вручну: відкрий supabase/apply_full.sql → SQL Editor → Run."
        )

    payload = jwt_payload_dict(service)
    ref = payload.get("ref")
    if not ref or not isinstance(ref, str):
        raise SystemExit("Не вдалося прочитати ref з SUPABASE_SERVICE_ROLE_KEY")

    host = os.getenv("SUPABASE_DB_HOST", "").strip() or f"db.{ref}.supabase.co"
    user = "postgres"
    dbname = "postgres"
    port = os.getenv("SUPABASE_DB_PORT", "5432").strip() or "5432"

    user_q = quote_plus(user)
    pw_q = quote_plus(password)
    return f"postgresql://{user_q}:{pw_q}@{host}:{port}/{dbname}"


def main() -> None:
    load_env()
    if not SQL_FILE.is_file():
        raise SystemExit(f"Не знайдено {SQL_FILE}")

    sql = SQL_FILE.read_text(encoding="utf-8")
    statements = [s.strip() for s in sqlparse.split(sql) if s.strip()]

    conninfo = build_conninfo()
    print(f"Підключення до Postgres: {conninfo.split('@')[-1]}")  # без пароля

    with psycopg.connect(conninfo, autocommit=True) as conn:
        with conn.cursor() as cur:
            for i, stmt in enumerate(statements, 1):
                cur.execute(stmt)
                if i % 10 == 0:
                    print(f"  … виконано {i}/{len(statements)} команд")

    print("Готово: схема + seed + repair застосовані.")


if __name__ == "__main__":
    try:
        main()
    except psycopg.Error as e:
        print("Помилка Postgres:", e, file=sys.stderr)
        raise SystemExit(1) from e
