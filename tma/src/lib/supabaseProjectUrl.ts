/**
 * Supabase JS client expects the **project root** only:
 *   https://<ref>.supabase.co
 * Do NOT append /rest/v1/ (common copy-paste mistake → "Invalid path specified in request URL").
 */
export function normalizeSupabaseProjectUrl(raw: string): string {
  let s = String(raw).trim().replace(/\s+/g, '')
  if (!s) return s

  // Dashboard link → API host
  if (s.includes('supabase.com/dashboard/project/')) {
    const m = s.match(/\/dashboard\/project\/([^/?#]+)/)
    if (m) {
      const ref = m[1].replace(/\s+/g, '')
      s = `https://${ref}.supabase.co`
    }
  }

  // Strip accidental API suffix
  s = s.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '')

  try {
    const u = new URL(s)
    if (!u.hostname.toLowerCase().endsWith('.supabase.co')) {
      return s
    }
    return `${u.protocol}//${u.hostname}`
  } catch {
    return s
  }
}
