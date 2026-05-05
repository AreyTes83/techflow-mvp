import { useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigured } from './lib/supabase'
import type { RoleName } from './lib/types'
import { initTelegramWebApp } from './lib/telegram'
import { fetchMyRole } from './lib/profile'
import { Login } from './components/Login'
import { StoreStaffDashboard } from './pages/StoreStaffDashboard'
import { TechnicianBoard } from './pages/TechnicianBoard'
import { ManagerView } from './pages/ManagerView'

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
  const roleHint = useMemo(() => getRoleHint(), [])

  useEffect(() => {
    initTelegramWebApp()
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      if (!alive) return
      setSessionReady(true)
      if (data.session) {
        try {
          const r = await fetchMyRole()
          if (!alive) return
          setRole(r)
        } catch (e) {
          setError(e instanceof Error ? e.message : 'Error')
        }
      }
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!alive) return
      setError(null)
      if (!session) {
        setRole(null)
        return
      }
      try {
        const r = await fetchMyRole()
        if (!alive) return
        setRole(r)
      } catch (e) {
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

  if (!role) return <Login />

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
