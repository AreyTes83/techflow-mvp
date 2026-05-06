import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import type { RoleName } from './lib/types'
import { exchangeInitDataForAccessToken, getBotApiBaseUrl, getTelegramInitData } from './lib/botSession'
import { initTelegramWebApp } from './lib/telegram'
import { fetchMyDisplayIdentity, fetchMyRole } from './lib/profile'
import { Login } from './components/Login'
import { StoreStaffDashboard } from './pages/StoreStaffDashboard'
import { TechnicianBoard } from './pages/TechnicianBoard'
import { ManagerView } from './pages/ManagerView'

/**
 * Після цього часу не тримаємо користувача на повноекранному лоудері — показуємо вхід
 * або (якщо getSession «прокинувся» у фоні) тихе «Відновлюємо вхід…» без червоних попереджень.
 */
const SESSION_REVEAL_CAP_MS = 550
/** Фонова спроба getSession після cap — не нескінченно тримаємо «Відновлюємо…». */
const SESSION_RESUME_DEADLINE_MS = 12_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

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

  /** false = ще повноекранний сплеш (короткий: або швидке завершення auth, або cap). */
  const [gateOpen, setGateOpen] = useState(false)
  const [role, setRole] = useState<RoleName | null>(null)
  const [error, setError] = useState<string | null>(null)
  /** true після cap, поки в фоні ще чекаємо getSession (після «зависання»). */
  const [resumeSessionPending, setResumeSessionPending] = useState(false)
  /** Щоб при зміні акаунта React не тримав старий стан сторінок (важливо, якщо ті самі storeIds). */
  const [sessionUserId, setSessionUserId] = useState<string | null>(null)
  const [identityLine, setIdentityLine] = useState<string | null>(null)
  const bootGenRef = useRef(0)
  const roleHint = useMemo(() => getRoleHint(), [])

  useEffect(() => {
    initTelegramWebApp()
  }, [])

  useEffect(() => {
    const myBoot = ++bootGenRef.current
    let alive = true

    ;(async () => {
      try {
        const botBase = getBotApiBaseUrl()
        const tgInit = getTelegramInitData()

        if (botBase && tgInit) {
          try {
            await supabase.auth.signOut({ scope: 'local' })
            const access_token = await exchangeInitDataForAccessToken(botBase, tgInit)
            const { data: sessWrap, error: sessErr } = await supabase.auth.setSession({
              access_token,
              refresh_token: access_token,
            })
            if (sessErr) throw sessErr
            if (!sessWrap.session) throw new Error('Порожня сесія після Telegram-входу')

            const r = await fetchMyRole()
            if (bootGenRef.current !== myBoot) return
            setSessionUserId(sessWrap.session.user.id)
            setRole(r)
            setGateOpen(true)
            return
          } catch (tgErr) {
            if (bootGenRef.current !== myBoot) return
            setError(
              tgErr instanceof Error
                ? `Telegram: ${tgErr.message}. Для тесту в браузері увійди паролем.`
                : 'Telegram вхід не вдався. Спробуй пароль.',
            )
          }
        }

        const raced = await Promise.race([
          supabase.auth.getSession().then((r) => ({ kind: 'session' as const, r })),
          sleep(SESSION_REVEAL_CAP_MS).then(() => ({ kind: 'cap' as const })),
        ])

        if (bootGenRef.current !== myBoot) return

        if (raced.kind === 'cap') {
          setGateOpen(true)
          setResumeSessionPending(true)
          const resumed = await Promise.race([
            supabase.auth.getSession(),
            sleep(SESSION_RESUME_DEADLINE_MS).then(() => '__deadline__' as const),
          ])
          if (bootGenRef.current !== myBoot) return
          setResumeSessionPending(false)
          if (resumed === '__deadline__') {
            void supabase.auth.getSession().then(async (later) => {
              if (!later.data.session) return
              if (bootGenRef.current !== myBoot) return
              setSessionUserId(later.data.session.user.id)
              try {
                const r = await fetchMyRole()
                if (bootGenRef.current !== myBoot) return
                setRole(r)
              } catch (e) {
                if (bootGenRef.current !== myBoot) return
                setError(e instanceof Error ? e.message : 'Error')
              }
            })
            return
          }
          setSessionUserId(resumed.data.session?.user.id ?? null)
          if (!resumed.data.session) return
          try {
            const r = await fetchMyRole()
            if (!alive || bootGenRef.current !== myBoot) return
            setRole(r)
          } catch (e) {
            if (!alive || bootGenRef.current !== myBoot) return
            setError(e instanceof Error ? e.message : 'Error')
          }
          return
        }

        const session = raced.r.data.session ?? null
        if (!session) {
          setSessionUserId(null)
          setGateOpen(true)
          return
        }

        setSessionUserId(session.user.id)
        try {
          const r = await fetchMyRole()
          if (!alive || bootGenRef.current !== myBoot) return
          setRole(r)
        } catch (e) {
          if (!alive || bootGenRef.current !== myBoot) return
          setError(e instanceof Error ? e.message : 'Error')
        }
        setGateOpen(true)
      } catch {
        if (bootGenRef.current !== myBoot) return
        setGateOpen(true)
        setResumeSessionPending(false)
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!alive) return
      setSessionUserId(session?.user.id ?? null)
      if (!session) {
        setRole(null)
        setError(null)
        setResumeSessionPending(false)
        setIdentityLine(null)
        return
      }
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

  useEffect(() => {
    if (!sessionUserId || !role) {
      setIdentityLine(null)
      return
    }
    let ok = true
    fetchMyDisplayIdentity()
      .then((id) => {
        if (!ok) return
        setIdentityLine(id.email ? `${id.full_name} · ${id.email}` : id.full_name)
      })
      .catch(() => {
        if (!ok) return
        setIdentityLine(null)
      })
    return () => {
      ok = false
    }
  }, [sessionUserId, role])

  if (!gateOpen) {
    return (
      <div className="container">
        <div className="card">Завантаження…</div>
      </div>
    )
  }

  if (!role) {
    return (
      <Login recoveryInProgress={resumeSessionPending} serverErrorBelowForm={error} />
    )
  }

  return (
    <div>
      <div className="container" style={{ paddingBottom: 0 }}>
        <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>TECHFLOW</strong> <span className="pill">{role}</span>
            {roleHint ? <span className="muted"> (hint: {roleHint})</span> : null}
            {identityLine ? (
              <div className="muted" style={{ fontSize: '0.88em', marginTop: 4 }}>
                {identityLine}
              </div>
            ) : null}
          </div>
          <button
            className="ghost"
            onClick={() => {
              setSessionUserId(null)
              setIdentityLine(null)
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

      {role === 'store_staff' ? <StoreStaffDashboard key={sessionUserId ?? role} /> : null}
      {role === 'technician' ? <TechnicianBoard key={sessionUserId ?? role} /> : null}
      {role === 'manager' ? <ManagerView key={sessionUserId ?? role} /> : null}
    </div>
  )
}
