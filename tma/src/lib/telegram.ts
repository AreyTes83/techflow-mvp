type TelegramWebApp = {
  ready?: () => void
  expand?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
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

