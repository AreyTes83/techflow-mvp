import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import type { RoleName } from './lib/types'
import { initTelegramWebApp } from './lib/telegram'
import { fetchMyRole } from './lib/profile'
import { Login } from './components/Login'
import { StoreStaffDashboard } from './pages/StoreStaffDashboard'
import { TechnicianBoard } from './pages/TechnicianBoard'
import { ManagerView } from './pages/ManagerView'

/** Очікування getSession перед розблокуванням UI (WebView Telegram часто «вісне» після Reload; React Strict Mode дає зайвий mount). */
const SESSION_BOOT_MS = 12_000

function getRoleHint(): string | null {
  try {
    const u = new URL(window.location.href)
    return u.searchParams.get('role')
  } catch {
    return null
  }
}

export default function App() {
  if (!supabaseConfigured) {
    return (
      <div className="container">
        <div className="card">
          <h2 style={{ marginTop: 0 }}>TECHFLOW</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Немає налаштувань Supabase.
          </p>
          <p className="muted">
            Додай <code>VITE_SUPABASE_URL</code> та <code>VITE_SUPABASE_ANON_KEY</code> в <code>tma/.env.local</code>.
          </p>
        </div>
      </div>
    )
  }

  const [sessionReady, setSessionReady] = useState(false)
  const [role, setRole] = useState<RoleName | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** Повідомлення про збій старту сесії; не скидається при INITIAL_SESSION з null (на відміну від `error`). */
  const [authGateError, setAuthGateError] = useState<string | null>(null)
  const bootGenRef = useRef(0)
  const roleHint = useMemo(() => getRoleHint(), [])

  useEffect(() => {
    initTelegramWebApp()
  }, [])

  useEffect(() => {
    const myBoot = ++bootGenRef.current
    let alive = true

    ;(async () => {
      let session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null
      let timedOut = false

      try {
        const raced = await Promise.race([
          supabase.auth.getSession().then((res) => ({ kind: 'session' as const, res })),
          new Promise<{ kind: 'timeout' }>((resolve) =>
            setTimeout(() => resolve({ kind: 'timeout' }), SESSION_BOOT_MS),
          ),
        ])
        if (raced.kind === 'timeout') {
          timedOut = true
          session = null
        } else {
          session = raced.res.data.session ?? null
        }
      } catch {
        session = null
      }

      // React Strict Mode: не оновлюємо стан з «старого» циклу mount.
      if (bootGenRef.current !== myBoot) return

      setSessionReady(true)
      if (timedOut) {
        setAuthGateError(
          'Не вдалось швидко отримати сесію (часто після «Перезавантажити» в Telegram). Закрий міні-ап і відкрий знову з бота, або увійди логіном/паролем.',
        )
      }

      if (session) {
        try {
          const r = await fetchMyRole()
          if (!alive || bootGenRef.current !== myBoot) return
          setRole(r)
        } catch (e) {
          if (!alive || bootGenRef.current !== myBoot) return
          setError(e instanceof Error ? e.message : 'Error')
        }
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!alive) return
      if (!session) {
        setRole(null)
        setError(null)
        return
      }
      setAuthGateError(null)
      setError(null)
      try {
        const r = await fetchMyRole()
        if (!alive || bootGenRef.current !== myBoot) return
        setRole(r)
      } catch (e) {
        if (!alive || bootGenRef.current !== myBoot) return
        setError(e instanceof Error ? e.message : 'Error')
      }
    })

    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (!sessionReady) {
    return (
      <div className="container">
        <div className="card">Завантаження…</div>
      </div>
    )
  }

  if (!role) {
    return (
      <div>
        {authGateError || error ? (
          <div className="container">
            <div className="card" style={{ borderColor: '#fecaca', color: '#b91c1c' }}>
              {authGateError ?? error}
            </div>
          </div>
        ) : null}
        <Login />
      </div>
    )
  }

  return (
    <div>
      <div className="container" style={{ paddingBottom: 0 }}>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>TECHFLOW</strong> <span className="pill">{role}</span>
            {roleHint ? <span className="muted"> (hint: {roleHint})</span> : null}
          </div>
          <button
            className="ghost"
            onClick={() => {
              setAuthGateError(null)
              supabase.auth.signOut().catch(() => {})
            }}
          >
            Вийти
          </button>
        </div>
        {error ? (
          <div className="card" style={{ marginTop: 10, borderColor: '#fecaca', color: '#b91c1c' }}>
            {error}
          </div>
        ) : null}
      </div>

      {role === 'store_staff' ? <StoreStaffDashboard /> : null}
      {role === 'technician' ? <TechnicianBoard /> : null}
      {role === 'manager' ? <ManagerView /> : null}
    </div>
  )
}
