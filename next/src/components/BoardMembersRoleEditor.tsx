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
        // Fetch members (join auth.users for email)
        const { data: members } = await supabase
          .from('board_members')
          .select('user_id, role')
          .eq('board_id', boardId)

        const ids = (members || []).map((m: any) => m.user_id)
        let emailMap: Record<string, string | null> = {}
        let usernameMap: Record<string, string | null> = {}
        if (ids.length > 0) {
          const [{ data: users }, { data: profiles }] = await Promise.all([
            supabase.auth.admin.listUsers(),
            supabase.from('profiles').select('id, username').in('id', ids),
          ])
          const list = (users as any)?.users || []
          list.forEach((u: any) => { if (ids.includes(u.id)) emailMap[u.id] = u.email || null })
          ;(profiles as any[] | null || []).forEach((p: any) => { if (ids.includes(p.id)) usernameMap[p.id] = p.username || null })
        }

        const mapped = (members || []).map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          email: emailMap[m.user_id] || null,
          username: usernameMap[m.user_id] || null,
        }))
        setRows(mapped)
      } finally {
        setLoading(false)
      }
    }
    load()
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
            <Select
              value={r.role}
              onChange={(v) => updateRole(r.user_id, v as any)}
              options={[
                { label: 'Owner', value: 'owner' },
                { label: 'Editor', value: 'editor' },
                { label: 'Viewer', value: 'viewer' },
              ]}
              size="xs"
              className="w-28"
              disabled={!isOwnerView || r.role === 'owner'}
            />
          </div>
        </div>
      ))}
    </div>
  )
}


