import type { RoleName } from './types'

export type DevTestAccount = {
  key: string
  label: string
  /** Для навігації / розуміння; реальну роль тягнемо з user_roles у БД після входу. */
  roleHint: RoleName
  email: string
  password: string
}

/** Ті самі креденшли, що з `supabase/seed/001_seed.sql` та LOCAL_RUN.md. */
export const DEV_TEST_ACCOUNTS: readonly DevTestAccount[] = [
  {
    key: 'store1',
    label: 'Співробітник точки · Магазин 1',
    roleHint: 'store_staff',
    email: 'store@techflow.local',
    password: 'store12345',
  },
  {
    key: 'store2',
    label: 'Співробітник точки · Магазин 2',
    roleHint: 'store_staff',
    email: 'store2@techflow.local',
    password: 'store212345',
  },
  {
    key: 'tech',
    label: 'Технік',
    roleHint: 'technician',
    email: 'tech@techflow.local',
    password: 'tech12345',
  },
  {
    key: 'manager',
    label: 'Менеджер',
    roleHint: 'manager',
    email: 'manager@techflow.local',
    password: 'manager123',
  },
]

export function isDevQuickLoginEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_QUICK_LOGIN === 'true'
}
