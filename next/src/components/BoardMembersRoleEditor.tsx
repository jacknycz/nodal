'use client'

import React, { useEffect, useState } from 'react'
import Select from './ui/Select'
import { getSupabaseClient } from '../features/auth/supabaseClient'

interface Props {
  boardId: string
  isOwnerView?: boolean
}

type MemberRow = {
  user_id: string
  email?: string | null
  username?: string | null
  role: 'owner' | 'editor' | 'viewer'
}

export default function BoardMembersRoleEditor({ boardId, isOwnerView = false }: Props) {
  const [rows, setRows] = useState<MemberRow[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = getSupabaseClient()

  useEffect(() => {
    const load = async () => {
      if (!boardId) return
      setLoading(true)
      try {
        // Fetch members via server route to include email/username without client admin permissions
        const resp = await fetch(`/api/board/members?boardId=${encodeURIComponent(boardId)}`)
        const json = await resp.json()
        const members = Array.isArray(json.members) ? json.members : []

        setRows(members as any)
      } finally {
        setLoading(false)
      }
    }
    load()
    const handler = (e: any) => {
      try {
        if (!e?.detail?.boardId || e.detail.boardId === boardId) {
          load()
        }
      } catch {}
    }
    window.addEventListener('nodal:board-members-updated' as any, handler)
    return () => window.removeEventListener('nodal:board-members-updated' as any, handler)
  }, [boardId, supabase])

  const updateRole = async (userId: string, role: 'owner' | 'editor' | 'viewer') => {
    setRows(prev => prev.map(r => r.user_id === userId ? { ...r, role } : r))
    try {
      await supabase
        .from('board_members')
        .update({ role })
        .eq('board_id', boardId)
        .eq('user_id', userId)
    } catch {
      // noop revert on failure? keeping optimistic for now
    }
  }

  if (!boardId) return null

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-200 dark:divide-gray-800 overflow-hidden">
      <div className="grid grid-cols-3 gap-2 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400">
        <div>User</div>
        <div className="col-span-2">Role</div>
      </div>
      {loading ? (
        <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No members yet.</div>
      ) : rows.map((r) => (
        <div key={r.user_id} className="grid grid-cols-3 gap-2 px-3 py-2 items-center">
          <div className="truncate text-sm text-gray-900 dark:text-white">
            {r.username ? `${r.username}${r.email ? ` (${r.email})` : ''}` : (r.email || r.user_id)}
          </div>
          <div className="col-span-2">
            {r.role === 'owner' ? (
              <div className="text-xs text-gray-700 font-bold dark:text-gray-300">Owner</div>
            ) : (
              <Select
                value={r.role}
                onChange={(v) => updateRole(r.user_id, v as any)}
                options={[
                  { label: 'Editor', value: 'editor' },
                  { label: 'Viewer', value: 'viewer' },
                ]}
                size="xs"
                className="w-28"
                disabled={!isOwnerView}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}


