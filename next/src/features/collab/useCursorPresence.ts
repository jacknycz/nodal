"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import type { CursorPayload, CursorUser } from './types'

const COLOR_PALETTE = [
  '#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#F97316','#22C55E','#06B6D4'
]

function hashToIndex(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i)
  return Math.abs(h) % COLOR_PALETTE.length
}

export interface UseCursorPresenceOptions {
  boardId: string | null
  user: { id: string; name?: string; avatar_url?: string } | null
  token?: string | null
  wsUrl?: string // NEXT_PUBLIC_PRESENCE_WS_URL
}

export function useCursorPresence({ boardId, user, token, wsUrl }: UseCursorPresenceOptions) {
  const [connected, setConnected] = useState(false)
  const [remoteCursors, setRemoteCursors] = useState<CursorPayload[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const lastSentRef = useRef<number>(0)
  const pendingPosRef = useRef<{ x: number; y: number } | null>(null)
  const rafRef = useRef<number | null>(null)
  const retryRef = useRef<number>(0)
  const retryTimerRef = useRef<any>(null)

  const disconnect = useCallback(() => {
    try { if (rafRef.current) cancelAnimationFrame(rafRef.current) } catch {}
    rafRef.current = null
    try { wsRef.current?.close() } catch {}
    wsRef.current = null
    setConnected(false)
  }, [])

  useEffect(() => {
    if (!boardId || !user) return
    if (!wsUrl || !(wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://'))) return
    const url = new URL(wsUrl)
    url.searchParams.set('boardId', boardId)
    if (token) url.searchParams.set('token', token)
    const socket = new WebSocket(url.toString())
    wsRef.current = socket
    socket.onopen = () => { setConnected(true); retryRef.current = 0 }
    socket.onclose = () => {
      setConnected(false)
      // bounded retry backoff (0.5s -> 4s)
      const delay = Math.min(4000, 500 * Math.pow(2, retryRef.current++))
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
      retryTimerRef.current = setTimeout(() => {
        if (wsRef.current === socket) wsRef.current = null
        // trigger re-connect by changing effect deps via no-op state toggle
        setRemoteCursors((prev) => prev.slice())
      }, delay)
    }
    socket.onerror = () => { setConnected(false) }
    socket.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg?.type === 'cursor-update') {
          const payloads = (Array.isArray(msg.data) ? msg.data : [msg.data]) as CursorPayload[]
          setRemoteCursors((prev) => {
            const byId = new Map<string, CursorPayload>()
            for (const p of prev) byId.set(p.user.id, p)
            for (const p of payloads) {
              const showSelf = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SHOW_SELF_CURSOR === '1'
              if (!showSelf && p?.user?.id === user.id) continue
              byId.set(p.user.id, p)
            }
            return Array.from(byId.values())
          })
        }
      } catch {}
    }
    return () => { if (retryTimerRef.current) clearTimeout(retryTimerRef.current); disconnect() }
  }, [boardId, user?.id, wsUrl, token, disconnect])

  const updateLocalPos = useCallback((x: number, y: number) => {
    pendingPosRef.current = { x, y }
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const now = Date.now()
        if (now - lastSentRef.current < 33) return
        lastSentRef.current = now
        const pos = pendingPosRef.current
        if (!pos || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        const me: CursorUser = {
          id: user?.id || 'anon',
          name: (user as any)?.name || 'User',
          avatar: (user as any)?.avatar_url,
          color: COLOR_PALETTE[hashToIndex(user?.id || 'anon')],
        }
        const payload: CursorPayload = { user: me, x: pos.x, y: pos.y, ts: now }
        try { wsRef.current.send(JSON.stringify({ type: 'cursor-move', boardId, data: payload })) } catch {}
      })
    }
  }, [boardId, user?.id])

  return { connected, remoteCursors, updateLocalPos }
}

export default useCursorPresence


