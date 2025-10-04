// Simple y-websocket server for local yjs presence
// Run: node local-yjs-ws-server.js

import http from 'http'
import ws from 'ws'
import { setupWSConnection } from 'y-websocket/bin/utils.js'

const PORT = 3002
const server = http.createServer()
const wss = new ws.Server({ server })

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req)
})

server.listen(PORT)
console.log(`y-websocket server on ws://localhost:${PORT}`)


