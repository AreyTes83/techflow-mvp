import { useEffect, useState } from 'react'
import type { TicketHistoryRow, TicketWithContext } from '../lib/types'
import { listTicketHistoryForTicketIds, listTicketsForManager } from '../lib/tickets'

export function ManagerView() {
  const [tickets, setTickets] = useState<TicketWithContext[]>([])
  const [historyByTicket, setHistoryByTicket] = useState<Record<string, TicketHistoryRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function refresh() {
    setError(null)
    const t = await listTicketsForManager()
    setTickets(t)
    if (t.length === 0) {
      setHistoryByTicket({})
      return
    }
    const rows = await listTicketHistoryForTicketIds(t.map((x) => x.id))
    const map: Record<string, TicketHistoryRow[]> = {}
    for (const r of rows) {
      ;(map[r.ticket_id] ??= []).push(r)
    }
    setHistoryByTicket(map)
  }

  useEffect(() => {
    refresh()
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="container">
        <div className="card">Завантаження…</div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Керівник — моніторинг</h2>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="ghost" onClick={() => refresh().catch(() => {})}>
            Оновити
          </button>
        </div>
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      </div>

      <div style={{ height: 12 }} />

      <div className="card" style={{ textAlign: 'left' }}>
        <h3 style={{ marginTop: 0 }}>Усі тікети</h3>
        {tickets.length === 0 ? <p className="muted">Нема тікетів.</p> : null}

        {tickets.map((t) => {
          const hist = historyByTicket[t.id] ?? []
          return (
            <div key={t.id} className="ticket">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <span className="pill">{t.status}</span>{' '}
                  <span className="muted">{new Date(t.created_at).toLocaleString()}</span>
                </div>
                <div className="muted" style={{ wordBreak: 'break-all' }}>
                  {t.id.slice(0, 8)}
                </div>
              </div>
              <p style={{ marginBottom: 6 }}>{t.description}</p>
              <div className="muted" style={{ fontSize: '0.88em', lineHeight: 1.45 }}>
                <div>
                  <strong>Магазин:</strong> {t.store?.name ?? '—'}
                </div>
                <div>
                  <strong>Технік:</strong>{' '}
                  {t.assignee?.full_name ?? (t.tech_id ? '—' : 'не призначений')}
                </div>
                <div>
                  <strong>Хто створив заявку:</strong> {t.creator?.full_name ?? '—'}
                </div>
                {t.status === 'rated' && t.rating_stars !== null ? (
                  <div>
                    <strong>Оцінка магазину:</strong> {t.rating_stars}/5
                    {t.review_text ? <> — «{t.review_text}»</> : null}
                  </div>
                ) : null}
              </div>
              {hist.length > 0 ? (
                <details style={{ marginTop: 10 }}>
                  <summary className="muted" style={{ cursor: 'pointer', userSelect: 'none' }}>
                    Історія статусів ({hist.length})
                  </summary>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: '0.85em', lineHeight: 1.5 }}>
                    {hist.map((h) => (
                      <li key={h.id}>
                        <span className="muted">{new Date(h.changed_at).toLocaleString()}</span>
                        {' — '}
                        {h.old_status == null ? `створено → ${h.new_status}` : `${h.old_status} → ${h.new_status}`}
                        {h.changed_by ? (
                          <span className="muted"> · {h.changed_by.slice(0, 8)}…</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

