'use client'

import type { User } from '@supabase/supabase-js'
import { useSupabaseUser } from './authUtils'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseClient } from './supabaseClient'

export type UserRole = 'Admin' | 'Pro' | 'User'

export type BoardRole = 'owner' | 'editor' | 'viewer'

export function canBoard(action: 'view' | 'edit' | 'share' | 'settings', role: BoardRole): boolean {
  switch (action) {
    case 'view':
      return role === 'owner' || role === 'editor' || role === 'viewer'
    case 'edit':
      return role === 'owner' || role === 'editor'
    case 'share':
      return role === 'owner' || role === 'editor'
    case 'settings':
      return role === 'owner'
    default:
      return false
  }
}

export function getUserRoleFromMetadata(user: User | null | undefined): UserRole {
  if (!user) return 'User'
  // Prefer app_metadata for roles; fall back to user_metadata
  const appRole = (user.app_metadata as any)?.role
  const metaRole = (user.user_metadata as any)?.role
  const role = (appRole || metaRole || '').toString().trim()
  if (/^admin$/i.test(role)) return 'Admin'
  if (/^pro$/i.test(role) || /^pro[-_ ]?user$/i.test(role)) return 'Pro'
  return 'User'
}

// Allow both role-based and email-allowlist admin detection
const DEFAULT_ADMIN_EMAILS = ['jack.nycz@gmail.com']
const ENV_ADMIN_EMAILS = (process.env.NEXT_PUBLIC_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean)
const ADMIN_EMAIL_SET = new Set<string>([...DEFAULT_ADMIN_EMAILS, ...ENV_ADMIN_EMAILS].map(e => e.toLowerCase()))

export function isAdmin(user: User | null | undefined): boolean {
  if (!user) return false
  if (getUserRoleFromMetadata(user) === 'Admin') return true
  const email = (user.email || '').toLowerCase()
  return ADMIN_EMAIL_SET.has(email)
}

export function useUserRole(): { role: UserRole; isAdmin: boolean; isPro: boolean; user: User | null } {
  const user = useSupabaseUser()
  const initialRole = useMemo(() => getUserRoleFromMetadata(user), [user])
  const [stableRole, setStableRole] = useState<UserRole>(initialRole)
  const highestSeen = useRef<UserRole>(initialRole)
  const cacheKey = typeof window !== 'undefined' && user?.id ? `nodal.role.${user.id}` : null

  // Promote-only updates to avoid flicker (never demote within a session)
  const promote = (next: UserRole) => {
    const rank = (r: UserRole) => (r === 'Admin' ? 3 : r === 'Pro' ? 2 : 1)
    if (rank(next) > rank(highestSeen.current)) {
      highestSeen.current = next
      setStableRole(next)
      try { if (cacheKey) localStorage.setItem(cacheKey, next) } catch {}
    }
  }

  useEffect(() => {
    // Seed from cached highest role for this user to avoid UI flash
    try {
      if (cacheKey) {
        const cached = (localStorage.getItem(cacheKey) || '') as UserRole
        if (cached === 'Admin' || cached === 'Pro' || cached === 'User') {
          promote(cached)
        }
      }
    } catch {}
    // Promote based on current auth metadata (never demote)
    promote(initialRole)
    // Fetch server-derived cap to infer effective role and promote if higher
    const run = async () => {
      try {
        const supa = getSupabaseClient()
        const { data } = await supa.auth.getSession()
        const token = data?.session?.access_token
        const res = await fetch('/api/usage', { headers: token ? { 'Authorization': `Bearer ${token}` } : {} })
        if (!res.ok) return
        const json = await res.json()
        const cap: number = json?.cap
        let inferred: UserRole = 'User'
        if (typeof cap === 'number') {
          if (cap === Number.MAX_SAFE_INTEGER) inferred = 'Admin'
          else if (cap >= 100000) inferred = 'Pro'
        }
        promote(inferred)
      } catch {}
    }
    run()
  }, [initialRole])

  // Also promote from auth metadata if it changes upward
  useEffect(() => {
    promote(initialRole)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRole])

  const role = stableRole
  return { role, isAdmin: role === 'Admin', isPro: role === 'Pro', user }
}

// Utility for gating UI
export function canManageBoards(user: User | null | undefined): boolean {
  // Example: only admins manage certain features
  return isAdmin(user)
}


