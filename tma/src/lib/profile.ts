import { supabase } from './supabase'
import type { RoleName } from './types'

/** Cold start Telegram WebView + мобільна мережа часто >12 с до першої відповіді з *.supabase.co */
const ROLE_FETCH_DEADLINE_MS = 28_000
const ROLE_FETCH_MAX_ATTEMPTS = 3
const ROLE_FETCH_BACKOFF_MS = [0, 450, 1200]

const ROLE_TIMEOUT_UA =
  'Таймаут при отриманні ролі. Перевір мережу або відкрий міні-ап з іншої мережі (інколи блокують домен *.supabase.co).'

/** getUser інколи «висить» у WebView — без цього вхід виглядає як зависання. */
const AUTH_GET_USER_DEADLINE_MS = 18_000
const AUTH_GET_USER_TIMEOUT_UA =
  'Не вдалося перевірити сесію за відведений час. Закрий міні-ап і відкрий знову або перевір зв’язок до Supabase.'

/** Два одночасні виклики fetchMyRole (boot + onAuthStateChange) не мають дублювати запити. */
const pendingRoleByUserId = new Map<string, Promise<RoleName>>()

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    id = setTimeout(() => reject(new Error(message)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (id !== undefined) clearTimeout(id)
  }) as Promise<T>
}

async function fetchMyRoleOnce(userId: string): Promise<RoleName> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()

  if (error) throw error
  const roleName = (data as any)?.roles?.name as RoleName | undefined
  if (!roleName) throw new Error('Role is not assigned (seed missing?)')
  return roleName
}

async function fetchMyRoleWithRetries(userId: string): Promise<RoleName> {
  let lastErr: unknown
  for (let i = 0; i < ROLE_FETCH_MAX_ATTEMPTS; i++) {
    const delay = ROLE_FETCH_BACKOFF_MS[i] ?? 1200
    if (delay > 0) {
      await new Promise((r) => setTimeout(r, delay))
    }
    try {
      return await withTimeout(fetchMyRoleOnce(userId), ROLE_FETCH_DEADLINE_MS, ROLE_TIMEOUT_UA)
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

export async function fetchMyRole(): Promise<RoleName> {
  const {
    data: { user },
    error: userErr,
  } = await withTimeout(supabase.auth.getUser(), AUTH_GET_USER_DEADLINE_MS, AUTH_GET_USER_TIMEOUT_UA)

  if (userErr) throw userErr
  if (!user) throw new Error('Not authenticated')

  const uid = user.id
  let chained = pendingRoleByUserId.get(uid)
  if (!chained) {
    chained = fetchMyRoleWithRetries(uid).finally(() => {
      pendingRoleByUserId.delete(uid)
    })
    pendingRoleByUserId.set(uid, chained)
  }
  return chained
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
