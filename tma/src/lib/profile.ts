import { supabase } from './supabase'
import type { RoleName } from './types'

export async function fetchMyRole(): Promise<RoleName> {
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

