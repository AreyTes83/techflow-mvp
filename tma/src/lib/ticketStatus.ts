import type { TicketStatus } from './types'

/** Порядок груп на екранах (від найбільш актуального до архівних). */
export const TICKET_STATUS_GROUP_ORDER = [
  'new',
  'in_progress',
  'pending_confirmation',
  'completed',
  'rated',
] as const satisfies readonly TicketStatus[]

/** Однакові українські підписи для всіх ролей (чіпи й заголовки груп). */
export function ticketStatusLabelUa(status: TicketStatus): string {
  switch (status) {
    case 'new':
      return 'Нова'
    case 'in_progress':
      return 'У роботі'
    case 'pending_confirmation':
      return 'Очікує підтвердження'
    case 'completed':
      return 'Очікує оцінку'
    case 'rated':
      return 'Завершено й оцінено'
    default:
      return status
  }
}

export function ticketStatusLabelUaOrDash(status: TicketStatus | null): string {
  return status === null ? '—' : ticketStatusLabelUa(status)
}

/** Групи лише для статусів, які реально є у списку (порядок задає TICKET_STATUS_GROUP_ORDER). */
export function groupTicketsByStatusOrdered<T extends { status: TicketStatus }>(
  tickets: T[],
  allowedStatuses?: ReadonlyArray<TicketStatus>,
): Array<{ status: TicketStatus; items: T[]; count: number }> {
  const order = TICKET_STATUS_GROUP_ORDER
  const by = new Map<TicketStatus, T[]>()

  const consider = allowedStatuses ? new Set(allowedStatuses) : null
  for (const row of tickets) {
    if (consider && !consider.has(row.status)) continue
    const bucket = by.get(row.status)
    if (bucket) bucket.push(row)
    else by.set(row.status, [row])
  }

  const out: Array<{ status: TicketStatus; items: T[]; count: number }> = []
  for (const status of order) {
    const items = by.get(status)
    if (!items?.length) continue
    out.push({ status, items, count: items.length })
    by.delete(status)
  }
  for (const [status, items] of by) {
    if (items.length) out.push({ status, items, count: items.length })
  }
  return out
}
