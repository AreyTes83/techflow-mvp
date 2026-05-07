import { useEffect, useMemo, useState } from 'react'
import { TicketStatusGroup } from '../components/TicketStatusGroup'
import { groupTicketsByStatusOrdered, ticketStatusLabelUa, ticketStatusLabelUaOrDash } from '../lib/ticketStatus'
import type { TicketHistoryRow, TicketWithContext } from '../lib/types'
import { listTicketHistoryForTicketIds, listTicketsForManager } from '../lib/tickets'

export function ManagerView() {
  const [tickets, setTickets] = useState<TicketWithContext[]>([])
  const [historyByTicket, setHistoryByTicket] = useState<Record<string, TicketHistoryRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ticketGroups = useMemo(() => groupTicketsByStatusOrdered(tickets), [tickets])

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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flexWrap: 'wrap',
            marginBottom: 8,
          }}
        >
          <h2 style={{ margin: 0 }}>Усі заявки</h2>
          <button className="ghost" type="button" onClick={() => refresh().catch(() => {})}>
            Оновити
          </button>
        </div>
        {error ? <p style={{ color: '#fecaca', marginTop: 8 }}>{error}</p> : null}

        {tickets.length === 0 ? <p className="muted">Немає заявок.</p> : null}

        {ticketGroups.map(({ status: groupStatus, items, count }) => (
          <TicketStatusGroup key={groupStatus} groupStatus={groupStatus} label={ticketStatusLabelUa(groupStatus)} count={count}>
            {items.map((t) => {
              const hist = historyByTicket[t.id] ?? []
              return (
            <div key={t.id} className="ticket-card">
              <div className="ticket-card-meta">
                <div>
                  <span className="pill pill--status" data-status={t.status}>
                    {ticketStatusLabelUa(t.status)}
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
                        {h.old_status == null
                          ? `створено → ${ticketStatusLabelUaOrDash(h.new_status)}`
                          : `${ticketStatusLabelUaOrDash(h.old_status)} → ${ticketStatusLabelUaOrDash(h.new_status)}`}
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
          </TicketStatusGroup>
        ))}
      </div>
    </div>
  )
}

