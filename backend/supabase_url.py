from __future__ import annotations

import re
from urllib.parse import urlparse


def normalize_supabase_api_url(raw: str) -> str:
    """
    Supabase REST client must use the **API URL**, not the dashboard link.

    Accepts:
    - https://<ref>.supabase.co
    - https://supabase.com/dashboard/project/<ref>  (converted)

    Raises ValueError with a short hint if the value still looks wrong.
    """
    if not raw or not str(raw).strip():
        raise ValueError("SUPABASE_URL is empty")

    # Remove accidental spaces anywhere in the string (common copy/paste issue)
    s = re.sub(r"\s+", "", str(raw).strip())

    # Dashboard URL → API URL
    if "supabase.com/dashboard/project/" in s:
        m = re.search(r"/dashboard/project/([^/?#]+)", s)
        if not m:
            raise ValueError(
                "SUPABASE_URL looks like a dashboard link but project id was not parsed. "
                "Use Settings → API → Project URL."
            )
        ref = re.sub(r"\s+", "", m.group(1))
        s = f"https://{ref}.supabase.co"

    parsed = urlparse(s)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(
            "SUPABASE_URL must start with https:// (API URL). "
            "Dashboard links do not work for /rest/v1."
        )

    host = (parsed.hostname or "").lower()
    if not host.endswith(".supabase.co"):
        raise ValueError(
            f"SUPABASE_URL host must be *.supabase.co (got {host!r}). "
            "Copy 'Project URL' from Supabase: Settings → API."
        )

    # No trailing slash (we append /rest/v1/... ourselves)
    return f"{parsed.scheme}://{host}"
