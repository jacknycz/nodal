'use client'

import React, { useEffect, useState } from 'react'
import { useSupabaseUser } from '@/features/auth/authUtils'
import { isAdmin, getUserRoleFromMetadata } from '@/features/auth/roles'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'

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
  const [selectedFeedback, setSelectedFeedback] = useState<{ id: string; quick: string; details?: string | null; idea?: boolean; broken?: boolean; user_id?: string | null; user_email?: string | null; board_id?: string | null; board_name?: string | null; created_at?: string } | null>(null)

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
                  <tr
                    key={f.id}
                    className="border-t border-gray-800 align-top cursor-pointer hover:bg-gray-800/60"
                    onClick={() => setSelectedFeedback(f)}
                  >
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

      {/* Feedback details modal */}
      <Modal
        open={!!selectedFeedback}
        onClose={() => setSelectedFeedback(null)}
        title="Feedback Details"
        description="Full submission information"
        actions={
          <>
            <Button variant="secondary" onClick={() => setSelectedFeedback(null)}>Close</Button>
          </>
        }
      >
        {selectedFeedback && (
          <div className="space-y-3 text-sm">
            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wide">Quick</div>
              <div className="mt-1 text-gray-100">{selectedFeedback.quick || '—'}</div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wide">Details</div>
              <div className="mt-1 whitespace-pre-wrap text-gray-200">{selectedFeedback.details || '—'}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wide">Idea</div>
                <div className="mt-1">{selectedFeedback.idea ? 'Yes' : '—'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wide">Broken</div>
                <div className="mt-1">{selectedFeedback.broken ? 'Yes' : '—'}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wide">User Email</div>
                <div className="mt-1 truncate" title={selectedFeedback.user_email || ''}>{selectedFeedback.user_email || '—'}</div>
                <div className="text-gray-400 text-xs uppercase tracking-wide mt-3">User ID</div>
                <div className="mt-1 break-all text-gray-300">{selectedFeedback.user_id || '—'}</div>
              </div>
              <div>
                <div className="text-gray-400 text-xs uppercase tracking-wide">Board Name</div>
                <div className="mt-1 truncate" title={selectedFeedback.board_name || ''}>{selectedFeedback.board_name || '—'}</div>
                <div className="text-gray-400 text-xs uppercase tracking-wide mt-3">Board ID</div>
                <div className="mt-1 break-all text-gray-300">{selectedFeedback.board_id || '—'}</div>
              </div>
            </div>
            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wide">Created</div>
              <div className="mt-1">{selectedFeedback.created_at ? new Date(selectedFeedback.created_at).toLocaleString() : '—'}</div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}


