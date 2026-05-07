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
        <div className="card card--compact">Завантаження…</div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Керівник — моніторинг</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Огляд усієї поточної черги та ключових переходів статусів.
        </p>
        <div className="toolbar">
          <button className="ghost" type="button" onClick={() => refresh().catch(() => {})}>
            Оновити
          </button>
        </div>
        {error ? <p style={{ color: '#fecaca', marginTop: 12 }}>{error}</p> : null}
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Усі тікети</h3>
        {tickets.length === 0 ? <p className="muted">Нема тікетів.</p> : null}

        {tickets.map((t) => {
          const hist = historyByTicket[t.id] ?? []
          return (
            <div key={t.id} className="ticket-card">
              <div className="ticket-card-meta">
                <div>
                  <span className="pill pill--status" data-status={t.status}>
                    {t.status}
                  </span>{' '}
                  <span className="muted ticket-summary">{new Date(t.created_at).toLocaleString()}</span>
                </div>
                <span className="mono-id">{t.id.slice(0, 8)}</span>
              </div>
              <div className="ticket-card-title">{t.description}</div>
              <div className="ticket-meta-box muted">
                <div>
                  <span className="meta-label">Магазин</span> {t.store?.name ?? '—'}
                </div>
                <div>
                  <span className="meta-label">Технік</span>{' '}
                  {t.assignee?.full_name ?? (t.tech_id ? '—' : 'не призначений')}
                </div>
                <div>
                  <span className="meta-label">Створено</span> {t.creator?.full_name ?? '—'}
                </div>
                {t.status === 'rated' && t.rating_stars !== null ? (
                  <div>
                    <span className="meta-label">Оцінка</span> {t.rating_stars}/5
                    {t.review_text ? <> — «{t.review_text}»</> : null}
                  </div>
                ) : null}
              </div>
              {hist.length > 0 ? (
                <div className="ticket-history">
                  <details className="inset-panel" style={{ marginTop: 10 }}>
                  <summary className="muted" style={{ userSelect: 'none' }}>
                    Історія статусів ({hist.length})
                  </summary>
                  <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: '0.9em', lineHeight: 1.55 }}>
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
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

