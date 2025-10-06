"use client"
import React from 'react'
import TextInput from './ui/TextInput'
import Button from './ui/Button'
import { useSupabaseUser } from '../features/auth/authUtils'

export default function ConnectionsSidebar() {
  const user = useSupabaseUser()
  const [connections, setConnections] = React.useState<any[]>([])
  const [loadingConns, setLoadingConns] = React.useState(false)
  const [connSearch, setConnSearch] = React.useState('')
  const [connResults, setConnResults] = React.useState<any[]>([])
  const [connSearching, setConnSearching] = React.useState(false)

  const refreshConnections = React.useCallback(async () => {
    if (!user?.id) return
    setLoadingConns(true)
    try {
      const res = await fetch(`/api/connections?userId=${encodeURIComponent(user.id)}`)
      const json = await res.json()
      setConnections(Array.isArray(json.connections) ? json.connections : [])
    } catch {}
    finally { setLoadingConns(false) }
  }, [user?.id])

  React.useEffect(() => { refreshConnections() }, [refreshConnections])

  // Search
  React.useEffect(() => {
    const t = setTimeout(async () => {
      const q = connSearch.trim()
      if (!q || q.length < 2) { setConnResults([]); return }
      setConnSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        const list = Array.isArray(json.results) ? json.results : []
        setConnResults(list.filter((r: any) => r.id !== user?.id))
      } catch { setConnResults([]) }
      finally { setConnSearching(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [connSearch, user?.id])

  const makeConnection = async (toUserId: string) => {
    if (!user?.id || !toUserId) return
    try {
      await fetch('/api/connections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requesterId: user.id, addresseeId: toUserId }) })
      setConnSearch('')
      setConnResults([])
      refreshConnections()
    } catch {}
  }

  const updateConnection = async (id: string, action: 'accept'|'decline'|'block'|'unblock'|'cancel') => {
    try {
      await fetch(`/api/connections/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) })
      refreshConnections()
    } catch {}
  }

  const connected = connections.filter((c: any) => c.status === 'accepted')
  const incoming = connections.filter((c: any) => c.status === 'pending' && c.addressee_id === user?.id)
  const outgoing = connections.filter((c: any) => c.status === 'pending' && c.requester_id === user?.id)
  const nothingToShow = !loadingConns && connected.length === 0 && incoming.length === 0 && outgoing.length === 0

  return (
    <div className="flex flex-col mt-8 gap-4">
      <h2 className="text-2xl font-medium font-fredoka text-gray-900 dark:text-white">connections</h2>
      <div className="mb-3">
        <TextInput
          label="Add connection"
          placeholder="Search by username or email"
          value={connSearch}
          onChange={(e) => setConnSearch((e.target as HTMLInputElement).value)}
          fullWidth
        />
        {connSearching && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Searching…</div>}
        {!connSearching && connResults.length > 0 && (
          <div className="mt-2 border rounded-md border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            {connResults.map((r: any) => (
              <div key={r.id} className="p-2 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm text-gray-900 dark:text-white truncate">{r.username || r.email || r.id}</div>
                  {r.email && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.email}</div>}
                </div>
                <Button size="sm" onClick={() => makeConnection(r.id)}>Make connection</Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {loadingConns && <div className="p-2 text-xs text-gray-500 dark:text-gray-400">Loading…</div>}
      {nothingToShow && (
        <div className="p-2 text-xs text-gray-500 dark:text-gray-400">No connections yet! Search for or invite new users above.</div>
      )}

      {connected.length > 0 && (
        <div className="border rounded-md border-gray-200 dark:border-gray-700 mb-3">
          <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">Connected</div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {connected.map((c: any) => {
              const other = c.requester_id === user?.id ? c.addressee : c.requester
              const label = other?.username || other?.email || other?.id || (c.requester_id === user?.id ? c.addressee_id : c.requester_id)
              return (
                <div key={c.id} className="p-2 text-sm text-gray-900 dark:text-white truncate">{label}</div>
              )
            })}
          </div>
        </div>
      )}

      {incoming.length > 0 && (
        <div className="border rounded-md border-gray-200 dark:border-gray-700 mb-3">
          <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">Incoming requests</div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {incoming.map((c: any) => (
              <div key={c.id} className="p-2 flex items-center justify-between">
                <div className="text-sm text-gray-900 dark:text-white truncate">
                  {c?.requester?.username || c?.requester?.email || c.requester_id}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => updateConnection(c.id, 'accept')}>Accept</Button>
                  <Button size="sm" variant="secondary" onClick={() => updateConnection(c.id, 'decline')}>Decline</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {outgoing.length > 0 && (
        <div className="border rounded-md border-gray-200 dark:border-gray-700">
          <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">Sent requests</div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {outgoing.map((c: any) => (
              <div key={c.id} className="p-2 flex items-center justify-between">
                <div className="text-sm text-gray-900 dark:text-white truncate">{c?.addressee?.username || c?.addressee?.email || c.addressee_id}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => updateConnection(c.id, 'cancel')}>Cancel</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


