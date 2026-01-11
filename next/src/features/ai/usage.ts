import { useEffect, useState, useCallback } from 'react'
import { getSupabaseClient } from '../auth/supabaseClient'

export type Plan = 'Free' | 'Pro' | 'Admin'

export function getPlanTokenCap(plan: Plan): number {
  switch (plan) {
    case 'Free': return 15000
    case 'Pro': return 100000
    case 'Admin': return Number.MAX_SAFE_INTEGER
    default: return 15000
  }
}

export interface UsageSummary {
  total: number
  cap: number
  remaining: number
  pct: number
}

export function useAIUsage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<UsageSummary | null>(null)

  const fetchUsage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = getSupabaseClient()
      const { data } = await supabase.auth.getSession()
      const token = data?.session?.access_token

      // If there is no authenticated session, skip calling /api/usage to avoid
      // spamming 401s in the console; just treat as "no usage yet".
      if (!token) {
        try {
          console.info?.('[ai] Skipping /api/usage fetch (no Supabase session)')
        } catch {}
        setSummary(null)
        setLoading(false)
        return
      }

      const res = await fetch('/api/usage', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Failed to load usage')
      setSummary({ total: json.total, cap: json.cap, remaining: json.remaining, pct: json.pct })
    } catch (e: any) {
      setError(e?.message || 'Failed to load usage')
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsage()
    const id = setInterval(fetchUsage, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [fetchUsage])

  const warn80 = !!summary && summary.cap !== Number.MAX_SAFE_INTEGER && summary.total >= 0.8 * summary.cap && summary.total < summary.cap
  const exceeded = !!summary && summary.cap !== Number.MAX_SAFE_INTEGER && summary.total >= summary.cap

  return { loading, error, summary, warn80, exceeded, refresh: fetchUsage }
}


