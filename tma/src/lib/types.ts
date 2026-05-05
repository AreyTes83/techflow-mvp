export type RoleName = 'store_staff' | 'technician' | 'manager'

export type TicketStatus =
  | 'new'
  | 'in_progress'
  | 'pending_confirmation'
  | 'completed'
  | 'rated'

export type Ticket = {
  id: string
  store_id: string
  status: TicketStatus
  description: string
  created_by: string
  tech_id: string | null
  created_at: string
  updated_at: string
  completed_at: string | null
  rating_stars: number | null
  review_text: string | null
}

/** Вкладені рядки з PostgREST (lib/tickets enrich select). */
export type TicketProfileEmbed = {
  id: string
  full_name: string
}

/** Після select з joins: store, автор заявки, призначений технік. */
export type TicketWithContext = Ticket & {
  store: { id: string; name: string } | null
  creator: TicketProfileEmbed | null
  assignee: TicketProfileEmbed | null
}

export type TicketHistoryRow = {
  id: string
  ticket_id: string
  changed_by: string | null
  old_status: TicketStatus | null
  new_status: TicketStatus | null
  note: string | null
  changed_at: string
}

