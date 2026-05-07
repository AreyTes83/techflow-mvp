import { useEffect, useMemo, useState } from 'react'
import { TicketStatusGroup } from '../components/TicketStatusGroup'
import { groupTicketsByStatusOrdered, ticketStatusLabelUa } from '../lib/ticketStatus'
import type { TicketWithContext } from '../lib/types'
import { claimTicket, listTicketsForTechnician, markPendingConfirmation } from '../lib/tickets'

function TechnicianStoreRating({ ticket }: { ticket: TicketWithContext }) {
  if (ticket.status !== 'rated') return null
  const stars = ticket.rating_stars
  if (stars === null || stars === undefined)
    return <p className="muted">Магазин завершив оцінювання.</p>

  return (
    <div className="inset-panel" style={{ marginTop: 10, textAlign: 'left' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Як магазин оцінив роботу</div>
      <div style={{ letterSpacing: 3 }} aria-label={`Оцінка ${stars} з 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} style={{ color: n <= stars ? '#fbbf24' : 'rgba(244,247,255,0.15)' }}>
            ★
          </span>
        ))}
        <span className="muted" style={{ letterSpacing: 0, marginLeft: 8 }}>
          {stars}/5
        </span>
      </div>
      {ticket.review_text ? (
        <p style={{ margin: '10px 0 0', fontSize: '0.95em', lineHeight: 1.4 }}>{ticket.review_text}</p>
      ) : (
        <p className="muted" style={{ margin: '10px 0 0', fontSize: '0.9em' }}>
          Коментар магазину не залишив.
        </p>
      )}
    </div>
  )
}

export function TechnicianBoard() {
  const [tickets, setTickets] = useState<TicketWithContext[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const ticketGroups = useMemo(() => groupTicketsByStatusOrdered(tickets), [tickets])

  async function refresh() {
    setError(null)
    const t = await listTicketsForTechnician()
    setTickets(t)
  }

  useEffect(() => {
    refresh()
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false))
  }, [])

  async function onClaim(ticketId: string) {
    setError(null)
    try {
      await claimTicket(ticketId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

  async function onFinish(ticketId: string) {
    setError(null)
    try {
      await markPendingConfirmation(ticketId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    }
  }

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
        <h2 style={{ marginTop: 0 }}>Технік — задачі</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Твої призначення й «нові» без виконавця — їх можна взяти в роботу одним тапом.
        </p>
        <div className="toolbar">
          <button type="button" className="ghost" onClick={() => refresh().catch(() => {})}>
            Оновити
          </button>
        </div>
        {error ? <p style={{ color: '#fecaca', marginTop: 12 }}>{error}</p> : null}
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Список</h3>
        {tickets.length === 0 ? <p className="muted">Нема задач.</p> : null}

        {ticketGroups.map(({ status: groupStatus, items, count }) => (
          <TicketStatusGroup key={groupStatus} groupStatus={groupStatus} label={ticketStatusLabelUa(groupStatus)} count={count}>
            {items.map((t) => (
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
            <div className="muted ticket-meta-box" style={{ marginBottom: 8 }}>
              <div>
                <span className="meta-label">Магазин</span> {t.store?.name ?? '—'}
              </div>
              {t.creator?.full_name ? (
                <div>
                  <span className="meta-label">Заявку подав</span> {t.creator.full_name}
                </div>
              ) : null}
            </div>

            <div className="btn-row">
              {t.status === 'new' && !t.tech_id ? (
                <button type="button" onClick={() => onClaim(t.id)}>
                  Взяти в роботу
                </button>
              ) : null}

              {t.status === 'in_progress' ? (
                <button type="button" onClick={() => onFinish(t.id)}>
                  Виконано → на підтвердження
                </button>
              ) : null}
            </div>

            {t.status === 'pending_confirmation' ? (
              <p className="muted" style={{ marginTop: 10 }}>
                Очікує підтвердження магазину.
              </p>
            ) : null}

            <TechnicianStoreRating ticket={t} />
          </div>
            ))}
          </TicketStatusGroup>
        ))}
      </div>
    </div>
  )
}

