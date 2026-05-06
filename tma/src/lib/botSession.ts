/**
 * Обмін Telegram.WebApp.initData на Supabase access JWT через бекенд бота (HMAC-перевірка на сервері).
 */
export function getTelegramInitData(): string | null {
  const wa = window.Telegram?.WebApp
  const raw = wa && typeof wa.initData === 'string' ? wa.initData.trim() : ''
  return raw.length >= 16 ? raw : null
}

export function getBotApiBaseUrl(): string | null {
  const raw = import.meta.env.VITE_BOT_API_URL
  if (typeof raw !== 'string' || !raw.trim()) return null
  return raw.trim().replace(/\/$/, '')
}

export async function exchangeInitDataForAccessToken(botApiBase: string, initData: string): Promise<string> {
  const res = await fetch(`${botApiBase}/tma/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ init_data: initData }),
  })

  const text = await res.text()
  if (!res.ok) {
    let detail = text.slice(0, 300)
    try {
      const j = JSON.parse(text) as { detail?: unknown }
      if (j?.detail !== undefined) {
        detail =
          typeof j.detail === 'string'
            ? j.detail
            : Array.isArray(j.detail)
              ? JSON.stringify(j.detail)
              : String(j.detail)
      }
    } catch {
      /* ignore */
    }
    throw new Error(detail || res.statusText)
  }

  let data: { access_token?: string }
  try {
    data = JSON.parse(text) as { access_token?: string }
  } catch {
    throw new Error('Invalid JSON from bot API')
  }
  if (!data.access_token || typeof data.access_token !== 'string') {
    throw new Error('Invalid response from bot API')
  }
  return data.access_token
}
