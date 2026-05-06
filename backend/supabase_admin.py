from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


@dataclass(frozen=True)
class SupabaseAdmin:
    url: str
    service_role_key: str

    def _headers(self) -> dict[str, str]:
        # Service role bypasses RLS. Keep it ONLY on backend.
        return {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
        }

    async def list_new_tickets(self, since_iso: str | None = None) -> list[dict[str, Any]]:
        params = {
            "select": "id,status,created_at,description,created_by,store_id",
            "status": "eq.new",
            "order": "created_at.asc",
            "limit": "50",
        }
        if since_iso:
            params["created_at"] = f"gt.{since_iso}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(f"{self.url}/rest/v1/tickets", headers=self._headers(), params=params)
            r.raise_for_status()
            return r.json()

    async def list_pending_confirmation(self, since_iso: str | None = None) -> list[dict[str, Any]]:
        params = {
            "select": "id,status,updated_at,description,created_by,store_id",
            "status": "eq.pending_confirmation",
            "order": "updated_at.asc",
            "limit": "50",
        }
        if since_iso:
            params["updated_at"] = f"gt.{since_iso}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(f"{self.url}/rest/v1/tickets", headers=self._headers(), params=params)
            r.raise_for_status()
            return r.json()

    async def get_user_telegram_id(self, user_id: str) -> int | None:
        params = {"select": "telegram_id", "id": f"eq.{user_id}", "limit": "1"}
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(f"{self.url}/rest/v1/users", headers=self._headers(), params=params)
            r.raise_for_status()
            data = r.json()
            if not data:
                return None
            tg_id = data[0].get("telegram_id")
            return int(tg_id) if tg_id is not None else None

    async def list_technician_telegram_ids(self) -> list[int]:
        # user_roles матим два FK до users → без підказки PostgREST дає «300 Multiple Choices».
        params = {
            "select": "users!user_roles_user_id_fkey(telegram_id),roles!user_roles_role_id_fkey(name)",
            "limit": "200",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            r = await client.get(f"{self.url}/rest/v1/user_roles", headers=self._headers(), params=params)
            r.raise_for_status()
            rows = r.json()

        res: list[int] = []
        for row in rows:
            role_name = (row.get("roles") or {}).get("name")
            if role_name != "technician":
                continue
            tg_id = (row.get("users") or {}).get("telegram_id")
            if tg_id is None:
                continue
            res.append(int(tg_id))
        return res

