import { useEffect, useMemo, useState } from 'react'
import { StarRatingPicker } from '../components/StarRatingPicker'
import type { TicketWithContext } from '../lib/types'
import { fetchMyStores } from '../lib/profile'
import { confirmAndRateTicket, createTicket, listTicketsForStoreStaff, rateTicket } from '../lib/tickets'

function PendingCloseForm({
  ticketId,
  onSuccess,
}: {
  ticketId: string
  onSuccess: () => Promise<void>
}) {
  const [stars, setStars] = useState(0)
  const [review, setReview] = useState('')
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  async function submit() {
    if (stars < 1) {
      setLocalErr('Обери оцінку від 1 до 5.')
      return
    }
    setLocalErr(null)
    setBusy(true)
    try {
      await confirmAndRateTicket(ticketId, stars, review)
      setStars(0)
      setReview('')
      await onSuccess()
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div className="muted" style={{ marginBottom: 4 }}>
        Технік повідомив про виконання. Підтверди роботу та оціни сервіс.
      </div>
      <label style={{ fontSize: '0.92em' }}>Оцінка</label>
      <StarRatingPicker value={stars} onChange={setStars} disabled={busy} />
      <label style={{ display: 'block', marginTop: 10, fontSize: '0.92em' }}>Коментар (необов’язково)</label>
      <textarea value={review} onChange={(e) => setReview(e.target.value)} disabled={busy} placeholder="Як минуло майстерність / швидкість?" rows={2} />
      {localErr ? <p style={{ color: '#b91c1c', marginTop: 8 }}>{localErr}</p> : null}
      <div style={{ marginTop: 10 }}>
        <button type="button" disabled={busy} onClick={submit}>
          {busy ? 'Збереження…' : 'Підтвердити виконання й відправити оцінку'}
        </button>
      </div>
    </div>
  )
}

function CompletedRatingForm({
  ticketId,
  onSuccess,
}: {
  ticketId: string
  onSuccess: () => Promise<void>
}) {
  const [stars, setStars] = useState(0)
  const [review, setReview] = useState('')
  const [busy, setBusy] = useState(false)
  const [localErr, setLocalErr] = useState<string | null>(null)

  async function submit() {
    if (stars < 1) {
      setLocalErr('Обери оцінку від 1 до 5.')
      return
    }
    setLocalErr(null)
    setBusy(true)
    try {
      await rateTicket(ticketId, stars, review)
      await onSuccess()
    } catch (e) {
      setLocalErr(e instanceof Error ? e.message : 'Помилка')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
      <div className="muted">Залиш оцінку за виконання.</div>
      <label style={{ fontSize: '0.92em', display: 'block', marginTop: 8 }}>Оцінка</label>
      <StarRatingPicker value={stars} onChange={setStars} disabled={busy} />
      <label style={{ display: 'block', marginTop: 10, fontSize: '0.92em' }}>Коментар</label>
      <textarea value={review} onChange={(e) => setReview(e.target.value)} disabled={busy} placeholder="Коротко про роботу" rows={2} />
      {localErr ? <p style={{ color: '#b91c1c', marginTop: 8 }}>{localErr}</p> : null}
      <div style={{ marginTop: 10 }}>
        <button type="button" disabled={busy} onClick={submit}>
          {busy ? 'Збереження…' : 'Відправити оцінку'}
        </button>
      </div>
    </div>
  )
}

function ticketStatusLabel(status: TicketWithContext['status']): string {
  switch (status) {
    case 'new':
      return 'Нова'
    case 'in_progress':
      return 'У роботі'
    case 'pending_confirmation':
      return 'Очікує підтвердження'
    case 'completed':
      return 'Очікує вашу оцінку'
    case 'rated':
      return 'Завершено й оцінено'
    default:
      return status
  }
}

function ticketStatusHint(status: TicketWithContext['status']) {
  switch (status) {
    case 'new':
      return 'Чекає або ще нема призначеного техніка. Після створення задача зʼявиться в техніка.'
    case 'in_progress':
      return 'Заявку взято техніком у роботу.'
    case 'pending_confirmation':
      return ''
    case 'completed':
      return 'Виконання підтверджено; залиш оцінку нижче.'
    case 'rated':
      return ''
    default:
      return ''
  }
}

export function StoreStaffDashboard() {
  const [stores, setStores] = useState<Array<{ id: string; name: string }>>([])
  const [selectedStoreId, setSelectedStoreId] = useState<string>('')
  const [description, setDescription] = useState('')
  const [tickets, setTickets] = useState<TicketWithContext[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const storeIds = useMemo(() => stores.map((s) => s.id), [stores])

  const openTickets = useMemo(() => tickets.filter((t) => t.status !== 'rated'), [tickets])
  const archivedTickets = useMemo(() => tickets.filter((t) => t.status === 'rated'), [tickets])

  function renderTicketCard(t: TicketWithContext) {
    const hint = ticketStatusHint(t.status)
    return (
      <div key={t.id} className="ticket" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <span className="pill">{ticketStatusLabel(t.status)}</span>{' '}
            <span className="muted">{new Date(t.created_at).toLocaleString()}</span>
          </div>
          <div className="muted" style={{ wordBreak: 'break-all' }}>
            {t.id.slice(0, 8)}
          </div>
        </div>
        <p style={{ marginBottom: hint ? 4 : 6 }}>{t.description}</p>
        <p className="muted" style={{ fontSize: '0.88em', marginTop: hint ? 0 : 4, marginBottom: 0 }}>
          <strong>Точка:</strong> {t.store?.name ?? '—'}{' '}
          {t.assignee?.full_name ? (
            <>
              • <strong>Технік:</strong> {t.assignee.full_name}
            </>
          ) : (
            <>• технік поки не призначений</>
          )}
        </p>
        {hint ? <p className="muted" style={{ fontSize: '0.9em', marginTop: 6 }}>{hint}</p> : null}

        {t.status === 'pending_confirmation' ? (
          <PendingCloseForm ticketId={t.id} onSuccess={refresh} />
        ) : null}

        {t.status === 'completed' ? <CompletedRatingForm ticketId={t.id} onSuccess={refresh} /> : null}

        {t.status === 'rated' ? (
          <p className="muted" style={{ marginTop: 8 }}>
            Оцінено: {t.rating_stars}★
            {t.review_text ? <> — «{t.review_text}»</> : null}
          </p>
        ) : null}
      </div>
    )
  }

  async function refresh() {
    setError(null)
    const t = await listTicketsForStoreStaff(storeIds)
    setTickets(t)
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        const linked = await fetchMyStores()
        const s = linked.map((x) => x.stores)
        if (!alive) return
        setStores(s)
        setSelectedStoreId(s[0]?.id ?? '')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error')
      } finally {
        setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!storeIds.length) return
    refresh().catch((e) => setError(e instanceof Error ? e.message : 'Error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeIds.join(',')])

  async function onCreate() {
    if (!selectedStoreId) return
    if (!description.trim()) return
    setError(null)
    try {
      await createTicket(selectedStoreId, description.trim())
      setDescription('')
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
      <div className="card" style={{ textAlign: 'left' }}>
        <h2 style={{ marginTop: 0 }}>Магазин — SOS</h2>
        <div className="row">
          <div>
            <label>Магазин</label>
            <select value={selectedStoreId} onChange={(e) => setSelectedStoreId(e.target.value)}>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Опис проблеми</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Коротко: що зламалось?" />
          </div>
        </div>
        <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
          <button onClick={onCreate} disabled={!selectedStoreId || !description.trim()}>
            Створити заявку
          </button>
          <button className="ghost" onClick={() => refresh().catch(() => {})} disabled={!storeIds.length}>
            Оновити
          </button>
        </div>
        {error ? <p style={{ color: '#b91c1c' }}>{error}</p> : null}
      </div>

      <div style={{ height: 12 }} />

      <div className="card" style={{ textAlign: 'left' }}>
        <h3 style={{ marginTop: 0 }}>Поточні заявки</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Тут лише те, що ще потребує дій магазину або техніка. Після підтвердження й оцінки заявка переходить у блок нижче.
        </p>

        {openTickets.length === 0 ? <p className="muted">Немає поточних заявок.</p> : null}
        {openTickets.map(renderTicketCard)}

        <div style={{ height: 16 }} />

        <h3 style={{ marginTop: 0, fontSize: '1.05em' }}>Завершені й оцінені</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Заявки, за якими ви вже поставили оцінку. Для нових дій по них звертайтесь до керівництва.
        </p>

        {archivedTickets.length === 0 ? <p className="muted">Поки немає завершених заявок.</p> : null}
        {archivedTickets.map(renderTicketCard)}
      </div>
    </div>
  )
}

