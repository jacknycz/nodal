import { useEffect, useMemo, useState, useCallback } from 'react'

// Minimal types to avoid hard-coupling to supabase client generics
type SupabaseClientLike = {
  from: (table: string) => any
  channel: (name: string) => any
  removeChannel: (channel: any) => void
}

interface UseBoardRealtimeParams {
  boardId?: string
  userId?: string | null
  supabase: SupabaseClientLike
  // Called when a remote content update arrives
  applyRemoteNodeContent: (nodeId: string, data: Record<string, any>) => void
  disabled?: boolean
}

export function useBoardRealtime({ boardId, userId, supabase, applyRemoteNodeContent, disabled = false }: UseBoardRealtimeParams) {
  const [remoteCursors, setRemoteCursors] = useState<any[]>([])
  const [nodeLocks, setNodeLocks] = useState<any[]>([])

  // Subscribe to remote cursors
  useEffect(() => {
    if (disabled) return
    if (!boardId) return

    let cancelled = false

    const fetchInitial = async () => {
      try {
        const { data } = await supabase
          .from('board_cursors')
          .select('*')
          .eq('board_id', boardId)
        if (!cancelled) setRemoteCursors(data || [])
      } catch {
        if (!cancelled) setRemoteCursors([])
      }
    }

    const upsertCursor = (list: any[], row: any) => {
      const id = row?.id
      if (!id) return list
      const idx = list.findIndex((c) => c?.id === id)
      if (idx === -1) return [...list, row]
      const next = list.slice()
      next[idx] = row
      return next
    }

    const removeCursor = (list: any[], row: any) => {
      const id = row?.id
      if (!id) return list
      return list.filter((c) => c?.id !== id)
    }

    const channel = supabase
      .channel('board-cursors-' + boardId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_cursors', filter: `board_id=eq.${boardId}` },
        (payload: any) => {
          const ev = payload?.eventType || payload?.event
          const row = payload?.new || payload?.old
          if (!row) return
          setRemoteCursors((prev) => {
            if (ev === 'DELETE') return removeCursor(prev, row)
            return upsertCursor(prev, row)
          })
        }
      )
      .subscribe()

    fetchInitial()
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [boardId, supabase])

  // Subscribe to node locks (disabled when only one user is present on the board).
  // IMPORTANT: derive active users from in-memory cursor state to avoid re-querying board_cursors on every cursor event.
  useEffect(() => {
    if (disabled) return
    if (!boardId) return

    let locksChannel: any = null

    const activeUsers = Array.from(
      new Set((remoteCursors || []).map((c: any) => c?.user_id).filter(Boolean))
    )
    const locksDisabled = activeUsers.length <= 1

    const fetchLocks = async () => {
      try {
        const { data } = await supabase
          .from('node_locks')
          .select('*')
          .eq('board_id', boardId)
          .gt('expires_at', new Date().toISOString())
        setNodeLocks(data || [])
      } catch {
        setNodeLocks([])
      }
    }

    if (locksDisabled) {
      setNodeLocks([])
      return () => { if (locksChannel) supabase.removeChannel(locksChannel) }
    }

    locksChannel = supabase
      .channel('node-locks-' + boardId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'node_locks', filter: `board_id=eq.${boardId}` },
        () => fetchLocks()
      )
      .subscribe()

    fetchLocks()
    return () => {
      if (locksChannel) supabase.removeChannel(locksChannel)
    }
  }, [boardId, supabase, remoteCursors, disabled])

  // Subscribe to board updates for real-time content sync
  useEffect(() => {
    if (disabled) return
    if (!boardId) return

    const applyRemoteUpdate = (payload: any) => {
      const { node_id, update_type, data, user_id } = payload.new || {}
      if (userId && user_id === userId) return
      if (update_type === 'content' && node_id && data) {
        applyRemoteNodeContent(node_id, data)
      }
    }

    const channel = supabase
      .channel('board-updates-' + boardId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'board_updates', filter: `board_id=eq.${boardId}` },
        applyRemoteUpdate
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [boardId, userId, supabase, applyRemoteNodeContent, disabled])

  // Lock helpers
  const isNodeLocked = useCallback((nodeId: string) => {
    return nodeLocks.some(lock => lock.node_id === nodeId)
  }, [nodeLocks])

  const getNodeLockOwner = useCallback((nodeId: string) => {
    const lock = nodeLocks.find(lock => lock.node_id === nodeId)
    return lock?.user_id
  }, [nodeLocks])

  const isNodeLockedByMe = useCallback((nodeId: string) => {
    return nodeLocks.some(lock => lock.node_id === nodeId && lock.user_id === userId)
  }, [nodeLocks, userId])

  const acquireNodeLock = useCallback(async (boardIdParam: string, nodeId: string, lockUserId?: string | null) => {
    const uid = lockUserId || userId
    if (!boardIdParam || !uid) return false
    // Disable lock when no other users present
    const others = remoteCursors.filter((c: any) => c?.user_id && c.user_id !== uid)
    if (others.length === 0) return true
    try {
      const res = await fetch('/api/board/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: boardIdParam, nodeId, userId: uid })
      })
      return res.ok
    } catch {
      return false
    }
  }, [userId, remoteCursors])

  const releaseNodeLock = useCallback(async (boardIdParam: string, nodeId: string, lockUserId?: string | null) => {
    const uid = lockUserId || userId
    if (!boardIdParam || !uid) return
    try {
      await fetch('/api/board/locks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId: boardIdParam, nodeId, userId: uid })
      })
    } catch {}
  }, [userId])

  return {
    remoteCursors,
    nodeLocks,
    isNodeLocked,
    getNodeLockOwner,
    isNodeLockedByMe,
    acquireNodeLock,
    releaseNodeLock,
  }
}

export default useBoardRealtime


