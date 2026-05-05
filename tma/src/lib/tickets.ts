import { supabase } from './supabase'
import type { Ticket, TicketStatus, TicketWithContext } from './types'

const TICKET_CONTEXT_SELECT =
  '*,store:stores!tickets_store_id_fkey(id,name),creator:users!tickets_created_by_fkey(id,full_name),assignee:users!tickets_tech_id_fkey(id,full_name)'

export async function listTicketsForStoreStaff(storeIds: string[]): Promise<TicketWithContext[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_CONTEXT_SELECT)
    .in('store_id', storeIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as TicketWithContext[]
}

export async function listTicketsForTechnician(): Promise<TicketWithContext[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_CONTEXT_SELECT)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as TicketWithContext[]
}

export async function listTicketsForManager(): Promise<TicketWithContext[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select(TICKET_CONTEXT_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as TicketWithContext[]
}

export async function createTicket(storeId: string, description: string): Promise<Ticket> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr) throw userErr
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('tickets')
    .insert({
      store_id: storeId,
      description,
      created_by: user.id,
      status: 'new' satisfies TicketStatus,
    })
    .select('*')
    .single()

  if (error) throw error
  return data as Ticket
}

export async function claimTicket(ticketId: string): Promise<void> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr) throw userErr
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('tickets')
    .update({ tech_id: user.id, status: 'in_progress' satisfies TicketStatus })
    .eq('id', ticketId)

  if (error) throw error
}

export async function markPendingConfirmation(ticketId: string): Promise<void> {
  const { error } = await supabase
    .from('tickets')
    .update({ status: 'pending_confirmation' satisfies TicketStatus, completed_at: new Date().toISOString() })
    .eq('id', ticketId)
  if (error) throw error
}

export async function confirmCompleted(ticketId: string): Promise<void> {
  const { error } = await supabase.from('tickets').update({ status: 'completed' satisfies TicketStatus }).eq('id', ticketId)
  if (error) throw error
}

/** Магазин підтвердив роботу і одразу ставить оцінку (MVP один клік). */
export async function confirmAndRateTicket(ticketId: string, stars: number, reviewText: string): Promise<void> {
  if (stars < 1 || stars > 5) throw new Error('Оцінка від 1 до 5')

  const { data, error } = await supabase
    .from('tickets')
    .update({
      status: 'rated' satisfies TicketStatus,
      rating_stars: stars,
      review_text: reviewText.trim() || null,
    })
    .eq('id', ticketId)
    .eq('status', 'pending_confirmation' satisfies TicketStatus)
    .select('id')

  if (error) throw error
  if (!data?.length) throw new Error('Заявка вже оновлена або статус не «на підтвердженні»')
}

/** Для заявок, що були переведені в «виконано» без оцінки (стара версія екрану). */
export async function rateTicket(ticketId: string, stars: number, reviewText: string): Promise<void> {
  if (stars < 1 || stars > 5) throw new Error('Оцінка від 1 до 5')

  const { data, error } = await supabase
    .from('tickets')
    .update({
      status: 'rated' satisfies TicketStatus,
      rating_stars: stars,
      review_text: reviewText.trim() || null,
    })
    .eq('id', ticketId)
    .eq('status', 'completed' satisfies TicketStatus)
    .select('id')

  if (error) throw error
  if (!data?.length) throw new Error('Спочатку підтвердь виконання або ця заявка вже оцінена')
}

