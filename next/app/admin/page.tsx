'use client'

import React, { useEffect, useState } from 'react'
import { useSupabaseUser } from '@/features/auth/authUtils'
import { isAdmin, getUserRoleFromMetadata } from '@/features/auth/roles'
import Select from '@/components/ui/Select'

interface LiteUser {
  id: string
  email: string | null
  role: string | null
  createdAt: string
  lastSignInAt: string | null
  confirmedAt: string | null
}

export default function AdminUsersPage() {
  const user = useSupabaseUser()
  const [users, setUsers] = useState<LiteUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Array<{ id: string; quick: string; details?: string | null; idea?: boolean; broken?: boolean; user_id?: string | null; user_email?: string | null; board_id?: string | null; board_name?: string | null; created_at?: string }>>([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/admin/users')
        if (!res.ok) throw new Error(`Failed: ${res.status}`)
        const json = await res.json()
        setUsers(json.users || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load users')
      } finally {
        setLoading(false)
      }
    }
    const loadFeedback = async () => {
      try {
        const res = await fetch('/api/admin/feedback')
        if (res.ok) {
          const json = await res.json()
          setFeedback(Array.isArray(json.feedback) ? json.feedback : [])
        }
      } catch {}
    }
    if (isAdmin(user)) { load(); loadFeedback() }
  }, [user])

  if (!user) return <div className="p-6">Sign in required.</div>
  if (!isAdmin(user)) return <div className="p-6">Not Authorized</div>

  return (
    <div className="p-6 max-w-5xl mx-auto min-h-screen bg-gray-950 text-gray-100">
      <h1 className="text-2xl font-bold mb-4">Admin</h1>
      <h2 className="text-xl font-semibold mb-2">Users</h2>
      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-800 text-left">
              <tr>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2">Last sign-in</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-gray-800">
                  <td className="px-3 py-2">{u.email || '—'}</td>
                  <td className="px-3 py-2 capitalize">{u.role || 'User'}</td>
                  <td className="px-3 py-2">{new Date(u.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{u.lastSignInAt ? new Date(u.lastSignInAt).toLocaleString() : '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Select
                        size="xs"
                        value={(u.role || 'user').toLowerCase()}
                        onChange={async (val) => {
                          try {
                            const res = await fetch('/api/admin/users', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ userId: u.id, role: val })
                            })
                            if (!res.ok) throw new Error('Failed to update role')
                            setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role: val === 'user' ? null : val as any } : x))
                          } catch (e) {
                            alert('Unable to set role')
                          }
                        }}
                        options={[
                          { value: 'user', label: 'User' },
                          { value: 'pro', label: 'Pro' },
                          { value: 'admin', label: 'Admin' },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-2">Feedback</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-800 bg-gray-900">
          {feedback.length === 0 ? (
            <div className="p-3 text-sm text-gray-400">No feedback yet.</div>
          ) : (
            <table className="min-w-full text-xs sm:text-sm">
              <thead className="bg-gray-800 text-left">
                <tr>
                  <th className="px-3 py-2">Quick</th>
                  <th className="px-3 py-2">Idea</th>
                  <th className="px-3 py-2">Broken</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Board</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {feedback.map((f) => (
                  <tr key={f.id} className="border-t border-gray-800 align-top">
                    <td className="px-3 py-2 w-[28ch] max-w-[28ch]">
                      <div className="truncate" title={f.quick}>{f.quick}</div>
                      {f.details && (
                        <div className="text-[11px] text-gray-400 mt-1 truncate max-w-[28ch]" title={f.details || ''}>{f.details}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{f.idea ? 'Yes' : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{f.broken ? 'Yes' : '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[24ch]" title={f.user_email || ''}>{f.user_email || '—'}</span>
                        <span className="text-[11px] text-gray-400 truncate max-w-[24ch]" title={f.user_id || ''}>{f.user_id || ''}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="truncate max-w-[24ch]" title={f.board_name || ''}>{f.board_name || '—'}</span>
                        <span className="text-[11px] text-gray-400 truncate max-w-[24ch]" title={f.board_id || ''}>{f.board_id || ''}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{f.created_at ? new Date(f.created_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}


