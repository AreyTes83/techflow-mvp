import { supabase } from './supabase'
import type { RoleName } from './types'

const ROLE_FETCH_DEADLINE_MS = 12_000

function sleep(ms: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(
      () =>
        reject(
          new Error(
            'Таймаут при отриманні ролі. Перевір мережу або відкрий міні-ап з іншої мережі (інколи блокують домен *.supabase.co).',
          ),
        ),
      ms,
    ),
  )
}

export async function fetchMyRole(): Promise<RoleName> {
  return Promise.race([fetchMyRoleBody(), sleep(ROLE_FETCH_DEADLINE_MS)])
}

async function fetchMyRoleBody(): Promise<RoleName> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()

  if (userErr) throw userErr
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  const roleName = (data as any)?.roles?.name as RoleName | undefined
  if (!roleName) throw new Error('Role is not assigned (seed missing?)')
  return roleName
}

export async function fetchMyDisplayIdentity(): Promise<{ full_name: string; email: string | null }> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr) throw userErr
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.from('users').select('full_name').eq('id', user.id).maybeSingle()

  if (error) throw error
  const full_name = (data?.full_name as string | undefined) ?? '—'
  return { full_name, email: user.email ?? null }
}

export async function fetchMyStores(): Promise<Array<{ store_id: string; stores: { id: string; name: string } }>> {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser()
  if (userErr) throw userErr
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase.from('user_stores').select('store_id, stores(id, name)').eq('user_id', user.id)
  if (error) throw error
  return (data ?? []) as any
}

