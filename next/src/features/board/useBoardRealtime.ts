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
}

export function useBoardRealtime({ boardId, userId, supabase, applyRemoteNodeContent }: UseBoardRealtimeParams) {
  const [remoteCursors, setRemoteCursors] = useState<any[]>([])
  const [nodeLocks, setNodeLocks] = useState<any[]>([])

  // Subscribe to remote cursors
  useEffect(() => {
    if (!boardId) return

    const fetchCursors = async () => {
      const { data } = await supabase
        .from('board_cursors')
        .select('*')
        .eq('board_id', boardId)
      setRemoteCursors(data || [])
    }

    const channel = supabase
      .channel('board-cursors-' + boardId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'board_cursors', filter: `board_id=eq.${boardId}` },
        () => fetchCursors()
      )
      .subscribe()

    fetchCursors()
    return () => { supabase.removeChannel(channel) }
  }, [boardId, supabase])

  // Subscribe to node locks (disabled when only one user is present on the board)
  useEffect(() => {
    if (!boardId) return

    let cursorsChannel: any = null
    let locksChannel: any = null
    let disposed = false

    const setup = async () => {
      // Count distinct active users from cursors; if <= 1, disable lock mechanics
      const { data: cursors } = await supabase
        .from('board_cursors')
        .select('user_id')
        .eq('board_id', boardId)
      const activeUsers = Array.from(new Set((cursors || []).map((c: any) => c.user_id).filter(Boolean)))
      const locksDisabled = activeUsers.length <= 1
      if (locksDisabled) {
        setNodeLocks([])
        // Still subscribe to cursors to re-enable if someone joins
        cursorsChannel = supabase
          .channel('node-locks-cursors-' + boardId)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'board_cursors', filter: `board_id=eq.${boardId}` }, () => setup())
          .subscribe()
        return
      }

      const fetchLocks = async () => {
        const { data } = await supabase
          .from('node_locks')
          .select('*')
          .eq('board_id', boardId)
          .gt('expires_at', new Date().toISOString())
        setNodeLocks(data || [])
      }

      locksChannel = supabase
        .channel('node-locks-' + boardId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'node_locks', filter: `board_id=eq.${boardId}` },
          () => fetchLocks()
        )
        .subscribe()

      await fetchLocks()
    }

    setup()
    return () => {
      if (locksChannel) supabase.removeChannel(locksChannel)
      if (cursorsChannel) supabase.removeChannel(cursorsChannel)
      disposed = true
    }
  }, [boardId, supabase])

  // Subscribe to board updates for real-time content sync
  useEffect(() => {
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
  }, [boardId, userId, supabase, applyRemoteNodeContent])

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


