import { useEffect, useState } from 'react'

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

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/usage', { headers: {} })
        const json = await res.json()
        if (!res.ok) throw new Error(json?.error || 'Failed to load usage')
        setSummary({ total: json.total, cap: json.cap, remaining: json.remaining, pct: json.pct })
      } catch (e: any) {
        setError(e?.message || 'Failed to load usage')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const warn80 = !!summary && summary.cap !== Number.MAX_SAFE_INTEGER && summary.total >= 0.8 * summary.cap

  return { loading, error, summary, warn80 }
}


