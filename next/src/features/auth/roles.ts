'use client'

import type { User } from '@supabase/supabase-js'
import { useSupabaseUser } from './authUtils'
import { useMemo } from 'react'

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
  const role = useMemo(() => getUserRoleFromMetadata(user), [user])
  return { role, isAdmin: role === 'Admin', isPro: role === 'Pro', user }
}

// Utility for gating UI
export function canManageBoards(user: User | null | undefined): boolean {
  // Example: only admins manage certain features
  return isAdmin(user)
}


