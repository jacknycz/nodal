'use client'

import type { User } from '@supabase/supabase-js'
import { useSupabaseUser } from './authUtils'
import { useMemo } from 'react'

export type UserRole = 'Admin' | 'User'

export function getUserRoleFromMetadata(user: User | null | undefined): UserRole {
  if (!user) return 'User'
  // Prefer app_metadata for roles; fall back to user_metadata
  const appRole = (user.app_metadata as any)?.role
  const metaRole = (user.user_metadata as any)?.role
  const role = (appRole || metaRole || '').toString().trim()
  if (/^admin$/i.test(role)) return 'Admin'
  return 'User'
}

export function isAdmin(user: User | null | undefined): boolean {
  return getUserRoleFromMetadata(user) === 'Admin'
}

export function useUserRole(): { role: UserRole; isAdmin: boolean; user: User | null } {
  const user = useSupabaseUser()
  const role = useMemo(() => getUserRoleFromMetadata(user), [user])
  return { role, isAdmin: role === 'Admin', user }
}

// Utility for gating UI
export function canManageBoards(user: User | null | undefined): boolean {
  // Example: only admins manage certain features
  return isAdmin(user)
}


