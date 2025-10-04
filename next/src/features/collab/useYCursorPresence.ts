"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CursorPayload, CursorUser } from './types'
import * as Y from 'yjs'
import { WebrtcProvider } from 'y-webrtc'
import { WebsocketProvider } from 'y-websocket'

const COLORS = ['#EF4444','#F59E0B','#10B981','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#F97316','#22C55E','#06B6D4']
const colorFor = (id: string) => COLORS[Math.abs(Array.from(id).reduce((a,c)=>((a<<5)-a)+c.charCodeAt(0),0)) % COLORS.length]

export interface UseYCursorPresenceOptions {
  boardId: string | null
  user: { id: string; name?: string; avatar_url?: string } | null
}

export function useYCursorPresence({ boardId, user }: UseYCursorPresenceOptions) {
  const [remoteCursors, setRemoteCursors] = useState<CursorPayload[]>([])
  const [connected, setConnected] = useState(false)
  const providerRef = useRef<WebrtcProvider | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastSentRef = useRef<number>(0)
  const pendingRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!boardId || !user) return
    const room = `board-${boardId}`
    const rawWs = process.env.NEXT_PUBLIC_PRESENCE_WS
    if (rawWs) {
      // Plain WebSocket fallback (room-scoped)
      const wsUrl = `${rawWs}?boardId=${boardId}`
      console.log('[presence] using plain ws provider', wsUrl)
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws
      ws.addEventListener('open', () => setConnected(true))
      ws.addEventListener('close', () => setConnected(false))
      ws.addEventListener('error', () => setConnected(false))
      ws.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data as string)
          if (msg?.type === 'cursor-update' && msg?.data) {
            const d = msg.data
            if (!d?.user?.id) return
            setRemoteCursors((prev) => {
              // Replace by user.id to avoid duplicates
              const map = new Map<string, CursorPayload>()
              for (const c of prev) map.set(c.user.id, c)
              map.set(d.user.id, d as CursorPayload)
              return Array.from(map.values())
            })
          }
        } catch {}
      })
      return () => {
        try { ws.close() } catch {}
        wsRef.current = null
        setConnected(false)
        setRemoteCursors([])
      }
    } else {
      // Yjs providers
      const doc = new Y.Doc()
      let provider: any
      const yws = process.env.NEXT_PUBLIC_YWS_URL
      if (yws) {
        console.log('[presence] using y-websocket provider', yws, room)
        provider = new WebsocketProvider(yws, room, doc)
      } else {
        console.log('[presence] using y-webrtc provider with public signaling', room)
        provider = new WebrtcProvider(room, doc, {
          signaling: [
            'wss://signaling.yjs.dev',
            'wss://y-webrtc-signaling-eu.fly.dev',
            'wss://y-webrtc-signaling-us.fly.dev'
          ]
        } as any)
      }
      providerRef.current = provider
      const awareness = provider.awareness
      setConnected(true)

      const onChange = () => {
        const states = awareness.getStates()
        const list: CursorPayload[] = []
        states.forEach((st: any) => {
          const cur = st?.cursor
          if (!cur || !cur.user?.id) return
          list.push({ user: cur.user as CursorUser, x: cur.x, y: cur.y, ts: cur.ts })
        })
        setRemoteCursors(list)
      }
      awareness.on('change', onChange)
      return () => {
        try { awareness.off('change', onChange) } catch {}
        try { provider.destroy() } catch {}
        providerRef.current = null
        setConnected(false)
        setRemoteCursors([])
      }
    }
  }, [boardId, user?.id])

  const updateLocalPos = useCallback((x: number, y: number) => {
    pendingRef.current = { x, y }
    if (rafRef.current) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const now = Date.now()
      if (now - lastSentRef.current < 33) return
      lastSentRef.current = now
      const p = pendingRef.current
      if (!p) return
      const me: CursorUser = { id: user?.id || 'anon', name: (user as any)?.name || 'User', avatar: (user as any)?.avatar_url, color: colorFor(user?.id || 'anon') }
      const rawWs = process.env.NEXT_PUBLIC_PRESENCE_WS
      if (rawWs && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        try {
          wsRef.current.send(JSON.stringify({
            type: 'cursor-move',
            boardId,
            data: { user: me, x: p.x, y: p.y, ts: now }
          }))
        } catch {}
        return
      }
      const provider = providerRef.current
      if (!provider) return
      const awareness = provider.awareness
      awareness.setLocalStateField('cursor', { user: me, x: p.x, y: p.y, ts: now })
    })
  }, [user?.id])

  return { connected, remoteCursors, updateLocalPos }
}

export default useYCursorPresence


