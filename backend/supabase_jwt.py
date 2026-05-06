from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import jwt


def mint_access_token(
    *,
    supabase_issuer: str,
    user_id: str,
    email: str | None,
    jwt_secret: str,
    ttl_seconds: int = 3600,
) -> str:
    """HS256 access_token у форматі, який приймає PostgREST / Supabase Auth для RLS."""
    now = datetime.now(timezone.utc)
    exp = now + timedelta(seconds=ttl_seconds)
    session_id = str(uuid.uuid4())

    payload = {
        "aud": "authenticated",
        "role": "authenticated",
        "iss": supabase_issuer,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
        "sub": user_id,
        "email": email or "",
        "phone": "",
        "app_metadata": {},
        "user_metadata": {},
        "aal": "aal1",
        "amr": [{"method": "telegram", "timestamp": int(now.timestamp())}],
        "session_id": session_id,
        "is_anonymous": False,
    }

    return jwt.encode(payload, jwt_secret, algorithm="HS256")
