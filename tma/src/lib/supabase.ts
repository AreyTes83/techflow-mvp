import { createClient } from '@supabase/supabase-js'

import { normalizeSupabaseProjectUrl } from './supabaseProjectUrl'

const supabaseUrlRaw = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const supabaseUrl = supabaseUrlRaw ? normalizeSupabaseProjectUrl(supabaseUrlRaw) : undefined

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

// IMPORTANT:
// - For MVP we allow the app to boot even if env vars are missing, so the UI can show a friendly error.
// - During `npm run build`, modules may be evaluated without real env values.
export const supabase = createClient(supabaseUrl ?? 'http://localhost', supabaseAnonKey ?? 'public-anon-key')

