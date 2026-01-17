import { useEffect, useState, useCallback } from 'react'
import { fetchUsageCached } from './usageClient'

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
      const result = await fetchUsageCached({ maxAgeMs: 30_000 })
      if (!result.ok) throw new Error(result.error || 'Failed to load usage')
      setSummary(result.summary)
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


