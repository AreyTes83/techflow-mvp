type TelegramWebApp = {
  ready?: () => void
  expand?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  /** Raw query-string для перевірки HMAC на бекенді. */
  initData?: string
  initDataUnsafe?: unknown
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp }
  }
}

export function initTelegramWebApp() {
  const wa = window.Telegram?.WebApp
  wa?.ready?.()
  wa?.expand?.()
  return wa
}

