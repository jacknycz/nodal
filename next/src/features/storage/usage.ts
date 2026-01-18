import { getSupabaseClient } from '../auth/supabaseClient'
import { useUserRole } from '../auth/roles'
import { useMemo, useEffect, useState, useCallback } from 'react'

export type Plan = 'free' | 'pro' | 'admin'

export function getPlanForRole(role: 'Admin' | 'Pro' | 'User'): Plan {
  if (role === 'Admin') return 'admin'
  if (role === 'Pro') return 'pro'
  return 'free'
}

export function getPlanLimits(plan: Plan): { totalBytes: number; uploadLimitBytes: number } {
  const MB = 1024 * 1024
  const GB = 1024 * MB
  switch (plan) {
    case 'admin':
      return { totalBytes: Number.MAX_SAFE_INTEGER, uploadLimitBytes: Number.MAX_SAFE_INTEGER }
    case 'pro':
      return { totalBytes: 5 * GB, uploadLimitBytes: 100 * MB }
    case 'free':
    default:
      return { totalBytes: 250 * MB, uploadLimitBytes: 10 * MB }
  }
}

export async function getUserStorageUsageBytes(): Promise<number> {
  try {
    const client = getSupabaseClient()
    const { data: sessionData } = await client.auth.getSession()
    const user = sessionData?.session?.user
    if (!user) return 0
    // Sum file_size for documents owned by the user
    // Use range pagination if large; for now one shot select
    const { data: rows, error } = await client
      .from('documents')
      .select('file_size')
      .eq('user_id', user.id)

    if (error) return 0
    let sum = 0
    for (const row of (rows || []) as Array<{ file_size: number }>) {
      const n = Number(row.file_size || 0)
      if (!Number.isNaN(n)) sum += n
    }
    return sum
  } catch {
    return 0
  }
}

export function useStorageUsage(): {
  usedBytes: number
  totalBytes: number
  uploadLimitBytes: number
  percentUsed: number
  refresh: () => Promise<void>
  plan: Plan
} {
  const { role } = useUserRole()
  const plan = useMemo(() => getPlanForRole(role), [role])
  const limits = useMemo(() => getPlanLimits(plan), [plan])
  const [usedBytes, setUsedBytes] = useState(0)

  const refresh = useCallback(async () => {
    const v = await getUserStorageUsageBytes()
    setUsedBytes(v)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const percentUsed = limits.totalBytes > 0 ? Math.min(100, Math.round((usedBytes / limits.totalBytes) * 100)) : 0

  return {
    usedBytes,
    totalBytes: limits.totalBytes,
    uploadLimitBytes: limits.uploadLimitBytes,
    percentUsed,
    refresh,
    plan,
  }
}


