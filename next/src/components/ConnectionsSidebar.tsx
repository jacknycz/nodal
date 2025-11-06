"use client"
import React from 'react'
import TextInput from './ui/TextInput'
import Button from './ui/Button'
import { useSupabaseUser } from '../features/auth/authUtils'
import Avatar from './ui/Avatar'

interface Props {
  initialConnections?: any[]
  disableAutoFetch?: boolean
}

export default function ConnectionsSidebar({ initialConnections, disableAutoFetch = false }: Props) {
  const user = useSupabaseUser()
  const [connections, setConnections] = React.useState<any[]>([])
  const [loadingConns, setLoadingConns] = React.useState(false)
  const [connSearch, setConnSearch] = React.useState('')
  const [connResults, setConnResults] = React.useState<any[]>([])
  const [connSearching, setConnSearching] = React.useState(false)
  const prevConnectionsRef = React.useRef<string | null>(null)
  const hasLoadedOnceRef = React.useRef<boolean>(false)
  const requestCounterRef = React.useRef<number>(0)

  const refreshConnections = React.useCallback(async () => {
    if (!user?.id) return
    const myRequestId = ++requestCounterRef.current
    const shouldShowSkeleton = !hasLoadedOnceRef.current
    if (shouldShowSkeleton) setLoadingConns(true)
    const start = Date.now()
    try {
      const res = await fetch(`/api/connections?userId=${encodeURIComponent(user.id)}`)
      const json = await res.json()
      const incoming = Array.isArray(json.connections) ? json.connections : []
      // Avoid redundant state updates to prevent flicker
      try {
        const snapshot = JSON.stringify(incoming)
        if (prevConnectionsRef.current !== snapshot) {
          setConnections(incoming)
          prevConnectionsRef.current = snapshot
        }
      } catch {
        setConnections(incoming)
      }
    } catch { }
    finally {
      hasLoadedOnceRef.current = true
      if (shouldShowSkeleton) {
        const elapsed = Date.now() - start
        const MIN_SKELETON_MS = 350
        const remain = Math.max(0, MIN_SKELETON_MS - elapsed)
        setTimeout(() => {
          // Only clear loading if this is the latest request
          if (requestCounterRef.current === myRequestId) setLoadingConns(false)
        }, remain)
      }
    }
  }, [user?.id])

  // Seed with preloaded data (prevents initial flicker)
  React.useEffect(() => {
    if (Array.isArray(initialConnections)) {
      try {
        const snapshot = JSON.stringify(initialConnections)
        prevConnectionsRef.current = snapshot
      } catch {}
      setConnections(initialConnections)
      hasLoadedOnceRef.current = true
      setLoadingConns(false)
    }
  }, [initialConnections])

  React.useEffect(() => { if (!disableAutoFetch) refreshConnections() }, [refreshConnections, disableAutoFetch])

  // Set of user IDs already related to me by any connection (pending or accepted)
  const connectedIds = React.useMemo(() => {
    const me = user?.id
    const ids = new Set<string>()
    for (const c of connections) {
      if (!c) continue
      const otherId = c.requester_id === me ? c.addressee_id : c.requester_id
      if (otherId) ids.add(otherId)
    }
    return ids
  }, [connections, user?.id])

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
        const filtered = list
          .filter((r: any) => r.id !== user?.id)
          .filter((r: any) => !connectedIds.has(r.id))
        setConnResults(filtered)
      } catch { setConnResults([]) }
      finally { setConnSearching(false) }
    }, 250)
    return () => clearTimeout(t)
  }, [connSearch, user?.id, connectedIds])

  const makeConnection = async (toUserId: string) => {
    if (!user?.id || !toUserId) return
    try {
      await fetch('/api/connections', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requesterId: user.id, addresseeId: toUserId }) })
      setConnSearch('')
      setConnResults([])
      refreshConnections()
    } catch { }
  }

  const updateConnection = async (id: string, action: 'accept' | 'decline' | 'block' | 'unblock' | 'cancel') => {
    try {
      await fetch(`/api/connections/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) })
      refreshConnections()
    } catch { }
  }

  const connected = connections.filter((c: any) => c.status === 'accepted')
  const incoming = connections.filter((c: any) => c.status === 'pending' && c.addressee_id === user?.id)
  const outgoing = connections.filter((c: any) => c.status === 'pending' && c.requester_id === user?.id)
  const nothingToShow = !loadingConns && connected.length === 0 && incoming.length === 0 && outgoing.length === 0

  return (
    <div className="flex flex-col mt-8 gap-4">
      <h2 className="text-2xl font-medium font-fredoka text-gray-900 dark:text-white">connections</h2>
      

      {loadingConns && connections.length === 0 && (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={`conn-skel-${i}`} className="p-2 flex items-center gap-3 border border-gray-200 dark:border-gray-700 rounded-md animate-pulse bg-white/80 dark:bg-gray-900/60">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1 min-w-0">
                <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="h-2 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}
      {hasLoadedOnceRef.current && nothingToShow && (
        <div className="p-2 text-xs text-gray-500 dark:text-gray-400">No connections yet! Search for or invite new users above.</div>
      )}

      {connected.length > 0 && (
        <div className="border rounded-md border-gray-200 dark:border-gray-700 mb-3">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {connected.map((c: any) => {
              const other = c.requester_id === user?.id ? c.addressee : c.requester
              const label = other?.username || other?.email || other?.id || (c.requester_id === user?.id ? c.addressee_id : c.requester_id)
              return (
                <div key={c.id} className="p-2 flex items-center gap-2">
                  <Avatar src={other?.avatar_url || undefined} name={other?.username || null} email={other?.email || null} size="sm" />
                  <div className="flex flex-col">
                    <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{label}</div>
                    <div className="font-normal text-xs text-gray-500 dark:text-gray-400 truncate">{other?.email || other?.id}</div>
                  </div>
                </div>
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
    </div>
  )
}


