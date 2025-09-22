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
    if (isAdmin(user)) load()
  }, [user])

  if (!user) return <div className="p-6">Sign in required.</div>
  if (!isAdmin(user)) return <div className="p-6">Not Authorized</div>

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin • Users</h1>
      {loading && <div>Loading…</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-left">
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
                <tr key={u.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-3 py-2">{u.email || '—'}</td>
                  <td className="px-3 py-2">{u.role || 'User'}</td>
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
    </div>
  )
}


