import React, { useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Connection,
} from '@xyflow/react'
import { useBoard } from './useBoard'
import NodalNode from '../nodes/nodalNode'
import Toolbar from '@/components/Toolbar'
import AddNodeButton from '@/components/AddNodeButton'
import AINodeGenerator from '@/components/AINodeGenerator'
import { useViewportCenter } from '@/hooks/useViewportCenter'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

import '@xyflow/react/dist/style.css'

const nodeTypes = {
  default: NodalNode,
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

  const handleConnect = (connection: Connection) => {
    if (connection.source && connection.target) {
      addEdge(connection.source, connection.target)
    }
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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onMove={(_, viewport) => updateViewport(viewport)}
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