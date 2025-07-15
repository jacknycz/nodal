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
import { useBoardStore } from './boardSlice'
import { canCreateConnection, getConnectionType, getNodeById } from './boardUtils'
import NodalNode from '../nodes/nodalNode'
import DocumentNode from '../nodes/DocumentNode'
import FloatingEdge from './FloatingEdge'
import CustomConnectionLine from './CustomConnectionLine'
import FloatingActionButton from '../../components/FloatingActionButton'
import AddNodeButton from '../../components/AddNodeButton'
import AINodeGenerator from '../../components/AINodeGenerator'
import BoardNameModal from '../../components/BoardNameModal'
import BoardRoomModal from '../../components/BoardRoomModal'
import BokehBackground from '../../components/BokehBackground'
import ChatPanel from '../../components/ChatPanel'
import NodeAwareChatPanel from '../../components/NodeAwareChatPanel'
import AskAboutSelectionFAB from '../../components/AskAboutSelectionFAB'
import TopicModal from '../../components/TopicModal'
import TopicDisplay from '../../components/TopicDisplay'
import { useViewportCenter } from '../../hooks/useViewportCenter'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
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

  const { topic, setTopic } = useBoardStore()
  const { getViewportCenter } = useViewportCenter()
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showBoardRoom, setShowBoardRoom] = useState(false)
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [showChat, setShowChat] = useState(true) // Auto-open to show new system
  const [chatMode, setChatMode] = useState<'superman' | 'node-aware'>('node-aware')
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
  
  // Selection context state
  const [selectionContext, setSelectionContext] = useState<string | undefined>(undefined)

  // Create a hash of the current board state for change detection
  const getCurrentDataHash = useCallback(() => {
    const data = { nodes, edges }
    return JSON.stringify(data)
  }, [nodes, edges])

  // Auto-save function
  const autoSave = useCallback(async () => {
    if (!currentBoardId || !currentBoardName) return

    try {
      const currentData = getCurrentDataHash()
      if (currentData === lastSavedDataRef.current) return

      setSaveStatus('saving')
      const boardData = {
        nodes,
        edges,
        viewport: viewport || { x: 0, y: 0, zoom: 1 }
      }

      await boardStorage.updateBoard(currentBoardId, boardData)
      lastSavedDataRef.current = currentData
      setHasUnsavedChanges(false)
      setSaveStatus('saved')
    } catch (error) {
      console.error('Auto-save failed:', error)
      setSaveStatus('error')
    }
  }, [nodes, edges, viewport, currentBoardId, currentBoardName, getCurrentDataHash])

  // Auto-save on changes
  useEffect(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    const currentData = getCurrentDataHash()
    if (currentData !== lastSavedDataRef.current) {
      setHasUnsavedChanges(true)
      setSaveStatus('unsaved')
      
      // Auto-save after 2 seconds of inactivity
      autosaveTimeoutRef.current = window.setTimeout(autoSave, 2000)
    }

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [getCurrentDataHash, autoSave])

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

  // Listen for topbar actions
  useEffect(() => {
    const handleOpenSaveModal = () => setShowSaveModal(true)
    const handleOpenBoardRoom = () => setShowBoardRoom(true)
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

    window.addEventListener('open-save-modal', handleOpenSaveModal)
    window.addEventListener('open-board-room', handleOpenBoardRoom)
    window.addEventListener('export-board', handleExportBoard)
    window.addEventListener('import-board', handleImportBoard)

    return () => {
      window.removeEventListener('open-save-modal', handleOpenSaveModal)
      window.removeEventListener('open-board-room', handleOpenBoardRoom)
      window.removeEventListener('export-board', handleExportBoard)
      window.removeEventListener('import-board', handleImportBoard)
    }
  }, [nodes, edges, currentBoardName])

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

        // Add document node to board - get fresh nodes state to prevent stale closure
        const newNode = { ...documentNode, id: uuidv4() }
        const currentNodes = useBoardStore.getState().nodes
        setNodes([...currentNodes, newNode])
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
      const boardData = await boardStorage.loadBoard(board.id)
      if (boardData) {
        setNodes(boardData.data.nodes)
        setEdges(boardData.data.edges)
        updateViewport(boardData.data.viewport)
        setCurrentBoardId(board.id)
        setCurrentBoardName(board.name)
        lastSavedDataRef.current = JSON.stringify({ nodes: boardData.data.nodes, edges: boardData.data.edges })
        setHasUnsavedChanges(false)
        setSaveStatus('saved')
        console.log('Board loaded successfully!')
      }
    } catch (error) {
      console.error('Failed to load board:', error)
      // TODO: Show error toast
    }
  }

  const handleRenameBoard = async (boardId: string, newName: string) => {
    try {
      await boardStorage.renameBoard(boardId, newName)
      
      // If we renamed the current board, update the current board name
      if (boardId === currentBoardId) {
        setCurrentBoardName(newName)
      }
      
      // Refresh board names list
      const names = await boardStorage.getBoardNames()
      setExistingBoardNames(names)
      
      console.log('Board renamed successfully!')
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

  // Keyboard shortcuts (updated)
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
      description: 'Open Chat'
    },
    {
      key: 'n',
      ctrl: true,
      shift: true,
      action: () => {
        setChatMode(prev => prev === 'superman' ? 'node-aware' : 'superman')
        console.log(`Switched to ${chatMode === 'superman' ? 'node-aware' : 'superman'} chat mode`)
      },
      description: 'Toggle Chat Mode'
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
    clearBoard()
    setCurrentBoardName(undefined)
    setCurrentBoardId(undefined)
    setHasUnsavedChanges(false)
    setSaveStatus('saved')
    lastSavedDataRef.current = ''
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

  const handleOpenChatWithSelection = (context: string) => {
    setSelectionContext(context)
    setShowChat(true)
    setChatMode('node-aware')
  }
  
  const handleSelectionContextUsed = () => {
    setSelectionContext(undefined)
  }

  // Show topic modal on new/empty board
  useEffect(() => {
    if (!topic && nodes.length === 0) {
      setShowTopicModal(true)
    }
  }, [topic, nodes.length])

  // Handler for saving topic
  const handleSaveTopic = (newTopic: string) => {
    setTopic(newTopic)
  }

  // Handler for editing topic
  const handleEditTopic = () => {
    setShowTopicModal(true)
  }

  return (
    <div className="w-full h-full relative">
      {/* DEBUG: Chat Mode Indicator */}
      <div className="fixed top-2 left-2 z-50 bg-black text-white px-3 py-1 rounded text-xs font-mono">
        Chat Mode: {chatMode} | Show: {showChat ? 'true' : 'false'}
      </div>
      
      {/* Floating Action Button */}
      <FloatingActionButton
        onAddNode={handleAddNode}
        onOpenAIGenerator={() => setShowAIGenerator(true)}
        onClearBoard={handleClearBoard}
        hasNodes={nodes.length > 0}
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

      {/* Chat Panels - conditionally render based on mode */}
      {chatMode === 'superman' ? (
        <ChatPanel 
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          onToggleMode={() => setChatMode('node-aware')}
        />
      ) : (
        <NodeAwareChatPanel 
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          onToggleMode={() => setChatMode('superman')}
          selectionContext={selectionContext}
          onSelectionContextUsed={handleSelectionContextUsed}
        />
      )}

      {/* Ask About Selection FAB */}
      <AskAboutSelectionFAB 
        onOpenChatWithSelection={handleOpenChatWithSelection}
      />

      {/* Topic Display */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40">
        <TopicDisplay topic={topic} onEdit={handleEditTopic} />
      </div>

      
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

      {/* <TopicModal
        isOpen={showTopicModal}
        onClose={() => setShowTopicModal(false)}
        defaultTopic={topic || ''}
        onSave={handleSaveTopic}
        isFirstTime={!topic && nodes.length === 0}
      /> */}
    </div>
  )
} 
