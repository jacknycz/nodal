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
import { v4 as uuidv4 } from 'uuid'
import { useBoard } from './useBoard'
import { canCreateConnection, getConnectionType, getNodeById } from './boardUtils'
import NodalNode from '../nodes/nodalNode'
import DocumentNode from '../nodes/DocumentNode'
import FloatingEdge from './FloatingEdge'
import CustomConnectionLine from './CustomConnectionLine'
import Toolbar from '@/components/Toolbar'
import AddNodeButton from '@/components/AddNodeButton'
import AINodeGenerator from '@/components/AINodeGenerator'
import BoardNameModal from '@/components/BoardNameModal'
import BoardRoomModal from '@/components/BoardRoomModal'
import BokehBackground from '@/components/BokehBackground'
import ChatPanel from '@/components/ChatPanel'
import { useViewportCenter } from '@/hooks/useViewportCenter'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { boardStorage, type SavedBoard } from '../storage/storage'
import { 
  extractTextFromFile, 
  validateFile, 
  createDocumentNode,
  SUPPORTED_FILE_TYPES 
} from '../nodes/documentUtils'

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
  document: DocumentNode,
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
  const [showChat, setShowChat] = useState(false)
  const [currentBoardName, setCurrentBoardName] = useState<string | undefined>(undefined)
  const [currentBoardId, setCurrentBoardId] = useState<string | undefined>(undefined)
  const [existingBoardNames, setExistingBoardNames] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  
  // Refs for autosave
  const autosaveTimeoutRef = useRef<number | null>(null)
  const lastSavedDataRef = useRef<string>('')
  
  // Upload state
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string>('')

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

  const handleAddNode = useCallback(() => {
    const center = getViewportCenter()
    addNode('New Node', center)
  }, [addNode, getViewportCenter])

  // Document upload handlers
  const handleFileUpload = useCallback(async (files: FileList, position?: { x: number; y: number }) => {
    const targetPosition = position || getViewportCenter()
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      try {
        // Validate file
        const validation = validateFile(file)
        if (!validation.valid) {
          setUploadError(validation.error || 'Invalid file')
          continue
        }

        // Extract text from file
        const extractedText = await extractTextFromFile(file)
        
        // Save document to storage
        const documentId = await boardStorage.saveDocument(
          file.name,
          file,
          extractedText,
          currentBoardId || 'temp',
        )

        // Create document node
        const documentNode = createDocumentNode(
          file,
          documentId,
          { 
            x: targetPosition.x + (i * 20), // Offset multiple files
            y: targetPosition.y + (i * 20)
          },
          extractedText
        )

        // Add document node to board using the board store directly
        const newNode = { ...documentNode, id: uuidv4() }
        setNodes([...nodes, newNode])
        console.log(`Document "${file.name}" uploaded successfully!`)
        
      } catch (error) {
        console.error('Failed to upload document:', error)
        setUploadError(`Failed to upload ${file.name}`)
      }
    }
    
    // Clear error after a delay
    setTimeout(() => setUploadError(''), 5000)
  }, [addNode, getViewportCenter, currentBoardId])

  // Add a manual reset function in case drag state gets stuck
  const resetDragState = useCallback(() => {
    console.log('Manually resetting drag state')
    setIsDragOver(false)
  }, [])


  // Window-level file drag detection - bypasses React Flow completely!
  useEffect(() => {
    let isFileBeingDragged = false

    const handleWindowDragEnter = (e: DragEvent) => {
      // Only activate if we have files and haven't already activated
      if (!isFileBeingDragged && e.dataTransfer?.types.includes("Files")) {
        isFileBeingDragged = true
        setIsDragOver(true)
        console.log("🔄 File drag detected - overlay ON")
      }
    }

    const handleWindowDragOver = (e: DragEvent) => {
      // Prevent browser from opening files
      if (isFileBeingDragged && e.dataTransfer) {
        e.preventDefault()
        e.dataTransfer.dropEffect = "copy"
      }
    }

    const handleWindowDragEnd = (e: DragEvent) => {
      // Drag operation completely ended
      if (isFileBeingDragged) {
        isFileBeingDragged = false
        setIsDragOver(false)
        console.log("🏁 File drag ended - overlay OFF")
      }
    }

    const handleWindowDrop = (e: DragEvent) => {
      if (!isFileBeingDragged) return
      
      // Check if we're dropping on the board
      const boardElement = document.querySelector(".react-flow") as HTMLElement
      if (boardElement) {
        const rect = boardElement.getBoundingClientRect()
        const isOnBoard = e.clientX >= rect.left && e.clientX <= rect.right && 
                         e.clientY >= rect.top && e.clientY <= rect.bottom
        
        if (isOnBoard && e.dataTransfer?.files) {
          e.preventDefault()
          e.stopPropagation()
          
          console.log("🎯 Files dropped on board!")
          const position = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          }
          handleFileUpload(e.dataTransfer.files, position)
        }
      }
      
      // Always end drag state on any drop
      isFileBeingDragged = false
      setIsDragOver(false)
    }

    // Window-level events - no React Flow interference!
    window.addEventListener("dragenter", handleWindowDragEnter)
    window.addEventListener("dragover", handleWindowDragOver)
    window.addEventListener("dragend", handleWindowDragEnd)
    window.addEventListener("drop", handleWindowDrop)

    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter)
      window.removeEventListener("dragover", handleWindowDragOver)
      window.removeEventListener("dragend", handleWindowDragEnd)
      window.removeEventListener("drop", handleWindowDrop)
    }
  }, [handleFileUpload])

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
      key: 'c',
      ctrl: true,
      action: () => setShowChat(true),
      description: 'Open Superman Chat'
    },
    {
      key: 'Escape',
      action: () => {
        setShowAIGenerator(false)
        setShowSaveModal(false)
        setShowBoardRoom(false)
        setShowChat(false)
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
        onOpenChat={() => setShowChat(true)}
      />
      
      {/* Upload error notification */}
      {uploadError && (
        <div className="absolute top-20 left-4 z-20 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded shadow-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">{uploadError}</span>
          </div>
        </div>
      )}

      {/* Superman Chat Panel */}
      <ChatPanel 
        isOpen={showChat}
        onClose={() => setShowChat(false)}
      />

      {/* Drag and drop overlay */}
      {isDragOver && (
        <div 
          className="absolute inset-0 z-30 bg-blue-500 bg-opacity-20 border-4 border-dashed border-blue-500 flex items-center justify-center"
          onClick={resetDragState}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-xl text-center">
            <svg className="w-16 h-16 mx-auto mb-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Drop Documents Here</h3>
            <p className="text-gray-600 dark:text-gray-400">
              Support for PDF, Word, Text, Markdown, and Images
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Max file size: 10MB
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-2 italic">
              Click here if overlay gets stuck
            </p>
          </div>
        </div>
      )}
      
      <div
        className="w-full h-full"
        style={{ position: 'relative' }}
      >
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
      </div>
      
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
