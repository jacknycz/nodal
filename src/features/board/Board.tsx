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
import { canCreateConnection, getConnectionType, getNodeById, findNonOverlappingPositions } from './boardUtils'
import NodalNode from '../nodes/NodalNode'
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
import BoardSetupModal from '../../components/BoardSetupModal'
import PreSessionChat from '../../components/PreSessionChat'
import { useAINodeGenerator } from '../ai/useAINodeGenerator'
import { useAI } from '../ai/useAI'
import AIClient from '../ai/aiClient'

import '@xyflow/react/dist/style.css'
import type { BoardNode, BoardEdge } from './boardTypes'

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

interface BoardProps {
  onBoardStateChange: (
    boardName: string | undefined,
    saveStatus: SaveStatus,
    hasUnsavedChanges: boolean
  ) => void
  initialBoard?: any
  onOpenBoardRoom: () => void
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

declare global {
  interface Window {
    __nodal_vectorizedDocs?: any[];
  }
}

export default function Board({ onBoardStateChange, initialBoard, onOpenBoardRoom }: BoardProps) {
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

  const { topic, setTopic, boardBrief, setBoardBrief } = useBoardStore()
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
  const [showSetup, setShowSetup] = React.useState(false); // was: !boardBrief
  const [showPreSession, setShowPreSession] = React.useState(false)
  
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

  // Load initial board if provided
  useEffect(() => {
    if (initialBoard) {
      console.log('Loading initial board:', initialBoard)
      handleLoadBoard(initialBoard)
    }
  }, [initialBoard])

  // Detect if initialBoard has isNew property set to true, and if so, show the setup modal (setShowSetup(true)) and remove the isNew property so it doesn't trigger again. Do this in a useEffect that runs when initialBoard changes.
  useEffect(() => {
    if (initialBoard && initialBoard.isNew) {
      setShowSetup(true)
      // Remove the isNew flag so it doesn't trigger again
      initialBoard.isNew = false
    }
  }, [initialBoard])

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

  // Effect to show setup modal if boardBrief is not set
  // useEffect(() => {
  //   if (!boardBrief) setShowSetup(true)
  //   else setShowSetup(false)
  // }, [boardBrief])

  // Show pre-session chat after setup
  useEffect(() => {
    if (boardBrief && !boardBrief.isReady) setShowPreSession(true)
    else setShowPreSession(false)
  }, [boardBrief])

  const { generateNode, isGenerating, error: aiError } = useAINodeGenerator()
  const ai = useAI()

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
    const currentNodes = useBoardStore.getState().nodes
    // Find intelligent positions for all files
    const batchPositions = findNonOverlappingPositions(
      targetPosition,
      files.length,
      currentNodes.map(n => n.position),
      180,
      40
    )
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
          batchPositions[i],
          extractedText
        )
        // Add document node to board - get fresh nodes state to prevent stale closure
        const newNode = { ...documentNode, id: uuidv4() }
        const updatedNodes = useBoardStore.getState().nodes
        const allNodes = [...updatedNodes, newNode]
        setNodes(layoutMindMap(allNodes, edges))
        console.log(`Document "${file.name}" uploaded successfully!`)
      } catch (error) {
        console.error('Failed to upload document:', error)
        setUploadError(`Failed to upload ${file.name}`)
      }
    }
    // Clear error after a delay
    setTimeout(() => setUploadError(''), 5000)
  }, [addNode, getViewportCenter, currentBoardId, edges, setNodes])

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
      console.log('Loading board:', board)
      console.log('Board data:', board.data)
      console.log('Nodes to set:', board.data.nodes)
      console.log('Edges to set:', board.data.edges)
      
      // Use the board data directly - no need to reload from storage
      setNodes(layoutMindMap(board.data.nodes, board.data.edges))
      setEdges(board.data.edges)
      updateViewport(board.data.viewport)
      setCurrentBoardId(board.id)
      setCurrentBoardName(board.name)
      lastSavedDataRef.current = getCurrentDataHash() // Use the same format as getCurrentDataHash
      setHasUnsavedChanges(false)
      setSaveStatus('saved')
      console.log('Board loaded successfully!')
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

  // Handler for creating a new board from the modal
  const handleCreateNewBoard = async (boardName: string) => {
    try {
      const emptyBoardData = {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      }
      const boardId = await boardStorage.saveBoard(boardName, emptyBoardData)
      const newBoard = await boardStorage.loadBoard(boardId)
      if (newBoard) {
        handleLoadBoard(newBoard)
        setShowSaveModal(false)
      }
    } catch (error) {
      console.error('Failed to create new board:', error)
    }
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
            if (data.nodes && data.edges) {
              setNodes(layoutMindMap(data.nodes, data.edges))
              setEdges(data.edges)
            } else {
              console.log('Import data:', data)
            }
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

  const [vectorizing, setVectorizing] = useState(false)
  const [vectorizationError, setVectorizationError] = useState<string | null>(null)
  const [brainstorming, setBrainstorming] = useState(false)
  const [brainstormError, setBrainstormError] = useState<string | null>(null)
  const aiConfig = {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    baseUrl: import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  }
  const aiClient = new AIClient(aiConfig)

  const setEmbeddings = useBoardStore(state => state.setEmbeddings)
  const embeddings = useBoardStore(state => state.embeddings)

  // --- Mind Map Layout Algorithm ---
  function getNodeChildren(nodeId: string, edges: BoardEdge[]) {
    return edges.filter(e => e.source === nodeId).map(e => e.target)
  }

  function getRootNodeId(nodes: BoardNode[], edges: BoardEdge[]): string | null {
    // Heuristic: node with most outgoing edges, or fallback to first node
    if (nodes.length === 0) return null
    const outgoingCounts: Record<string, number> = {}
    edges.forEach(e => {
      outgoingCounts[e.source] = (outgoingCounts[e.source] || 0) + 1
    })
    let max = -1
    let rootId = nodes[0].id
    for (const node of nodes) {
      const count = outgoingCounts[node.id] || 0
      if (count > max) {
        max = count
        rootId = node.id
      }
    }
    return rootId
  }

  function layoutMindMap(nodes: BoardNode[], edges: BoardEdge[], center = { x: 400, y: 300 }) {
    if (nodes.length === 0) return []
    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))
    const rootId = getRootNodeId(nodes, edges)
    if (!rootId) return nodes
    const placed: Record<string, { x: number; y: number }> = {}
    const maxNodeWidth = 600
    const nodeHeight = 120
    const baseRadius = 600 // doubled from 300
    const levelStep = 440 // doubled from 220
    function placeNode(id: string, x: number, y: number, depth: number, angleStart: number, angleEnd: number) {
      placed[id] = { x, y }
      const children = getNodeChildren(id, edges)
      if (children.length === 0) return
      // Fan/arc layout for children
      const arcSpan = Math.min(Math.PI, Math.PI / 2 + (children.length - 1) * 0.18) // widen arc for more children
      const arcCenter = (angleStart + angleEnd) / 2
      const arcStart = arcCenter - arcSpan / 2
      const arcEnd = arcCenter + arcSpan / 2
      const r = baseRadius + depth * levelStep
      for (let i = 0; i < children.length; i++) {
        const angle = arcStart + (arcSpan * (i + 0.5)) / children.length
        const childX = x + Math.cos(angle) * r
        const childY = y + Math.sin(angle) * r
        placeNode(children[i], childX, childY, depth + 1, angle - 0.4, angle + 0.4)
      }
    }
    placeNode(rootId, center.x, center.y, 0, -Math.PI / 2, Math.PI * 1.5)
    // Assign new positions
    return nodes.map(n => ({ ...n, position: placed[n.id] || n.position }))
  }

  // --- Handler for Reorganize ---
  const handleReorganize = useCallback(() => {
    const newNodes = layoutMindMap(nodes, edges)
    setNodes(newNodes)
  }, [nodes, edges, setNodes])

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
        onReorganize={handleReorganize}
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
        onSave={handleCreateNewBoard}
        defaultName={currentBoardName || ''}
        existingNames={existingBoardNames.filter(name => name !== currentBoardName)}
      />

      {/* Removed BoardRoomModal and related state/logic */}

      {/* <TopicModal
        isOpen={showTopicModal}
        onClose={() => setShowTopicModal(false)}
        defaultTopic={topic || ''}
        onSave={handleSaveTopic}
        isFirstTime={!topic && nodes.length === 0}
      /> */}

      <BoardSetupModal
        isOpen={showSetup}
        onComplete={async brief => {
          setBoardBrief({ ...brief, isReady: false })
          setShowSetup(false)
          setNodes([])
          setVectorizing(true)
          setVectorizationError(null)
          setBrainstorming(false)
          setBrainstormError(null)
          let extractedResults: { file: File; text: string }[] = []
          let embeddingVectors: number[][] = []
          try {
            // Extract text from all uploaded files
            const files = brief.uploadedFiles || []
            extractedResults = await Promise.all(
              files.map(async file => {
                const text = await extractTextFromFile(file)
                return { file, text }
              })
            )
            // Batch vectorize all extracted text
            const texts = extractedResults.map(r => r.text)
            if (texts.length > 0) {
              embeddingVectors = await aiClient.getEmbedding(texts) as number[][]
            }
            setEmbeddings(extractedResults.map((r, i) => ({
              documentId: '', // You may want to set this if available
              fileName: r.file.name,
              text: r.text,
              embedding: embeddingVectors[i],
            })))
          } catch (err) {
            setVectorizationError(err instanceof Error ? err.message : 'Vectorization failed')
          } finally {
            setVectorizing(false)
          }
          // --- AI Brainstorm Map Generation ---
          setBrainstorming(true)
          setBrainstormError(null)
          try {
            // Build a context string from all onboarding info and extracted doc text
            const docText = (embeddings || []).map(d => `Document: ${d.fileName}\n${d.text.slice(0, 2000)}`).join('\n\n')
            const context = `Topic: ${brief.topic}\nRamble: ${brief.ramble || ''}\nGoal: ${brief.goal}\nAudience: ${brief.audience}\nResources: ${brief.resources.join(', ')}\nNotes: ${brief.notes || ''}\n${docText}`
            // Prompt the AI for a brainstorm map
            const brainstormPrompt = `Given the following context, generate a brainstorm map for a mindmap app.\n\nContext:\n${context}\n\nInstructions:\n- Suggest the best central node (if not obvious, use the topic)\n- Brainstorm as many relevant subtopics as make sense (not just 4), each as a prompt or question to explore\n- Optionally, group or cluster subtopics if themes emerge\n- Respond in JSON with this structure:\n{\n  \'center\': 'Central Node Title',\n  \'subtopics\': [\n    { \'title\': 'Subtopic', \'prompt\': 'Prompt or question', \'group\': 'Group Name (optional)' },\n    ...\n  ]\n}`
            const response = await ai.generate(brainstormPrompt, {
              model: 'gpt-4o',
              temperature: 0.7,
              maxTokens: 1200,
              systemPrompt: 'You are a helpful brainstorming assistant for a mindmap app.'
            })
            let brainstorm
            try {
              let raw = response.content.trim();
              // Remove Markdown code block if present
              if (raw.startsWith('```')) {
                raw = raw.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
              }
              brainstorm = JSON.parse(raw)
            } catch (e) {
              throw new Error('AI did not return valid JSON. Raw response: ' + response.content)
            }
            // Create nodes and edges using intelligent positioning
            const centerPosition = { x: 400, y: 300 }
            const centerNode = {
              id: 'center',
              type: 'default',
              position: centerPosition,
              data: { label: brainstorm.center, content: '', aiGenerated: true }
            }
            
            // Use intelligent positioning for subtopic nodes around the center
            const subtopicPositions = findNonOverlappingPositions(
              centerPosition,
              brainstorm.subtopics.length,
              [],
              180,
              40
            )
            
            const subtopicNodes = brainstorm.subtopics.map((s: any, i: number) => ({
              id: `subtopic-${i}`,
              type: 'default',
              position: subtopicPositions[i],
              data: { label: s.title, content: s.prompt, group: s.group, aiGenerated: true }
            }))
            const edges = subtopicNodes.map((n: any) => ({
              id: `edge-center-${n.id}`,
              source: 'center',
              target: n.id,
              type: 'floating',
              data: { type: 'ai' }
            }))
            // Create document nodes for uploaded files using intelligent positioning
            const documentNodes: any[] = []
            if (brief.uploadedFiles && brief.uploadedFiles.length > 0) {
              const documentPositions = findNonOverlappingPositions(
                { x: 400, y: 600 },
                brief.uploadedFiles.length,
                [centerNode, ...subtopicNodes].map(n => n.position),
                180,
                40
              )
              
              for (let i = 0; i < brief.uploadedFiles.length; i++) {
                const file = brief.uploadedFiles[i]
                const extractedResult = extractedResults.find(r => r.file === file)
                if (extractedResult) {
                  try {
                    // Save document to storage
                    const documentId = await boardStorage.saveDocument(
                      file.name,
                      file,
                      extractedResult.text,
                      currentBoardId || 'temp',
                    )
                    
                    // Create document node
                    const documentNode = createDocumentNode(
                      file,
                      documentId,
                      documentPositions[i],
                      extractedResult.text
                    )
                    
                    documentNodes.push({ ...documentNode, id: `doc-${i}` })
                  } catch (error) {
                    console.error('Failed to create document node:', error)
                  }
                }
              }
            }
            
            const allNodes = [centerNode, ...subtopicNodes, ...documentNodes]
            setNodes(layoutMindMap(allNodes, edges))
            setEdges(edges)
          } catch (err) {
            setBrainstormError(err instanceof Error ? err.message : 'Brainstorming failed')
            setNodes([
              {
                id: 'ai-fail',
                type: 'default',
                position: { x: 400, y: 200 },
                data: { label: 'AI could not generate a brainstorm map. Try again or check your API key.' }
              }
            ])
            setEdges([])
          } finally {
            setBrainstorming(false)
          }
        }}
        onClose={() => {
          setShowSetup(false)
          onOpenBoardRoom()
        }}
      />
{(isGenerating || vectorizing || brainstorming) && (
  <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg text-center">
      <div className="mb-4 text-lg font-semibold">{brainstorming ? 'Brainstorming your map...' : vectorizing ? 'Processing documents...' : 'Generating your board...'}</div>
      <div className="text-gray-500">{brainstorming ? 'AI is creating a brainstorm map from your context.' : vectorizing ? 'Extracting and vectorizing your uploaded files.' : 'AI is thoughtfully creating your starting nodes.'}</div>
    </div>
  </div>
)}
{brainstormError && (
  <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 text-red-800 px-4 py-2 rounded shadow">
    Brainstorm Error: {brainstormError}
  </div>
)}
      {aiError && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 z-50 bg-red-100 text-red-800 px-4 py-2 rounded shadow">
          AI Error: {aiError}
        </div>
      )}
      {boardBrief && showPreSession && (
        <PreSessionChat
          boardBrief={boardBrief}
          onReady={chat => {
            setBoardBrief({ ...boardBrief, isReady: true, preSessionChat: chat })
            setShowPreSession(false)
          }}
        />
      )}
      {boardBrief && boardBrief.isReady && !showSetup && !showPreSession && (
        <>
          {/* Topic display, board UI, etc. */}
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40">
            <TopicDisplay topic={topic} onEdit={() => {}} />
          </div>
          {/* ...rest of board UI... */}
        </>
      )}
    </div>
  )
} 
