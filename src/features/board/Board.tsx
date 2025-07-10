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
import BoardNameModal from '@/components/BoardNameModal'
import BokehBackground from '@/components/BokehBackground'
import { useViewportCenter } from '@/hooks/useViewportCenter'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { boardStorage } from '../storage/storage'

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
    deleteEdge,
    clearBoard,
    updateViewport,
    viewport,
  } = useBoard()

  const { getViewportCenter } = useViewportCenter()
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [currentBoardName, setCurrentBoardName] = useState<string | undefined>(undefined)
  const [currentBoardId, setCurrentBoardId] = useState<string | undefined>(undefined)
  const [existingBoardNames, setExistingBoardNames] = useState<string[]>([])

  // Load existing board names for validation
  useEffect(() => {
    const loadBoardNames = async () => {
      try {
        const names = await boardStorage.getBoardNames()
        setExistingBoardNames(names)
      } catch (error) {
        console.error('Failed to load board names:', error)
      }
    }
    loadBoardNames()
  }, [])

  // Listen for edge delete events from FloatingEdge components
  useEffect(() => {
    const handleEdgeDelete = (event: CustomEvent) => {
      const { edgeId } = event.detail
      deleteEdge(edgeId)
    }

    window.addEventListener('edge-delete', handleEdgeDelete as EventListener)
    return () => window.removeEventListener('edge-delete', handleEdgeDelete as EventListener)
  }, [deleteEdge])

  const handleConnect = (connection: Connection) => {
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
    
    // Create enhanced edge - use connectionType for data, floating type for rendering
    addEdge(connection.source, connection.target, { 
      type: connectionType  // This is our internal type: 'default' | 'ai' | 'focus'
    })
  }

  const handleAddNode = () => {
    const center = getViewportCenter()
    addNode(`Node ${nodes.length + 1}`, center)
  }

  const handleSaveBoard = async (boardName: string) => {
    try {
      const boardData = {
        nodes,
        edges,
        viewport: viewport || { x: 0, y: 0, zoom: 1 }
      }

      if (currentBoardId && currentBoardName === boardName) {
        // Update existing board
        await boardStorage.updateBoard(currentBoardId, boardData)
        console.log('Board updated successfully!')
      } else {
        // Save new board
        const boardId = await boardStorage.saveBoard(boardName, boardData)
        setCurrentBoardId(boardId)
        setCurrentBoardName(boardName)
        console.log('Board saved successfully!')
      }

      // Refresh board names list
      const names = await boardStorage.getBoardNames()
      setExistingBoardNames(names)
    } catch (error) {
      console.error('Failed to save board:', error)
      // TODO: Show error toast
    }
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
      key: 's',
      ctrl: true,
      action: () => setShowSaveModal(true),
      description: 'Save board'
    },
    {
      key: 'Escape',
      action: () => {
        setShowAIGenerator(false)
        setShowSaveModal(false)
      },
      description: 'Close modals'
    }
  ])

  const handleClearBoard = () => {
    if (confirm('Are you sure you want to clear the board?')) {
      clearBoard()
      setCurrentBoardName(undefined)
      setCurrentBoardId(undefined)
    }
  }

  const handleExportBoard = () => {
    const boardData = { nodes, edges }
    const dataStr = JSON.stringify(boardData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${currentBoardName || 'board'}-export.json`
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
    <div className="w-full h-full relative">
      <Toolbar
        onAddNode={handleAddNode}
        onClearBoard={handleClearBoard}
        onExportBoard={handleExportBoard}
        onImportBoard={handleImportBoard}
        onOpenAIGenerator={() => setShowAIGenerator(true)}
        onSaveBoard={() => setShowSaveModal(true)}
        currentBoardName={currentBoardName}
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
        className="bg-gray-50 dark:bg-gray-900"
      >
        <BokehBackground />
        <MiniMap />
        <Controls />
        <Background />
      </ReactFlow>
      
      <AddNodeButton onAddNode={handleAddNode} />
      
      <AINodeGenerator 
        isOpen={showAIGenerator}
        onClose={() => setShowAIGenerator(false)}
      />

      <BoardNameModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSaveBoard}
        defaultName={currentBoardName || ''}
        existingNames={existingBoardNames.filter(name => name !== currentBoardName)}
      />
    </div>
  )
} 