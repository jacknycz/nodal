import React from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react'
import type { Connection, Edge, Node } from '@xyflow/react'

import '@xyflow/react/dist/style.css'

export default function Board() {
  const initialNodes: Node[] = [
    {
      id: '1',
      position: { x: 100, y: 100 },
      data: { label: 'Hello, Board 👋' },
      type: 'default',
    },
  ]

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const onConnect = (connection: Connection) =>
    setEdges((eds) => addEdge(connection, eds))

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
    </div>
  )
} 