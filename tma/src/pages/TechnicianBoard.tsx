import { useEffect, useState } from 'react'
import type { TicketWithContext } from '../lib/types'
import { claimTicket, listTicketsForTechnician, markPendingConfirmation } from '../lib/tickets'

function TechnicianStoreRating({ ticket }: { ticket: TicketWithContext }) {
  if (ticket.status !== 'rated') return null
  const stars = ticket.rating_stars
  if (stars === null || stars === undefined)
    return <p className="muted">Магазин завершив оцінювання.</p>

  return (
    <div
      style={{
        marginTop: 10,
        padding: 10,
        borderRadius: 8,
        background: 'var(--code-bg)',
        textAlign: 'left',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6 }}>Як магазин оцінив роботу</div>
      <div style={{ letterSpacing: 3 }} aria-label={`Оцінка ${stars} з 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} style={{ color: n <= stars ? '#ca8a04' : 'var(--border)' }}>
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
        <div className="card">Завантаження…</div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="card">
        <h2 style={{ marginTop: 0 }}>Технік — задачі</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          MVP: ти бачиш свої задачі + “нові” без виконавця (можна взяти в роботу).
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="ghost" onClick={() => refresh().catch(() => {})}>
            Оновити
          </button>
        </div>
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      </div>

      <div style={{ height: 12 }} />

      <div className="card" style={{ textAlign: 'left' }}>
        <h3 style={{ marginTop: 0 }}>Список</h3>
        {tickets.length === 0 ? <p className="muted">Нема задач.</p> : null}

        {tickets.map((t) => (
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
            <p className="muted" style={{ fontSize: '0.88em', marginBottom: 8 }}>
              <strong>Магазин:</strong> {t.store?.name ?? '—'}
              {t.creator?.full_name ? (
                <>
                  {' '}
                  • <strong>Заявку подав:</strong> {t.creator.full_name}
                </>
              ) : null}
            </p>

            {t.status === 'new' && !t.tech_id ? (
              <button onClick={() => onClaim(t.id)}>Взяти в роботу</button>
            ) : null}

            {t.status === 'in_progress' ? (
              <button onClick={() => onFinish(t.id)}>Виконано → на підтвердження</button>
            ) : null}

            {t.status === 'pending_confirmation' ? <p className="muted">Очікує підтвердження магазину.</p> : null}

            <TechnicianStoreRating ticket={t} />
          </div>
        ))}
      </div>
    </div>
  )
}

