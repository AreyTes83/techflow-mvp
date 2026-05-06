import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { DEV_TEST_ACCOUNTS, isDevQuickLoginEnabled } from '../lib/devTestAccounts'

/** У WebView Telegram виклик auth інколи буває надто повільним — не тримаємо кнопку без меж. */
const SIGN_IN_DEADLINE_MS = 15_000

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type LoginProps = {
  /** Після перезавантаження в TG getSession інколи приходить із затримкою — не показуємо червоний банер. */
  recoveryInProgress?: boolean
  /** Помилка з беку (fetch ролі тощо) — під формою, не блокує повноекранно. */
  serverErrorBelowForm?: string | null
}

export function Login({ recoveryInProgress = false, serverErrorBelowForm = null }: LoginProps) {
  const quickLogin = isDevQuickLoginEnabled()
  const [presetKey, setPresetKey] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      // Інакше в WebView часто лишається попередній JWT — наче знову «перший» працівник.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {})

      const raced = await Promise.race([
        supabase.auth.signInWithPassword({ email: email.trim(), password }),
        sleep(SIGN_IN_DEADLINE_MS).then(() => ({ __timeout: true as const })),
      ])

      if (typeof raced === 'object' && raced && '__timeout' in raced) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        setError(
          `Не вдалось увійти за ${SIGN_IN_DEADLINE_MS / 1000} с (частіше в Telegram). Спробуй іншу мережу або закрий міні-ап і відкрий знову з бота.`,
        )
        return
      }

      const { error } = raced
      if (error) throw error
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>TECHFLOW — вхід</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          MVP: тестові обліковки з seed або введення вручну. Реальні ролі завжди з бази після входу.
        </p>
        {quickLogin ? (
          <div style={{ marginTop: 12 }}>
            <label>Швидкий вибір профілю (dev)</label>
            <select
              value={presetKey}
              onChange={(e) => {
                const k = e.target.value
                setPresetKey(k)
                const acc = DEV_TEST_ACCOUNTS.find((a) => a.key === k)
                if (!acc) {
                  setEmail('')
                  setPassword('')
                  return
                }
                setEmail(acc.email)
                setPassword(acc.password)
              }}
              style={{ width: '100%', marginTop: 4, padding: '10px 8px', fontSize: '1rem' }}
            >
              <option value="">— вибір ролі / точки для автозаповнення —</option>
              {DEV_TEST_ACCOUNTS.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.label}
                </option>
              ))}
            </select>
            {presetKey ? (
              <p className="muted" style={{ marginTop: 6, marginBottom: 0, fontSize: '0.9em' }}>
                Пароль з seed уже підставлено — лише «Увійти» нижче. Без пароля в Supabase увійти не
                можна без окремої магічної авторизації.
              </p>
            ) : null}
          </div>
        ) : null}
        {recoveryInProgress ? (
          <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
            Відновлюємо збережений вхід…
          </p>
        ) : null}

        <form onSubmit={onSubmit} style={{ marginTop: quickLogin ? 16 : 0 }}>
          {!presetKey || !quickLogin ? (
            <>
              <label>Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="store@techflow.local" />
              <label>Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="store12345"
                type="password"
              />
            </>
          ) : (
            <>
              <label>Email (з пресета)</label>
              <input value={email} readOnly disabled style={{ opacity: 0.85 }} />
            </>
          )}
          {presetKey && quickLogin ? (
            <p className="muted" style={{ marginTop: 8 }}>
              Обліковка:{' '}
              <code style={{ wordBreak: 'break-all' }}>{email}</code>
            </p>
          ) : null}

          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button disabled={loading}>{loading ? 'Входимо…' : 'Увійти'}</button>
          </div>
          {serverErrorBelowForm ? (
            <p style={{ marginTop: 10, color: '#b91c1c' }}>
              {serverErrorBelowForm}
            </p>
          ) : null}
          {error ? (
            <p style={{ marginTop: 10, color: '#b91c1c' }}>
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  )
}

