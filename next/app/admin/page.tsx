'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSupabaseUser } from '@/features/auth/authUtils'
import { isAdmin, getUserRoleFromMetadata } from '@/features/auth/roles'
import Select from '@/components/ui/Select'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Checkbox from '@/components/ui/Checkbox'
import TipTapEditor from '@/components/TipTapEditor'
import { CheckFat } from '@phosphor-icons/react/dist/ssr'

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
  const [feedback, setFeedback] = useState<Array<{ id: string; quick: string; details?: string | null; idea?: boolean; broken?: boolean; done?: boolean; notes?: string | null; user_id?: string | null; user_email?: string | null; board_id?: string | null; board_name?: string | null; created_at?: string }>>([])
  const [selectedFeedback, setSelectedFeedback] = useState<{ id: string; quick: string; details?: string | null; idea?: boolean; broken?: boolean; done?: boolean; notes?: string | null; user_id?: string | null; user_email?: string | null; board_id?: string | null; board_name?: string | null; created_at?: string } | null>(null)
  const [notesDraft, setNotesDraft] = useState<string>('')
  const [sortKey, setSortKey] = useState<'done' | 'idea' | 'broken' | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const sortedFeedback = useMemo(() => {
    const rows = Array.isArray(feedback) ? [...feedback] : []
    if (!sortKey) return rows
    rows.sort((a, b) => {
      const av = !!(a as any)[sortKey]
      const bv = !!(b as any)[sortKey]
      const aPrim = av ? 1 : 0
      const bPrim = bv ? 1 : 0
      let cmp = aPrim - bPrim
      if (cmp === 0) {
        // Tie-breaker: created_at descending by default (newest first)
        const at = a.created_at ? new Date(a.created_at).getTime() : 0
        const bt = b.created_at ? new Date(b.created_at).getTime() : 0
        cmp = bt - at
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return rows
  }, [feedback, sortKey, sortDir])

  const toggleSort = (key: 'done' | 'idea' | 'broken') => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return prev
      }
      setSortDir('asc')
      return key
    })
  }

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
                  <th className="px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort('done')} title="Sort by Done">
                    <div className="flex items-center gap-1">
                      <CheckFat size={16} weight="duotone" />
                      {sortKey === 'done' && (<span className="text-[10px] text-gray-400">{sortDir === 'asc' ? '↑' : '↓'}</span>)}
                    </div>
                  </th>
                  <th className="px-3 py-2">Quick</th>
                  <th className="px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort('idea')} title="Sort by Idea">
                    <div className="flex items-center gap-1">
                      <span>Idea</span>
                      {sortKey === 'idea' && (<span className="text-[10px] text-gray-400">{sortDir === 'asc' ? '↑' : '↓'}</span>)}
                    </div>
                  </th>
                  <th className="px-3 py-2 cursor-pointer select-none" onClick={() => toggleSort('broken')} title="Sort by Broken">
                    <div className="flex items-center gap-1">
                      <span>Broken</span>
                      {sortKey === 'broken' && (<span className="text-[10px] text-gray-400">{sortDir === 'asc' ? '↑' : '↓'}</span>)}
                    </div>
                  </th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">User</th>
                  <th className="px-3 py-2">Board</th>
                  <th className="px-3 py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {sortedFeedback.map((f) => (
                  <tr
                    key={f.id}
                    className="border-t border-gray-800 align-top cursor-pointer hover:bg-gray-800/60"
                    onClick={() => { setSelectedFeedback(f); setNotesDraft(f.notes || '') }}
                  >
                    <td className="px-3 py-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={!!f.done}
                        onChange={async (val) => {
                          const next = !!val
                          // Optimistic update
                          setFeedback(prev => prev.map(x => x.id === f.id ? { ...x, done: next } : x))
                          try {
                            const res = await fetch('/api/admin/feedback', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: f.id, done: next })
                            })
                            if (!res.ok) throw new Error('Failed to update')
                          } catch (e) {
                            // Revert on failure
                            setFeedback(prev => prev.map(x => x.id === f.id ? { ...x, done: !next } : x))
                            alert('Unable to update done status')
                          }
                        }}
                        label=""
                        className="!p-0"
                      />
                    </td>
                    <td className="px-3 py-2 w-[28ch] max-w-[28ch]">
                      <div className="truncate" title={f.quick}>{f.quick}</div>
                      {f.details && (
                        <div className="text-[11px] text-gray-400 mt-1 truncate max-w-[28ch]" title={f.details || ''}>{f.details}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{f.idea ? 'Yes' : '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{f.broken ? 'Yes' : '—'}</td>
                    <td className="px-3 py-2 w-[28ch] max-w-[28ch]">
                      <div className="truncate text-gray-300" title={(f.notes || '').replace(/<[^>]+>/g, '')}>{(f.notes || '').replace(/<[^>]+>/g, '')}</div>
                    </td>
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
            <Button
              variant="primary"
              onClick={async () => {
                if (!selectedFeedback) return
                const id = selectedFeedback.id
                try {
                  const res = await fetch('/api/admin/feedback', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, notes: notesDraft })
                  })
                  if (!res.ok) throw new Error('failed')
                  setSelectedFeedback(prev => prev ? { ...prev, notes: notesDraft } : prev)
                  setFeedback(prev => prev.map(x => x.id === id ? { ...x, notes: notesDraft } : x))
                } catch {
                  alert('Unable to save notes')
                }
              }}
            >
              Save Notes
            </Button>
          </>
        }
      >
        {selectedFeedback && (
          <div className="space-y-3 text-sm">
            <div className="absolute top-6 right-6">
              <Checkbox
                checked={!!selectedFeedback.done}
                onChange={async (val) => {
                  const next = !!val
                  // Optimistic update: modal state
                  setSelectedFeedback(prev => prev ? { ...prev, done: next } : prev)
                  // Optimistic update: table state
                  setFeedback(prev => prev.map(x => x.id === selectedFeedback.id ? { ...x, done: next } : x))
                  try {
                    const res = await fetch('/api/admin/feedback', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ id: selectedFeedback.id, done: next })
                    })
                    if (!res.ok) throw new Error('Failed to update')
                  } catch (e) {
                    // Revert on failure
                    setSelectedFeedback(prev => prev ? { ...prev, done: !next } : prev)
                    setFeedback(prev => prev.map(x => x.id === selectedFeedback.id ? { ...x, done: !next } : x))
                    alert('Unable to update done status')
                  }
                }}
                // label="Done"
              />
            </div>
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

            {/* Notes editor */}
            <div>
              <div className="text-gray-400 text-xs uppercase tracking-wide mb-1">Notes</div>
              <TipTapEditor
                content={notesDraft}
                onChange={setNotesDraft}
                placeholder="Add internal notes…"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}


