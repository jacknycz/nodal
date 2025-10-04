// Simple local WebSocket presence server for cursors
// Run: node local-ws-server.js

import { WebSocketServer } from 'ws'

const PORT = 3001
const wss = new WebSocketServer({ port: PORT })

// boardId -> Set<WebSocket>
const rooms = new Map()
// boardId -> Map<nodeId, userId>
const locks = new Map()

function joinRoom(boardId, ws) {
  if (!rooms.has(boardId)) rooms.set(boardId, new Set())
  rooms.get(boardId).add(ws)
}

function leaveAll(ws) {
  for (const set of rooms.values()) set.delete(ws)
}

wss.on('connection', (ws, req) => {
  try {
    const u = new URL(req.url || '', `http://localhost:${PORT}`)
    const boardId = u.searchParams.get('boardId') || undefined
    if (boardId) joinRoom(boardId, ws)
    console.log('[ws] client connected', { boardId })
  } catch {}
  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    const { type, boardId, data } = msg || {}
    if (!boardId || !type) return

    // Ensure joined
    joinRoom(boardId, ws)

    if (type === 'cursor-move' && data) {
      const room = rooms.get(boardId)
      if (!room) return
      const payload = JSON.stringify({ type: 'cursor-update', data })
      for (const client of room) {
        if (client.readyState === ws.OPEN) {
          try { client.send(payload) } catch {}
        }
      }
    }
    if (type === 'lock' && data && data.nodeId && data.userId) {
      console.log('[ws] lock', { boardId, nodeId: data.nodeId, userId: data.userId })
      const room = rooms.get(boardId)
      if (!room) return
      if (!locks.has(boardId)) locks.set(boardId, new Map())
      locks.get(boardId).set(data.nodeId, data.userId)
      const payload = JSON.stringify({ type: 'lock-update', data: { nodeId: data.nodeId, userId: data.userId, locked: true } })
      for (const client of room) {
        if (client.readyState === ws.OPEN) {
          try { client.send(payload) } catch {}
        }
      }
    }
    if (type === 'unlock' && data && data.nodeId && data.userId) {
      console.log('[ws] unlock', { boardId, nodeId: data.nodeId, userId: data.userId })
      const room = rooms.get(boardId)
      if (!room) return
      if (locks.has(boardId)) locks.get(boardId).delete(data.nodeId)
      const payload = JSON.stringify({ type: 'lock-update', data: { nodeId: data.nodeId, userId: data.userId, locked: false } })
      for (const client of room) {
        if (client.readyState === ws.OPEN) {
          try { client.send(payload) } catch {}
        }
      }
    }
  })

  ws.on('close', () => leaveAll(ws))
  ws.on('error', () => leaveAll(ws))
})

console.log(`WS server running on ws://localhost:${PORT}`)


