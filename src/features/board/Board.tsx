import React, { useState, useEffect, useRef, useCallback } from 'react'
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
import BoardRoomModal from '@/components/BoardRoomModal'
import BokehBackground from '@/components/BokehBackground'
import { useViewportCenter } from '@/hooks/useViewportCenter'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { boardStorage, type SavedBoard } from '../storage/storage'

import '@xyflow/react/dist/style.css'

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

interface BoardProps {
  onBoardStateChange: (
    boardName: string | undefined,
    saveStatus: SaveStatus,
    hasUnsavedChanges: boolean
  ) => void
}

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

export default function Board({ onBoardStateChange }: BoardProps) {
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
    setNodes,
    setEdges,
  } = useBoard()

  const { getViewportCenter } = useViewportCenter()
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showBoardRoom, setShowBoardRoom] = useState(false)
  const [currentBoardName, setCurrentBoardName] = useState<string | undefined>(undefined)
  const [currentBoardId, setCurrentBoardId] = useState<string | undefined>(undefined)
  const [existingBoardNames, setExistingBoardNames] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // Refs for autosave
  const autosaveTimeoutRef = useRef<number | null>(null)
  const lastSavedDataRef = useRef<string>('')

  // Create a hash of the current board state for change detection
  const getCurrentDataHash = useCallback(() => {
    const data = { nodes, edges }
    return JSON.stringify(data)
  }, [nodes, edges])

  // Auto-save function
  const performAutosave = useCallback(async () => {
    if (!currentBoardId || !currentBoardName) {
      // Can't autosave without a board name/ID
      setSaveStatus('unsaved')
      return
    }

    try {
      setSaveStatus('saving')
      const boardData = {
        nodes,
        edges,
        viewport: viewport || { x: 0, y: 0, zoom: 1 }
      }

      await boardStorage.updateBoard(currentBoardId, boardData)
      
      // Update the last saved data hash
      lastSavedDataRef.current = getCurrentDataHash()
      setHasUnsavedChanges(false)
      setSaveStatus('saved')
      
      console.log('Auto-saved successfully!')
    } catch (error) {
      console.error('Auto-save failed:', error)
      setSaveStatus('error')
    }
  }, [currentBoardId, currentBoardName, nodes, edges, viewport, getCurrentDataHash])

  // Track changes and trigger autosave
  useEffect(() => {
    const currentDataHash = getCurrentDataHash()
    
    // Skip if this is the initial load or if data hasn't actually changed
    if (lastSavedDataRef.current === '' || lastSavedDataRef.current === currentDataHash) {
      return
    }

    // Mark as having unsaved changes
    setHasUnsavedChanges(true)
    if (currentBoardId) {
      setSaveStatus('unsaved')
    }

    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    // Set new autosave timeout (debounced by 3 seconds)
    autosaveTimeoutRef.current = setTimeout(() => {
      performAutosave()
    }, 3000)

    // Cleanup timeout on unmount
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [getCurrentDataHash, currentBoardId, performAutosave])

  // Initialize last saved data when board is loaded/saved
  useEffect(() => {
    if (currentBoardId && !hasUnsavedChanges) {
      lastSavedDataRef.current = getCurrentDataHash()
      setSaveStatus('saved')
    }
  }, [currentBoardId, hasUnsavedChanges, getCurrentDataHash])

  // Notify parent of board state changes
  useEffect(() => {
    onBoardStateChange(currentBoardName, saveStatus, hasUnsavedChanges)
  }, [currentBoardName, saveStatus, hasUnsavedChanges, onBoardStateChange])

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
      setSaveStatus('saving')
      const boardData = {
        nodes,
        edges,
        viewport: viewport || { x: 0, y: 0, zoom: 1 }
      }

      console.log('Save attempt:', {
        boardName,
        currentBoardId,
        currentBoardName,
        condition: currentBoardId && currentBoardName === boardName
      })

      if (currentBoardId && currentBoardName === boardName) {
        // Update existing board
        await boardStorage.updateBoard(currentBoardId, boardData)
        console.log('Board updated successfully!')
      } else {
        // Save new board
        const boardId = await boardStorage.saveBoard(boardName, boardData)
        setCurrentBoardId(boardId)
        setCurrentBoardName(boardName)
        console.log('Board saved successfully! New ID:', boardId)
      }

      // Update tracking state
      lastSavedDataRef.current = getCurrentDataHash()
      setHasUnsavedChanges(false)
      setSaveStatus('saved')

      // Refresh board names list
      const names = await boardStorage.getBoardNames()
      setExistingBoardNames(names)
    } catch (error) {
      console.error('Failed to save board:', error)
      setSaveStatus('error')
      // TODO: Show error toast
    }
  }

  const handleLoadBoard = async (board: SavedBoard) => {
    try {
      // Load the board data
      setNodes(board.data.nodes)
      setEdges(board.data.edges)
      
      // Update viewport if available
      if (board.data.viewport) {
        updateViewport(board.data.viewport)
      }
      
      // Update current board tracking
      setCurrentBoardId(board.id)
      setCurrentBoardName(board.name)
      
      // Reset save state
      setHasUnsavedChanges(false)
      setSaveStatus('saved')
      
      // Close the board room
      setShowBoardRoom(false)
      
      console.log(`Board "${board.name}" loaded successfully!`)
    } catch (error) {
      console.error('Failed to load board:', error)
      // TODO: Show error toast
    }
  }

  const handleRenameBoard = async (boardId: string, newName: string) => {
    try {
      await boardStorage.renameBoard(boardId, newName)
      
      // Update current board name if it's the active board
      if (boardId === currentBoardId) {
        setCurrentBoardName(newName)
      }
      
      // Refresh board names list
      const names = await boardStorage.getBoardNames()
      setExistingBoardNames(names)
      
      console.log(`Board renamed to "${newName}" successfully!`)
    } catch (error) {
      console.error('Failed to rename board:', error)
      throw error // Re-throw so the modal can handle it
    }
  }

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await boardStorage.deleteBoard(boardId)
      
      // If we deleted the current board, clear the current board tracking
      if (boardId === currentBoardId) {
        setCurrentBoardId(undefined)
        setCurrentBoardName(undefined)
        setHasUnsavedChanges(false)
        setSaveStatus('saved')
      }
      
      // Refresh board names list
      const names = await boardStorage.getBoardNames()
      setExistingBoardNames(names)
      
      console.log('Board deleted successfully!')
    } catch (error) {
      console.error('Failed to delete board:', error)
      throw error // Re-throw so the modal can handle it
    }
  }

  const handleNewBoard = () => {
    // Clear the current board
    clearBoard()
    setCurrentBoardId(undefined)
    setCurrentBoardName(undefined)
    setHasUnsavedChanges(false)
    setSaveStatus('saved')
    lastSavedDataRef.current = ''
    
    console.log('Started new board!')
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
      key: 'o',
      ctrl: true,
      action: () => setShowBoardRoom(true),
      description: 'Open Board Room'
    },
    {
      key: 'Escape',
      action: () => {
        setShowAIGenerator(false)
        setShowSaveModal(false)
        setShowBoardRoom(false)
      },
      description: 'Close modals'
    }
  ])

  const handleClearBoard = () => {
    if (confirm('Are you sure you want to clear the board?')) {
      clearBoard()
      setCurrentBoardName(undefined)
      setCurrentBoardId(undefined)
      setHasUnsavedChanges(false)
      setSaveStatus('saved')
      lastSavedDataRef.current = ''
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
        onOpenBoardRoom={() => setShowBoardRoom(true)}
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

      <BoardRoomModal
        isOpen={showBoardRoom}
        onClose={() => setShowBoardRoom(false)}
        onLoadBoard={handleLoadBoard}
        onRenameBoard={handleRenameBoard}
        onDeleteBoard={handleDeleteBoard}
        onNewBoard={handleNewBoard}
        currentBoardId={currentBoardId}
      />
    </div>
  )
} 