import { getSupabaseClient } from '../auth/supabaseClient'
import type { UsageSummary } from './usage'

export type UsageFetchResult = {
  ok: boolean
  status: number
  summary: UsageSummary | null
  error?: string
}

type CacheEntry = {
  token: string
  at: number
  result: UsageFetchResult
}

let inFlight: Promise<UsageFetchResult> | null = null
let cache: CacheEntry | null = null

export async function fetchUsageCached(opts?: { force?: boolean; maxAgeMs?: number }): Promise<UsageFetchResult> {
  const force = !!opts?.force
  const maxAgeMs = typeof opts?.maxAgeMs === 'number' ? opts!.maxAgeMs : 30_000

  // Share in-flight work across all callers (prevents request storms)
  if (!force && inFlight) return inFlight

  inFlight = (async () => {
    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token

      // No session: treat as "ok but no usage" (prevents noisy 401s).
      if (!token) {
        return { ok: true, status: 204, summary: null }
      }

      // Use cached result when fresh and token matches
      if (!force && cache && cache.token === token && Date.now() - cache.at <= maxAgeMs) {
        return cache.result
      }

      const res = await fetch('/api/usage', { headers: { Authorization: `Bearer ${token}` } })
      const json = await res.json().catch(() => ({} as any))
      const result: UsageFetchResult = res.ok
        ? {
            ok: true,
            status: res.status,
            summary: { total: json.total, cap: json.cap, remaining: json.remaining, pct: json.pct },
          }
        : {
            ok: false,
            status: res.status,
            summary: null,
            error: String(json?.error || res.statusText || 'Failed to load usage'),
          }

      cache = { token, at: Date.now(), result }
      return result
    } catch (e: any) {
      return { ok: false, status: 0, summary: null, error: e?.message || 'Failed to load usage' }
    } finally {
      inFlight = null
    }
  })()

  return inFlight
}

