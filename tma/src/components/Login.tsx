import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
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
          MVP режим: увійди тестовим email/password (з seed).
        </p>

        <form onSubmit={onSubmit}>
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="store@techflow.local" />
          <label>Password</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="store12345"
            type="password"
          />

          <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
            <button disabled={loading}>{loading ? 'Входимо…' : 'Увійти'}</button>
          </div>
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

