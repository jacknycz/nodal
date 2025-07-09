import React, { useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  ConnectionMode,
  MarkerType,
  type Connection,
} from '@xyflow/react'
import { useBoard } from './useBoard'
import { canCreateConnection, getConnectionType, getNodeById } from './boardUtils'
import NodalNode from '../nodes/nodalNode'
import FloatingEdge from './FloatingEdge'
import CustomConnectionLine from './CustomConnectionLine'
import Toolbar from '@/components/Toolbar'
import AddNodeButton from '@/components/AddNodeButton'
import AINodeGenerator from '@/components/AINodeGenerator'
import { useViewportCenter } from '@/hooks/useViewportCenter'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

import '@xyflow/react/dist/style.css'

const nodeTypes = {
  default: NodalNode,
}

const edgeTypes = {
  floating: FloatingEdge,
}

const defaultEdgeOptions = {
  type: 'floating',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#6b7280',
  },
}

const connectionLineStyle = {
  stroke: '#3b82f6',
  strokeWidth: 3,
}

export default function Board() {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    addNode,
    addEdge,
    clearBoard,
    updateViewport,
  } = useBoard()

  const { getViewportCenter } = useViewportCenter()
  const [showAIGenerator, setShowAIGenerator] = useState(false)

  // Debug: Log current edges state
  useEffect(() => {
    console.log('Board rendering with edges:', edges)
    console.log('ReactFlow edges structure:', JSON.stringify(edges, null, 2))
  }, [edges])

  const handleConnect = (connection: Connection) => {
    console.log('handleConnect called with:', connection)
    if (!connection.source || !connection.target) return
    
    const sourceNode = getNodeById(nodes, connection.source)
    const targetNode = getNodeById(nodes, connection.target)
    
    if (!sourceNode || !targetNode) return
    
    // Validate connection
    const validation = canCreateConnection(edges, connection.source, connection.target)
    if (!validation.valid) {
      console.warn('Connection rejected:', validation.reason)
      // TODO: Show user feedback/toast notification
      return
    }
    
    // Determine connection type for our data model
    const connectionType = getConnectionType(sourceNode, targetNode)
    console.log('Connection type:', connectionType)
    
    // Create enhanced edge - use connectionType for data, floating type for rendering
    const result = addEdge(connection.source, connection.target, { 
      type: connectionType  // This is our internal type: 'default' | 'ai' | 'focus'
    })
    console.log('addEdge result:', result)
    console.log('Current edges after add:', edges)
  }

  const handleAddNode = () => {
    const center = getViewportCenter()
    addNode(`Node ${nodes.length + 1}`, center)
  }

  // Keyboard shortcuts (defined after functions)
  useKeyboardShortcuts([
    {
      key: 'g',
      ctrl: true,
      action: () => setShowAIGenerator(true),
      description: 'Open AI Node Generator'
    },
    {
      key: 'n',
      ctrl: true,
      action: handleAddNode,
      description: 'Add new node'
    },
    {
      key: 'Escape',
      action: () => setShowAIGenerator(false),
      description: 'Close AI Node Generator'
    }
  ])

  const handleClearBoard = () => {
    if (confirm('Are you sure you want to clear the board?')) {
      clearBoard()
    }
  }

  const handleExportBoard = () => {
    const boardData = { nodes, edges }
    const dataStr = JSON.stringify(boardData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'board-export.json'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImportBoard = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string)
            // TODO: Implement import logic
            console.log('Import data:', data)
          } catch (error) {
            console.error('Failed to parse import file:', error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  return (
    <div className="w-screen h-screen relative">
      <Toolbar
        onAddNode={handleAddNode}
        onClearBoard={handleClearBoard}
        onExportBoard={handleExportBoard}
        onImportBoard={handleImportBoard}
        onOpenAIGenerator={() => setShowAIGenerator(true)}
      />
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onMove={(_, viewport) => updateViewport(viewport)}
        connectionMode={ConnectionMode.Loose}
        connectionLineComponent={CustomConnectionLine}
        connectionLineStyle={connectionLineStyle}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        className="bg-gray-50"
      >
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
      
      <AddNodeButton onAddNode={handleAddNode} />
      
      <AINodeGenerator 
        isOpen={showAIGenerator}
        onClose={() => setShowAIGenerator(false)}
      />
    </div>
  )
} 