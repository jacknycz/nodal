'use client'

import React from 'react'
import NextImage from 'next/image'
import { useSupabaseUser } from '../features/auth/authUtils'
import { supabase, getSupabaseClient } from '../features/auth/supabaseClient'
import Button from './ui/Button'
import TextInput from './ui/TextInput'
import Modal from './ui/Modal'
import LinkUI from './ui/Link'
import Tag from './ui/Tag'
import Avatar from './ui/Avatar'
import { useStorageUsage } from '../features/storage/usage'
import { User } from '@phosphor-icons/react/dist/ssr'
import { useAIUsage } from '../features/ai/usage'
import Toast from './ui/Toast'
import { useUserRole } from '../features/auth/roles'

function useDebounced<T>(value: T, delay = 400) {
  const [debounced, setDebounced] = React.useState(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function ProfileTab() {
  const user = useSupabaseUser()
  const client = getSupabaseClient()
  const storage = useStorageUsage()
  const ai = useAIUsage()
  const { role } = useUserRole()
  const isProLike = React.useMemo(() => {
    const cap = ai.summary?.cap
    const capImpliesPro = typeof cap === 'number' && (cap === Number.MAX_SAFE_INTEGER || cap === 100000)
    return role === 'Pro' || role === 'Admin' || capImpliesPro
  }, [role, ai.summary?.cap])
  const [showUpgradeModal, setShowUpgradeModal] = React.useState(false)
  const [redirecting, setRedirecting] = React.useState(false)
  const [billingToast, setBillingToast] = React.useState<{ open: boolean; msg: string; variant?: 'success' | 'info' | 'warning' | 'danger' }>({ open: false, msg: '' })
  const [loading, setLoading] = React.useState(true)
  const [profile, setProfile] = React.useState<{ username: string | null; avatar_url: string | null; display_name: string | null } | null>(null)
  // Notifications
  const [notifications, setNotifications] = React.useState<any[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)
  const [loadingNotifs, setLoadingNotifs] = React.useState(false)
  const [showReadExpanded, setShowReadExpanded] = React.useState(false)
  // Connections
  const [connections, setConnections] = React.useState<any[]>([])
  const [loadingConns, setLoadingConns] = React.useState(false)
  const [connSearch, setConnSearch] = React.useState('')
  const debouncedConnSearch = useDebounced(connSearch, 300)
  const [connResults, setConnResults] = React.useState<any[]>([])
  const [connSearching, setConnSearching] = React.useState(false)
  const [showUsernameModal, setShowUsernameModal] = React.useState(false)
  const [usernameInput, setUsernameInput] = React.useState('')
  const debouncedUsername = useDebounced(usernameInput, 300)
  const [checking, setChecking] = React.useState(false)
  const [available, setAvailable] = React.useState<boolean | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [cooldownUntil, setCooldownUntil] = React.useState<string | null>(null)
  const [resetMsg, setResetMsg] = React.useState<string | null>(null)
  const [showAvatarModal, setShowAvatarModal] = React.useState(false)
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null)
  const avatarBlobRef = React.useRef<Blob | null>(null)
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [imgSize, setImgSize] = React.useState<{ w: number; h: number } | null>(null)
  const [scale, setScale] = React.useState<number>(1)
  const [minScale, setMinScale] = React.useState<number>(1)
  const [tx, setTx] = React.useState<number>(0)
  const [ty, setTy] = React.useState<number>(0)
  const [isAvatarDragOver, setIsAvatarDragOver] = React.useState(false)
  const panRef = React.useRef<{ active: boolean; sx: number; sy: number; startTx: number; startTy: number }>({ active: false, sx: 0, sy: 0, startTx: 0, startTy: 0 })
  const cropSize = 256

  // Cooldown state computed from profile row (username_changed_at) if available
  const [isUsernameOnCooldown, setIsUsernameOnCooldown] = React.useState(false)

  React.useEffect(() => {
    const run = async () => {
      if (!user?.id) { setLoading(false); return }
      try {
        let selError: any = null
        let data: any = null
        try {
          const res = await supabase
            .from('profiles')
            .select('username, avatar_url, display_name, username_changed_at')
            .eq('id', user.id)
            .maybeSingle()
          if (res.error) throw res.error
          data = res.data
        } catch (err: any) {
          selError = err
          const msg: string = err?.message || ''
          const code: string | number | undefined = (err && (err.code ?? err.details))
          // Retry without the optional column if schema not updated yet
          if (msg.includes('username_changed_at') || String(code) === '42703' || err?.status === 400) {
            const res2 = await supabase
              .from('profiles')
              .select('username, avatar_url, display_name')
              .eq('id', user.id)
              .maybeSingle()
            if (res2.error) throw res2.error
            data = res2.data
          } else {
            throw err
          }
        }
        const prof = (data as { username: string | null; avatar_url: string | null; display_name: string | null, username_changed_at?: string | null } | null)
        setProfile(prof || { username: null, avatar_url: null, display_name: null })
        // Compute cooldown if applicable
        const changedAt = (prof as any)?.username_changed_at as string | null
        if (changedAt) {
          const last = new Date(changedAt)
          const now = new Date()
          const days = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)
          setIsUsernameOnCooldown(days < 30)
        } else {
          setIsUsernameOnCooldown(false)
        }
      } catch {
        setProfile({ username: null, avatar_url: null, display_name: null })
        setIsUsernameOnCooldown(false)
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [user?.id])

  // Load notifications
  const refreshNotifications = React.useCallback(async () => {
    if (!user?.id) return
    setLoadingNotifs(true)
    try {
      const res = await fetch(`/api/notifications?userId=${encodeURIComponent(user.id)}&limit=50`)
      const json = await res.json()
      const list = Array.isArray(json.notifications) ? json.notifications : []
      setNotifications(list)
      setUnreadCount(list.filter((n: any) => !n.read_at).length)
    } catch { }
    finally { setLoadingNotifs(false) }
  }, [user?.id])

  React.useEffect(() => { refreshNotifications() }, [refreshNotifications])

  // Realtime notifications
  React.useEffect(() => {
    if (!user?.id) return
    const ch = client
      .channel('notif-' + user.id)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => refreshNotifications())
      .subscribe()
    return () => { client.removeChannel(ch) }
  }, [user?.id, refreshNotifications, client])

  const markAllRead = async () => {
    if (!user?.id) return
    try { await fetch('/api/notifications', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: user.id, markAll: true }) }) } catch { }
    refreshNotifications()
    try { window.dispatchEvent(new CustomEvent('nodal:notifications-updated', { detail: { reset: true } })) } catch { }
  }

  const markOneRead = async (id: string) => {
    if (!user?.id) return
    // Optimistic UI
    setNotifications((prev) => prev.map((n: any) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    setUnreadCount((c) => Math.max(0, c - 1))
    try { window.dispatchEvent(new CustomEvent('nodal:notifications-updated', { detail: { delta: -1 } })) } catch { }
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: user.id, ids: [id] })
      })
    } catch { }
    refreshNotifications()
  }

  // Load connections
  const refreshConnections = React.useCallback(async () => {
    if (!user?.id) return
    setLoadingConns(true)
    try {
      const res = await fetch(`/api/connections?userId=${encodeURIComponent(user.id)}`)
      const json = await res.json()
      setConnections(Array.isArray(json.connections) ? json.connections : [])
    } catch { }
    finally { setLoadingConns(false) }
  }, [user?.id])

  React.useEffect(() => { refreshConnections() }, [refreshConnections])

  // Realtime connections
  React.useEffect(() => {
    if (!user?.id) return
    const ch1 = client
      .channel('conn-req-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections', filter: `requester_id=eq.${user.id}` }, () => refreshConnections())
      .subscribe()
    const ch2 = client
      .channel('conn-add-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections', filter: `addressee_id=eq.${user.id}` }, () => refreshConnections())
      .subscribe()
    return () => { client.removeChannel(ch1); client.removeChannel(ch2) }
  }, [user?.id, refreshConnections, client])

  // Connection search
  React.useEffect(() => {
    const run = async () => {
      const q = debouncedConnSearch.trim()
      if (!q || q.length < 2) { setConnResults([]); return }
      setConnSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        const results = Array.isArray(json.results) ? json.results : []
        setConnResults(results.filter((r: any) => r.id !== user?.id))
      } catch { setConnResults([]) }
      finally { setConnSearching(false) }
    }
    run()
  }, [debouncedConnSearch, user?.id])

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

  React.useEffect(() => {
    const check = async () => {
      const u = debouncedUsername.trim().toLowerCase()
      if (!u || u === (profile?.username || '')) { setAvailable(null); return }
      if (!/^[a-z0-9_\.]{3,24}$/.test(u)) { setAvailable(false); return }
      setChecking(true)
      try {
        const res = await fetch(`/api/profile/username?username=${encodeURIComponent(u)}`)
        const json = await res.json()
        setAvailable(!!json.available)
      } catch {
        setAvailable(null)
      } finally {
        setChecking(false)
      }
    }
    check()
  }, [debouncedUsername, profile?.username])

  const onSaveUsername = async () => {
    if (!user?.id) return
    const u = usernameInput.trim().toLowerCase()
    if (!/^[a-z0-9_\.]{3,24}$/.test(u)) { setSaveError('Invalid username'); return }
    setSaving(true); setSaveError(null)
    try {
      const res = await fetch('/api/profile/username', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ userId: user.id, username: u }) })
      if (res.status === 409) { setSaveError('Username is taken'); return }
      if (res.status === 429) {
        const json429 = await res.json()
        const retryAt = json429?.retryAt
        setCooldownUntil(retryAt || null)
        setSaveError('You changed your username in the last 30 days')
        return
      }
      const json = await res.json()
      if (!res.ok || !json?.ok) { setSaveError(json?.error || 'Failed to save'); return }
      setProfile((p) => ({ ...(p || { username: null, avatar_url: null, display_name: null }), username: u }))
      setShowUsernameModal(false)
    } catch (e: any) {
      setSaveError(e?.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const onResetPassword = async () => {
    if (!user?.email) return
    setResetMsg(null)
    try {
      const client = getSupabaseClient()
      const { error } = await client.auth.resetPasswordForEmail(user.email, { redirectTo: `${window.location.origin}/auth/callback` })
      if (error) throw error
      setResetMsg('Password reset email sent.')
    } catch (e: any) {
      setResetMsg(e?.message || 'Failed to send reset email')
    }
  }

  if (loading) return <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Loading profile…</div>

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-12 py-10">
      {/* Profile Card */}
      <div className="flex flex-row items-start gap-6 md:gap-12">
        {/* Avatar */}
        <div className="relative flex flex-col items-center">
          <Avatar src={profile?.avatar_url} name={profile?.display_name || profile?.username || null} email={user?.email || null} size="xl" ring border className="shadow-md" />

          <div className="mt-2 flex items-center gap-2">
            <LinkUI onClick={() => { setAvatarPreview(null); avatarBlobRef.current = null; setShowAvatarModal(true) }}>Edit avatar</LinkUI>
          </div>
        </div>

        {/* Main info */}
        <div className="flex-1 w-full">
          <div className="flex items-center gap-3 w-full">
            <div className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white truncate">
              {profile?.username || 'NA'}
            </div>
            {profile?.username ? (
              <LinkUI
                onClick={() => { if (!isUsernameOnCooldown) { setUsernameInput(profile?.username || ''); setShowUsernameModal(true) } }}
              >
                {isUsernameOnCooldown ? (
                  <span title="You changed your username in the last 30 days" className="pointer-events-none opacity-50">Edit</span>
                ) : (
                  'Edit'
                )}
              </LinkUI>
            ) : (
              <Button size="sm" onClick={() => { setUsernameInput(''); setShowUsernameModal(true) }}>Add Username</Button>
            )}

            {/* Role tag (stabilized) */}
            <div>
              <Tag variant="secondary" className="ml-1">{role}</Tag>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Email */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/50 p-4">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</div>
              <div className="mt-1 text-sm md:text-base text-gray-900 dark:text-gray-100 break-words">{user?.email || '—'}</div>
            </div>
            {/* Password */}
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/50 p-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Password</div>
                <div className="mt-1 text-sm md:text-base text-gray-900 dark:text-gray-100">••••••••</div>
              </div>
              <Button onClick={onResetPassword}>Change</Button>
            </div>
            {/* Storage */}
            {(() => {
              const toMB = (n: number) => Math.round(n / (1024 * 1024))
              const isAdminPlan = storage.plan === 'admin'
              const label = isAdminPlan ? 'Unlimited' : `${toMB(storage.usedBytes)} MB / ${toMB(storage.totalBytes)} MB`
              return (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Storage</div>
                    <div className="text-xs text-gray-700 dark:text-gray-300">{label}</div>
                  </div>
                  {!isAdminPlan && (
                    <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                      <div className="h-full bg-primary-500 transition-all" style={{ width: `${storage.percentUsed}%` }} />
                    </div>
                  )}
                </div>
              )
            })()}
            {/* AI Tokens */}
            {(() => {
              const s = ai.summary
              const isUnlimited = (s?.cap ?? 0) === Number.MAX_SAFE_INTEGER
              const pct = s ? (isUnlimited ? 0 : Math.min(100, Math.round((s.total / Math.max(1, s.cap)) * 100))) : 0
              const fmt = (n: number) => n.toLocaleString()
              const label = !s ? '—' : isUnlimited ? 'Unlimited' : `${fmt(s.total)} / ${fmt(s.cap)}`
              const barColor = ai.exceeded ? 'bg-red-500' : (ai.warn80 ? 'bg-orange-500' : 'bg-primary-500')
              return (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">AI Tokens (month)</div>
                    <div className={`text-xs ${ai.exceeded ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}`}>{label}</div>
                  </div>
                  {!isUnlimited && (
                    <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                      <div className={`h-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {ai.warn80 && !ai.exceeded && (
                    <div className="mt-2 text-[11px] text-orange-600 dark:text-orange-400">You have used 80% of your monthly token cap.</div>
                  )}
                  {ai.exceeded && (
                    <div className="mt-2 text-[11px] text-red-600 dark:text-red-400">Monthly AI token limit reached. Visit Profile to upgrade or buy packs.</div>
                  )}
                </div>
              )
            })()}
            
            {/* Upgrade / Manage Billing */}
            <div className="col-span-full">
              {!isProLike ? (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/50 p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Need more?</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">Go Pro to unlock 5GB storage and 100k AI tokens/month.</div>
                  </div>
                  <Button onClick={() => setShowUpgradeModal(true)}>Go Pro</Button>
                </div>
              ) : (
                <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/60 dark:bg-gray-900/50 p-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">Manage billing</div>
                    <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">Update payment details or cancel your subscription.</div>
                  </div>
                  <Button variant="secondary" onClick={async () => {
                    try {
                      const { data } = await getSupabaseClient().auth.getSession()
                      const token = data?.session?.access_token
                      const res = await fetch('/api/billing/portal', { method: 'POST', headers: token ? { 'Authorization': `Bearer ${token}` } : {} })
                      const json = await res.json()
                      if (!res.ok || !json?.url) throw new Error(json?.error || 'Failed to open billing')
                      window.location.assign(json.url)
                    } catch (e: any) {
                      setBillingToast({ open: true, msg: e?.message || 'Failed to open billing', variant: 'danger' })
                    }
                  }}>Manage</Button>
                </div>
              )}
            </div>
          </div>
          {resetMsg && <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">{resetMsg}</div>}
        </div>
      </div>

      {/* Notifications */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</div>
          <div className="flex items-center gap-3">
            {unreadCount > 0 && <span className="text-xs text-gray-500 dark:text-gray-400">{unreadCount} unread</span>}
            <Button variant="secondary" onClick={markAllRead} disabled={unreadCount === 0}>Mark all read</Button>
          </div>
        </div>
        {
          // Partition notifications: unread first; then up to 5 total with read fillers; rest read collapsible
        }
        <div className="border rounded-md border-gray-200 dark:border-gray-700">
          {loadingNotifs ? (
            <div className="p-3 text-xs text-gray-500 dark:text-gray-400">Loading…</div>
          ) : notifications.length === 0 ? (
            <div className="p-3 text-xs text-gray-500 dark:text-gray-400">No notifications yet.</div>
          ) : (
            (() => {
              const unread = notifications.filter((n: any) => !n.read_at)
              const read = notifications.filter((n: any) => !!n.read_at)
              const primary = unread.concat(read.slice(0, Math.max(0, 5 - unread.length)))
              const remainingRead = read.slice(Math.max(0, 5 - unread.length))
              const Item = ({ n }: { n: any }) => {
                let title = n.title as string
                let bodyNode: React.ReactNode = n.body as string
                const p = (n.payload || {}) as any
                if (n.type === 'board_invite') {
                  const inviter = p?.inviterLabel || ''
                  const boardName = p?.boardName || ''
                  const link = p?.link || (p?.boardId ? `${typeof window !== 'undefined' ? window.location.origin : ''}/board/${p.boardId}` : null)
                  title = inviter ? `New board shared with you by ${inviter}` : 'New board shared with you'
                  bodyNode = (
                    <span>
                      You have been invited to {link && boardName ? (
                        <a href={link} className="text-primary-600 dark:text-primary-400 underline">"{boardName}"</a>
                      ) : (
                        boardName ? `"${boardName}"` : 'a board'
                      )}
                    </span>
                  )
                }
                return (
                  <div key={n.id} className="p-3 flex items-start gap-3 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                    <div className={`w-2 h-2 mt-1 rounded-full ${n.read_at ? 'bg-transparent border border-gray-300 dark:border-gray-600' : 'bg-blue-500'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm text-gray-900 dark:text-white truncate">{title}</div>
                          {bodyNode && <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{bodyNode}</div>}
                        </div>
                        <div className="flex-shrink-0">
                          {!n.read_at && (
                            <button
                              onClick={() => markOneRead(n.id)}
                              className="text-[10px] px-2 py-0.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                            >
                              Mark as read
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  </div>
                )
              }
              return (
                <div>
                  {primary.map((n: any) => <Item key={n.id} n={n} />)}
                  {remainingRead.length > 0 && (
                    <>
                      <button
                        onClick={() => setShowReadExpanded(v => !v)}
                        className="w-full text-xs text-gray-600 dark:text-gray-300 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 border-t border-gray-200 dark:border-gray-700"
                      >
                        {showReadExpanded ? 'Hide' : 'Show'} {remainingRead.length} read notification{remainingRead.length === 1 ? '' : 's'}
                      </button>
                      <div className={`overflow-hidden transition-all duration-200 ${showReadExpanded ? 'max-h-[1000px]' : 'max-h-0'}`}>
                        {showReadExpanded && remainingRead.map((n: any) => <Item key={n.id} n={n} />)}
                      </div>
                    </>
                  )}
                </div>
              )
            })()
          )}
        </div>
      </div>

      {/* Connections */}
      <div className="mt-8">
        <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Connections</div>
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Accepted */}
          <div className="border rounded-md border-gray-200 dark:border-gray-700">
            <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">Connected</div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {loadingConns ? <div className="p-2 text-xs text-gray-500 dark:text-gray-400">Loading…</div> :
                connections.filter((c: any) => c.status === 'accepted').map((c: any) => {
                  const other = c.requester_id === user?.id ? c.addressee : c.requester
                  const label = other?.username || other?.email || other?.id || (c.requester_id === user?.id ? c.addressee_id : c.requester_id)
                  return (
                    <div key={c.id} className="p-2 text-sm text-gray-900 dark:text-white truncate">{label}</div>
                  )
                })}
            </div>
          </div>
          {/* Incoming */}
          <div className="border rounded-md border-gray-200 dark:border-gray-700">
            <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">Incoming requests</div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {loadingConns ? <div className="p-2 text-xs text-gray-500 dark:text-gray-400">Loading…</div> :
                connections.filter((c: any) => c.status === 'pending' && c.addressee_id === user?.id).map((c: any) => (
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
          {/* Outgoing */}
          <div className="border rounded-md border-gray-200 dark:border-gray-700">
            <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">Sent requests</div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {loadingConns ? <div className="p-2 text-xs text-gray-500 dark:text-gray-400">Loading…</div> :
                connections.filter((c: any) => c.status === 'pending' && c.requester_id === user?.id).map((c: any) => (
                  <div key={c.id} className="p-2 flex items-center justify-between">
                    <div className="text-sm text-gray-900 dark:text-white truncate">{c?.addressee?.username || c?.addressee?.email || c.addressee_id}</div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => updateConnection(c.id, 'cancel')}>Cancel</Button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={showUsernameModal}
        onClose={() => setShowUsernameModal(false)}
        title={profile?.username ? 'Edit Username' : 'Add Username'}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowUsernameModal(false)}>Cancel</Button>
            <Button
              onClick={onSaveUsername}
              loading={saving}
              disabled={
                saving ||
                available === false ||
                !/^[a-z0-9_\.]{3,24}$/.test(usernameInput.trim().toLowerCase())
              }
            >
              Save
            </Button>
          </>
        }
      >
        {profile?.username && (
          <div className="mb-3 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 px-3 py-2 text-xs leading-snug">
            <strong className="font-semibold">Heads up:</strong> after your username is set, you can change it only once every 30 days.
          </div>
        )}
        <TextInput
          label="Username"
          value={usernameInput}
          onChange={(e) => setUsernameInput((e.target as HTMLInputElement).value)}
          placeholder="yourname"
          description="3–24 chars; letters, digits, underscore and dot"
          leftIcon={<User size={16} className="w-4 h-4" />}
          fullWidth
        />
        <div className="mt-1 text-xs">
          {checking ? (
            <span className="text-gray-500 dark:text-gray-400">Checking availability…</span>
          ) : available === true ? (
            <span className="text-emerald-600 dark:text-emerald-400">Available</span>
          ) : available === false ? (
            <span className="text-red-600 dark:text-red-400">Taken or invalid</span>
          ) : null}
        </div>
        {saveError && (
          <div className="mt-2 text-xs text-red-600 dark:text-red-400">
            {saveError}
            {cooldownUntil && (
              <>
                {' '}(try again {new Date(cooldownUntil).toLocaleDateString()} {new Date(cooldownUntil).toLocaleTimeString()})
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        title="Edit Avatar"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowAvatarModal(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!user?.id || !imageUrl || !imgSize) return
                setSaving(true)
                setSaveError(null)
                try {
                  // Render current crop to 256x256 PNG blob
                  const canvas = document.createElement('canvas')
                  canvas.width = cropSize
                  canvas.height = cropSize
                  const ctx = canvas.getContext('2d')!
                  const img = new Image()
                  await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve()
                    img.onerror = reject
                    img.src = imageUrl
                  })
                  const drawW = img.width * scale
                  const drawH = img.height * scale
                  const dx = (cropSize - drawW) / 2 + tx
                  const dy = (cropSize - drawH) / 2 + ty
                  ctx.imageSmoothingQuality = 'high'
                  ctx.clearRect(0, 0, cropSize, cropSize)
                  ctx.drawImage(img, dx, dy, drawW, drawH)
                  const blob: Blob = await new Promise((resolve) => canvas.toBlob((b) => resolve(b as Blob), 'image/png', 0.92) as any)
                  avatarBlobRef.current = blob
                  // Upload into the 'avatars' bucket at path '{userId}.png'
                  const path = `${user.id}.png`
                  const { error: upErr } = await getSupabaseClient().storage.from('avatars').upload(path, avatarBlobRef.current, { upsert: true, contentType: 'image/png' })
                  if (upErr) throw upErr
                  const { data: pub } = getSupabaseClient().storage.from('avatars').getPublicUrl(path)
                  const url = pub?.publicUrl || null
                  if (url) {
                    // Ensure a row exists; username may be required by schema, so derive a fallback if needed
                    const deriveBaseUsername = () => {
                      const baseRaw = (profile?.username || (user.email ? user.email.split('@')[0] : `user_${String(user.id).slice(0, 6)}`) || 'user')
                      const sanitized = baseRaw.toLowerCase().replace(/[^a-z0-9_.]/g, '_')
                      return (sanitized.length ? sanitized.slice(0, 24) : 'user')
                    }
                    let attempt = 0
                    let lastErr: any = null
                    while (attempt < 3) {
                      try {
                        const candidate = attempt === 0 ? deriveBaseUsername() : `${deriveBaseUsername()}_${Math.floor(Math.random() * 1000)}`.slice(0, 24)
                        const { data: upData, error: upErr } = await (supabase as any)
                          .from('profiles')
                          .upsert({ id: user.id, username: candidate, avatar_url: url } as any, { onConflict: 'id' } as any)
                          .select('username')
                          .maybeSingle()
                        if (upErr) throw upErr
                        // Success
                        const finalUsername = String((upData as any)?.username || candidate)
                        setProfile((p) => ({ ...(p || { username: finalUsername, avatar_url: null, display_name: null }), avatar_url: url, username: finalUsername }))
                        break
                      } catch (err: any) {
                        lastErr = err
                        // Unique violation on username (23505): retry with different suffix
                        if (String(err?.code) === '23505') {
                          attempt += 1
                          continue
                        }
                        throw err
                      }
                    }
                    if (attempt >= 3 && lastErr) {
                      throw lastErr
                    }
                  }
                  setShowAvatarModal(false)
                } catch (e: any) {
                  setSaveError(e?.message || 'Failed to upload avatar')
                } finally {
                  setSaving(false)
                }
              }}
              disabled={!imageUrl || !imgSize}
              loading={saving}
            >Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div
            className={`border-2 border-dashed rounded-md p-6 text-center ${isAvatarDragOver ? 'border-primary-500 bg-primary-50/40 dark:bg-primary-900/10' : 'border-gray-300 dark:border-gray-700'}`}
            onDragOver={(e) => { e.preventDefault(); setIsAvatarDragOver(true) }}
            onDragLeave={() => setIsAvatarDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault(); setIsAvatarDragOver(false)
              const f = e.dataTransfer.files && e.dataTransfer.files[0]
              if (!f) return
              if (!f.type.startsWith('image/')) { setSaveError('Please upload an image.'); return }
              try {
                const url = URL.createObjectURL(f)
                const img = new Image()
                await new Promise<void>((resolve, reject) => {
                  img.onload = () => resolve()
                  img.onerror = reject
                  img.src = url
                })
                setImageUrl(url)
                setImgSize({ w: img.width, h: img.height })
                const coverScale = Math.max(cropSize / img.width, cropSize / img.height)
                setMinScale(coverScale)
                setScale(coverScale)
                setTx(0); setTy(0)
                setAvatarPreview(null)
              } catch {
                setSaveError('Failed to process image')
              }
            }}
          >
            <div className="text-sm text-gray-700 dark:text-gray-200">Drag & drop an image here</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">or</div>
            <div className="mt-3">
              <label className="inline-block px-3 py-1.5 rounded-md border bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-800 dark:text-gray-100 cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (!file) return
                    if (!file.type.startsWith('image/')) { setSaveError('Please upload an image.'); (e.target as HTMLInputElement).value = ''; return }
                    try {
                      const url = URL.createObjectURL(file)
                      const img = new Image()
                      await new Promise<void>((resolve, reject) => {
                        img.onload = () => resolve()
                        img.onerror = reject
                        img.src = url
                      })
                      setImageUrl(url)
                      setImgSize({ w: img.width, h: img.height })
                      const fitScale = Math.min(cropSize / img.width, cropSize / img.height)
                      setScale(fitScale)
                      setTx(0); setTy(0)
                      setAvatarPreview(null)
                    } catch {
                      setSaveError('Failed to process image')
                    }
                  }}
                />
                <span className="text-sm">Choose image</span>
              </label>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Crop (drag to pan, scroll to zoom)</div>
            <div
              className="relative border border-gray-200 dark:border-gray-700 rounded-md"
              onMouseDown={(e) => {
                if (!imageUrl) return
                panRef.current = { active: true, sx: e.clientX, sy: e.clientY, startTx: tx, startTy: ty }
              }}
              onMouseMove={(e) => {
                if (!panRef.current.active) return
                const dx = e.clientX - panRef.current.sx
                const dy = e.clientY - panRef.current.sy
                // Tentative new translation
                let nTx = panRef.current.startTx + dx
                let nTy = panRef.current.startTy + dy
                // Constrain so image covers square
                if (imgSize) {
                  const drawW = imgSize.w * scale
                  const drawH = imgSize.h * scale
                  const halfGapX = Math.max(0, (drawW - cropSize) / 2)
                  const halfGapY = Math.max(0, (drawH - cropSize) / 2)
                  const minTx = -halfGapX
                  const maxTx = halfGapX
                  const minTy = -halfGapY
                  const maxTy = halfGapY
                  nTx = Math.max(minTx, Math.min(maxTx, nTx))
                  nTy = Math.max(minTy, Math.min(maxTy, nTy))
                }
                setTx(nTx)
                setTy(nTy)
              }}
              onMouseUp={() => { panRef.current.active = false }}
              onMouseLeave={() => { panRef.current.active = false }}
              onWheel={(e) => {
                if (!imgSize) return
                const delta = -Math.sign(e.deltaY) * 0.05
                const nextScale = Math.max(minScale, Math.min(5, scale + delta))
                setScale(nextScale)
                // After scale change, also clamp tx/ty
                const drawW = imgSize.w * nextScale
                const drawH = imgSize.h * nextScale
                const halfGapX = Math.max(0, (drawW - cropSize) / 2)
                const halfGapY = Math.max(0, (drawH - cropSize) / 2)
                const minTx = -halfGapX
                const maxTx = halfGapX
                const minTy = -halfGapY
                const maxTy = halfGapY
                setTx((cur) => Math.max(minTx, Math.min(maxTx, cur)))
                setTy((cur) => Math.max(minTy, Math.min(maxTy, cur)))
              }}
              style={{ width: cropSize, height: cropSize, overflow: 'hidden', background: '#111', overscrollBehavior: 'contain' }}
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="to crop"
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    width: imgSize ? imgSize.w : 'auto',
                    height: imgSize ? imgSize.h : 'auto',
                    transform: `translate(${(cropSize - (imgSize ? imgSize.w * scale : 0)) / 2 + tx}px, ${(cropSize - (imgSize ? imgSize.h * scale : 0)) / 2 + ty}px) scale(${scale})`,
                    transformOrigin: 'top left',
                    userSelect: 'none',
                    pointerEvents: 'none'
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">Select an image…</div>
              )}
              {/* Square mask indicator */}
              <div className="pointer-events-none absolute inset-0 ring-1 ring-white/30" />
            </div>
            <div className="mt-2 flex items-center gap-3">
              <input
                type="range"
                min={minScale}
                max={5}
                step={0.01}
                value={scale}
                onChange={(e) => {
                  const next = parseFloat((e.target as HTMLInputElement).value)
                  setScale(next)
                  if (imgSize) {
                    const drawW = imgSize.w * next
                    const drawH = imgSize.h * next
                    const halfGapX = Math.max(0, (drawW - cropSize) / 2)
                    const halfGapY = Math.max(0, (drawH - cropSize) / 2)
                    const minTx = -halfGapX
                    const maxTx = halfGapX
                    const minTy = -halfGapY
                    const maxTy = halfGapY
                    setTx((cur) => Math.max(minTx, Math.min(maxTx, cur)))
                    setTy((cur) => Math.max(minTy, Math.min(maxTy, cur)))
                  }
                }}
                className="w-48"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  if (!imgSize) return
                  const coverScale = Math.max(cropSize / imgSize.w, cropSize / imgSize.h)
                  setMinScale(coverScale)
                  setScale(coverScale)
                  setTx(0)
                  setTy(0)
                }}
              >Reset</Button>
            </div>
          </div>
          {saveError && <div className="text-xs text-red-600 dark:text-red-400">{saveError}</div>}
          <div className="text-xs text-gray-500 dark:text-gray-400">Max saved size 256×256. Larger uploads are center-cropped and resized.</div>
        </div>
      </Modal>

      {/* Upgrade Modal */}
      <Modal
        open={showUpgradeModal}
        onClose={() => { if (!redirecting) setShowUpgradeModal(false) }}
        title="Upgrade to Nodal Pro"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowUpgradeModal(false)} disabled={redirecting}>Cancel</Button>
            <Button onClick={async () => {
              setRedirecting(true)
              try {
                const { data } = await getSupabaseClient().auth.getSession()
                const token = data?.session?.access_token
                const res = await fetch('/api/billing/checkout', { method: 'POST', headers: token ? { 'Authorization': `Bearer ${token}` } : {} })
                const json = await res.json()
                if (!res.ok || !json?.url) throw new Error(json?.error || 'Failed to start checkout')
                window.location.assign(json.url)
              } catch (e: any) {
                setBillingToast({ open: true, msg: e?.message || 'Checkout failed', variant: 'danger' })
                setRedirecting(false)
              }
            }} loading={redirecting}>
              Continue to Checkout
            </Button>
          </>
        }
      >
        <div className="space-y-2">
          <div className="text-sm text-gray-700 dark:text-gray-200">Nodal Pro (monthly) includes:</div>
          <ul className="text-sm text-gray-700 dark:text-gray-200 list-disc pl-5">
            <li>5GB total storage</li>
            <li>100k AI tokens per month</li>
            <li>Priority token processing</li>
          </ul>
          <div className="text-xs text-gray-500 dark:text-gray-400">You’ll be redirected to Stripe Checkout to complete your purchase.</div>
        </div>
      </Modal>

      <Toast open={billingToast.open} onClose={() => setBillingToast({ open: false, msg: '' })} variant={billingToast.variant || 'info'}>
        {billingToast.msg}
      </Toast>
    </div>
  )
}


