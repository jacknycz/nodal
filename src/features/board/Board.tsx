import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  MarkerType,
  type Connection,
} from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'
import { useBoard } from './useBoard'
import { useBoardStore } from './boardSlice'
import { canCreateConnection, getConnectionType, getNodeById, findNonOverlappingPositions } from './boardUtils'
import NodalNode from '../nodes/nodalNode'
import DocumentNode from '../nodes/DocumentNode'
import FloatingEdge from './FloatingEdge'
import CustomConnectionLine from './CustomConnectionLine'
import FloatingActionButton from '../../components/FloatingActionButton'
import AINodeGenerator from '../../components/AINodeGenerator'
import BoardNameModal from '../../components/BoardNameModal'
import BokehBackground from '../../components/BokehBackground'
import ChatPanel from '../../components/ChatPanel'

import TopicModal from '../../components/TopicModal'
import TopicDisplay from '../../components/TopicDisplay'
import { useViewportCenter } from '../../hooks/useViewportCenter'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { boardStorage, type SavedBoard } from '../storage/storage'
import {
  extractTextFromFile,
  validateFile,
  createDocumentNode
} from '../nodes/documentUtils'
import BoardSetupModal from '../../components/BoardSetupModal'
import PreSessionChat from '../../components/PreSessionChat'
import { useAINodeGenerator } from '../ai/useAINodeGenerator'
import { useAI } from '../ai/useAI'
import AIClient from '../ai/aiClient'
import { useFocusStore } from '../focus/focusSlice';
import { useFocusTree } from '../focus/useFocusTree';
import TaskList from '../../components/TaskList';
import { List, X } from 'lucide-react';
import TipsBubble from '../../components/TipsBubble';
import LearnModal from '../../components/LearnModal';
import { useReactFlow } from '@xyflow/react'

import '@xyflow/react/dist/style.css'
import type { BoardNode, BoardEdge, BoardBrief } from './boardTypes'

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

interface BoardProps {
  onBoardStateChange: (
    boardName: string | undefined,
    saveStatus: SaveStatus,
    hasUnsavedChanges: boolean
  ) => void
  initialBoard?: any
  onOpenBoardRoom: () => void
  pendingBoardBrief?: BoardBrief | null
  clearPendingBoardBrief?: () => void
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
  color: '#fff',
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

export default function Board({ onBoardStateChange, initialBoard, onOpenBoardRoom, pendingBoardBrief, clearPendingBoardBrief }: BoardProps) {
  const [_showBoardRoom, setShowBoardRoom] = useState(false)
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

  const { topic, setTopic, boardBrief, setBoardBrief, setCurrentBoardId, setEmbeddings } = useBoardStore()
  const embeddings = useBoardStore(state => state.embeddings)
  const { getViewportCenter } = useViewportCenter()
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [showChat, setShowChat] = useState(true) // Auto-open to show new system
  const [currentBoardName, setCurrentBoardName] = useState<string | undefined>(undefined)
  const [localBoardId, setLocalBoardId] = useState<string | undefined>(undefined) // Renamed to avoid conflict
  const [existingBoardNames, setExistingBoardNames] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [showSetup, setShowSetup] = React.useState(false); // was: !boardBrief
  const [showPreSession, setShowPreSession] = React.useState(false)
  const [isLoadingBoard, setIsLoadingBoard] = useState(false) // Add this flag
  const [showTaskList, setShowTaskList] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const reactFlowInstance = useReactFlow();
  const [hasFitView, setHasFitView] = useState(false);

  // Refs for autosave
  const autosaveTimeoutRef = useRef<number | null>(null)
  const lastSavedDataRef = useRef<string>('')

  // Upload state
  const [_isDragOver, setIsDragOver] = useState(false)
  const [uploadError, setUploadError] = useState<string>('')

  // Selection context state
  const [selectionContext, setSelectionContext] = useState<string | undefined>(undefined)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; boardX: number; boardY: number } | null>(null)

  // Update handleContextMenu to use reactFlowInstance.project
  const handleContextMenu = (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => {
    event.preventDefault()
    // Use clientX/clientY from either event type
    const clientX = 'clientX' in event ? event.clientX : 0
    const clientY = 'clientY' in event ? event.clientY : 0
    let boardCoords = { x: clientX, y: clientY }
    if (reactFlowInstance && typeof (reactFlowInstance as any).project === 'function') {
      boardCoords = (reactFlowInstance as any).project({ x: clientX, y: clientY })
    }
    setContextMenu({ x: clientX, y: clientY, boardX: boardCoords.x, boardY: boardCoords.y })
  }

  // Add a closeContextMenu function for reuse
  const closeContextMenu = useCallback(() => setContextMenu(null), [])

  // Add blank node at context menu position
  const handleAddBlankNode = () => {
    if (contextMenu) {
      console.log('Adding blank node at', contextMenu.boardX, contextMenu.boardY)
      addNode('New Node', { x: contextMenu.boardX, y: contextMenu.boardY })
      setContextMenu(null)
    }
  }

  // Open AI Node Generator (at position if needed)
  const handleGenerateAINodes = () => {
    console.log('Generate AI Nodes clicked')
    setShowAIGenerator(true)
    setContextMenu(null)
  }

  // Create a hash of the current board state for change detection
  const getCurrentDataHash = useCallback(() => {
    const data = { nodes, edges }
    return JSON.stringify(data)
  }, [nodes, edges])

  // Auto-save function
  const autoSave = useCallback(async () => {
    if (!localBoardId || !currentBoardName) return // Use localBoardId

    try {
      const currentData = getCurrentDataHash()
      if (currentData === lastSavedDataRef.current) return

      setSaveStatus('saving')
      const boardData = {
        nodes,
        edges,
        viewport: viewport || { x: 0, y: 0, zoom: 1 },
        topic // Add topic to saved data
      }

      console.log('🔄 Auto-saving board with topic:', topic) // Add console log
      await boardStorage.updateBoard(localBoardId, boardData) // Use localBoardId
      lastSavedDataRef.current = currentData
      setHasUnsavedChanges(false)
      setSaveStatus('saved')
      console.log('✅ Auto-save completed with topic:', topic) // Add console log
    } catch (error) {
      console.error('Auto-save failed:', error)
      setSaveStatus('error')
    }
  }, [nodes, edges, viewport, topic, localBoardId, currentBoardName, getCurrentDataHash]) // Add topic to dependencies

  // Robust debounced auto-save
  useEffect(() => {
    const debounceMs = 2500
    let cancelled = false

    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }

    const currentData = getCurrentDataHash()
    if (currentData !== lastSavedDataRef.current) {
      setHasUnsavedChanges(true)
      setSaveStatus('unsaved')
      autosaveTimeoutRef.current = window.setTimeout(async () => {
        if (!cancelled) {
          await autoSave()
        }
      }, debounceMs)
    }

    return () => {
      cancelled = true
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

  // Add effect to handle AI-assisted board creation
  useEffect(() => {
    if (pendingBoardBrief) {
      (async () => {
        setBrainstorming(true);
        setBrainstormError(null);
        try {
          // Build context string
          const docText = (embeddings || []).map(d => `Document: ${d.fileName}\n${d.text.slice(0, 2000)}`).join('\n\n');
          const context = `Topic: ${pendingBoardBrief.topic}\nRamble: ${pendingBoardBrief.ramble || ''}\nGoal: ${pendingBoardBrief.goal}\nAudience: ${pendingBoardBrief.audience}\nResources: ${pendingBoardBrief.resources.join(', ')}\nNotes: ${pendingBoardBrief.notes || ''}\n${docText}`;
          const brainstormPrompt = `Given the following context, generate a brainstorm map for a mindmap app.\n\nContext:\n${context}\n\nInstructions:\n- Suggest the best central node (if not obvious, use the topic)\n- Brainstorm as many relevant subtopics as make sense (not just 4), each as a prompt or question to explore\n- Optionally, group or cluster subtopics if themes emerge\n- Respond in JSON with this structure:\n{\n  'center': 'Central Node Title',\n  'subtopics': [\n    { 'title': 'Subtopic', 'prompt': 'Prompt or question', 'group': 'Group Name (optional)' },\n    ...\n  ]\n}`;
          const response = await ai.generate(brainstormPrompt, {
            model: 'gpt-4o',
            temperature: 0.7,
            maxTokens: 1200,
            systemPrompt: 'You are a helpful brainstorming assistant for a mindmap app.'
          });
          let brainstorm;
          try {
            let raw = response.content.trim();
            if (raw.startsWith('```')) {
              raw = raw.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
            }
            brainstorm = JSON.parse(raw);
          } catch (e) {
            throw new Error('AI did not return valid JSON. Raw response: ' + response.content);
          }
          // Create nodes and edges
          const centerPosition = { x: 400, y: 300 };
          const centerNode = {
            id: 'center',
            type: 'default',
            position: centerPosition,
            data: { title: brainstorm.center, content: '', aiGenerated: true }
          };
          const subtopicPositions = findNonOverlappingPositions(
            centerPosition,
            brainstorm.subtopics.length,
            [],
            180,
            40
          );
          const subtopicNodes = brainstorm.subtopics.map((s: any, i: number) => ({
            id: `subtopic-${i}`,
            type: 'default',
            position: subtopicPositions[i],
            data: { title: s.title, content: s.prompt, group: s.group, aiGenerated: true }
          }));
          const edges = subtopicNodes.map((n: any) => ({
            id: `edge-center-${n.id}`,
            source: 'center',
            target: n.id,
            type: 'floating',
            data: { type: 'ai' }
          }));
          // Save the new board
          const boardName = pendingBoardBrief.topic || 'New Board';
          const initialBoardData = {
            nodes: [centerNode, ...subtopicNodes],
            edges,
            viewport: { x: 0, y: 0, zoom: 1 },
            boardBrief: { ...pendingBoardBrief },
            topic: pendingBoardBrief.topic
          };
          const boardId = await boardStorage.saveBoard(boardName, initialBoardData);
          const newBoard = await boardStorage.loadBoard(boardId);
          if (newBoard) {
            setNodes(layoutMindMap([centerNode, ...subtopicNodes], edges));
            setEdges(edges);
            setTopic(pendingBoardBrief.topic);
            setBoardBrief(pendingBoardBrief);
            setLocalBoardId(boardId);
            setCurrentBoardId(boardId);
            setCurrentBoardName(boardName);
            if (clearPendingBoardBrief) clearPendingBoardBrief();
          }
        } catch (err) {
          setBrainstormError(err instanceof Error ? err.message : 'Brainstorming failed');
          setNodes([
            {
              id: 'ai-fail',
              type: 'default',
              position: { x: 400, y: 200 },
              data: { title: 'AI could not generate a brainstorm map. Try again or check your API key.' }
            }
          ]);
          setEdges([]);
          if (clearPendingBoardBrief) clearPendingBoardBrief();
        } finally {
          setBrainstorming(false);
        }
      })();
    }
  }, [pendingBoardBrief, clearPendingBoardBrief, embeddings]);

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
    const _handleExportBoard = () => {
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
    const _handleImportBoard = () => {
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

  const { generateNode: _generateNode, isGenerating, error: aiError } = useAINodeGenerator()
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

    // --- Attach DocumentNode as media if connected to NodalNode ---
    // If source is document and target is nodal, or vice versa
    const isSourceDocument = sourceNode.data.type === 'document';
    const isTargetDocument = targetNode.data.type === 'document';
    if (isSourceDocument && !isTargetDocument) {
      // Add source (document) to target's media
      const currentMedia = targetNode.data.media || [];
      if (!currentMedia.includes(sourceNode.id)) {
        updateNode(targetNode.id, {
          data: { ...targetNode.data, media: [...currentMedia, sourceNode.id] }
        });
      }
    } else if (!isSourceDocument && isTargetDocument) {
      // Add target (document) to source's media
      const currentMedia = sourceNode.data.media || [];
      if (!currentMedia.includes(targetNode.id)) {
        updateNode(sourceNode.id, {
          data: { ...sourceNode.data, media: [...currentMedia, targetNode.id] }
        });
      }
    }
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
          localBoardId || 'temp', // Use localBoardId
        )
        // Create document node (now async)
        const documentNode = await createDocumentNode(
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
  }, [addNode, getViewportCenter, localBoardId, edges, setNodes]) // Use localBoardId

  // Add a manual reset function in case drag state gets stuck
  const _resetDragState = useCallback(() => {
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

    const handleWindowDragEnd = (_e: DragEvent) => {
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

  async function triggerThumbnailGeneration(boardId: string) {
    try {
      await fetch('https://nodal-steel.vercel.app/api/generate-thumbnail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId })
      });
      // Optionally, handle response or errors
    } catch (err) {
      console.error('Failed to trigger thumbnail generation:', err);
    }
  }

  const _handleSaveBoard = async (boardName: string) => {
    try {
      setSaveStatus('saving')
      const boardData = {
        nodes,
        edges,
        viewport: viewport || { x: 0, y: 0, zoom: 1 },
        topic // Add topic to saved data
      }

      console.log('💾 Manual save - saving board with topic:', topic) // Add console log
      console.log('Save attempt:', {
        boardName,
        localBoardId, // Use localBoardId
        currentBoardName,
        condition: localBoardId && currentBoardName === boardName // Use localBoardId
      })

      let boardId = localBoardId;
      if (localBoardId && currentBoardName === boardName) { // Use localBoardId
        // Update existing board
        await boardStorage.updateBoard(localBoardId, boardData) // Use localBoardId
        console.log('✅ Board updated successfully with topic:', topic) // Add console log
      } else {
        // Save new board
        boardId = await boardStorage.saveBoard(boardName, boardData)
        setLocalBoardId(boardId) // Use localBoardId
        setCurrentBoardId(boardId) // Set in store
        setCurrentBoardName(boardName)
        console.log('✅ Board saved successfully! New ID:', boardId, 'with topic:', topic) // Add console log
      }

      // Update tracking state
      lastSavedDataRef.current = getCurrentDataHash()
      setHasUnsavedChanges(false)
      setSaveStatus('saved')

      // Refresh board names list
      const names = await boardStorage.getBoardNames()
      setExistingBoardNames(names)

      // Trigger thumbnail generation on Vercel after save
      if (boardId) {
        triggerThumbnailGeneration(boardId);
      }
    } catch (error) {
      console.error('Failed to save board:', error)
      setSaveStatus('error')
      // TODO: Show error toast
    }
  }

  const handleLoadBoard = async (board: SavedBoard) => {
    try {
      setIsLoadingBoard(true) // Set loading flag
      // console.log('📂 Loading board:', board)
      // console.log('📂 Board data:', board.data)
      // console.log('📂 Saved topic in board data:', board.data.topic) // Add console log
      // console.log('📂 Nodes to set:', board.data.nodes)
      // console.log('📂 Edges to set:', board.data.edges)

      // Use the board data directly - no need to reload from storage
      setNodes(layoutMindMap(board.data.nodes, board.data.edges))
      setEdges(board.data.edges)
      updateViewport(board.data.viewport)

      // Restore topic if it exists in the saved data
      if (board.data.topic) {
        console.log('🔄 Restoring topic from saved data:', board.data.topic) // Add console log
        setTopic(board.data.topic)
      } else {
        console.log('⚠️ No topic found in saved board data') // Add console log
      }

      setLocalBoardId(board.id) // Use localBoardId
      setCurrentBoardId(board.id) // Set in store
      setCurrentBoardName(board.name)
      lastSavedDataRef.current = getCurrentDataHash() // Use the same format as getCurrentDataHash
      setHasUnsavedChanges(false)
      setSaveStatus('saved')
      console.log('✅ Board loaded successfully!') // Add console log
    } catch (error) {
      console.error('Failed to load board:', error)
      // TODO: Show error toast
    } finally {
      setIsLoadingBoard(false) // Clear loading flag
    }
  }

  const _handleRenameBoard = async (boardId: string, newName: string) => {
    try {
      await boardStorage.renameBoard(boardId, newName)

      // If we renamed the current board, update the current board name
      if (boardId === localBoardId) { // Use localBoardId
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

  const _handleDeleteBoard = async (boardId: string) => {
    try {
      await boardStorage.deleteBoard(boardId)

      // If we deleted the current board, clear the current board tracking
      if (boardId === localBoardId) { // Use localBoardId
        setLocalBoardId(undefined) // Use localBoardId
        setCurrentBoardId(undefined) // Clear from store
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
    setLocalBoardId(undefined) // Use localBoardId
    setCurrentBoardId(undefined) // Clear from store
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

  const _handleOpenChatWithSelection = (context: string) => {
    setSelectionContext(context)
    setShowChat(true)
  }

  const handleSelectionContextUsed = () => {
    setSelectionContext(undefined)
  }

  // Show topic modal on new/empty board (but not during loading or when initialBoard exists)
  useEffect(() => {
    if (!isLoadingBoard && !topic && nodes.length === 0 && !initialBoard) {
      setShowTopicModal(true)
    }
  }, [topic, nodes.length, isLoadingBoard, initialBoard])

  // Handler for saving topic
  const handleSaveTopic = (newTopic: string) => {
    console.log('🎯 Setting topic:', newTopic) // Add console log
    setTopic(newTopic)
  }

  // Handler for editing topic
  const handleEditTopic = () => {
    setShowTopicModal(true)
  }

  const [vectorizing, setVectorizing] = useState(false)
  const [_vectorizationError, setVectorizationError] = useState<string | null>(null)
  const [brainstorming, setBrainstorming] = useState(false)
  const [brainstormError, setBrainstormError] = useState<string | null>(null)
  const aiConfig = {
    apiKey: import.meta.env.VITE_OPENAI_API_KEY,
    baseUrl: import.meta.env.VITE_OPENAI_BASE_URL || 'https://api.openai.com/v1',
  }
  const aiClient = new AIClient(aiConfig)

  const updateNode = useBoardStore(state => state.updateNode);
  const setSelectedNode = useBoardStore(state => state.setSelectedNode);

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
    const _nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))
    const rootId = getRootNodeId(nodes, edges)
    if (!rootId) return nodes
    const placed: Record<string, { x: number; y: number }> = {}
    const _maxNodeWidth = 600
    const _nodeHeight = 120
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
      const _arcEnd = arcCenter + arcSpan / 2
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

  // Utility to find all clusters (connected components) in the graph
  function findClusters(nodes: BoardNode[], edges: BoardEdge[]): string[][] {
    const nodeIds = nodes.map(n => n.id);
    const visited = new Set<string>();
    const clusters: string[][] = [];
    const adjacency: Record<string, Set<string>> = {};
    nodeIds.forEach(id => (adjacency[id] = new Set()));
    edges.forEach(e => {
      adjacency[e.source]?.add(e.target);
      adjacency[e.target]?.add(e.source);
    });
    for (const id of nodeIds) {
      if (!visited.has(id)) {
        const cluster: string[] = [];
        const queue = [id];
        visited.add(id);
        while (queue.length) {
          const curr = queue.shift()!;
          cluster.push(curr);
          for (const neighbor of adjacency[curr]) {
            if (!visited.has(neighbor)) {
              visited.add(neighbor);
              queue.push(neighbor);
            }
          }
        }
        clusters.push(cluster);
      }
    }
    return clusters;
  }

  function layoutMindMapAll(nodes: BoardNode[], edges: BoardEdge[], center = { x: 400, y: 300 }) {
    if (nodes.length === 0) return [];
    const clusters = findClusters(nodes, edges);
    const _nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
    const layouts: { [id: string]: { x: number; y: number } } = {};
    const clusterLayouts: BoardNode[][] = [];
    const loners: BoardNode[] = [];

    // Separate clusters into loners and groups
    for (const cluster of clusters) {
      if (cluster.length === 1) {
        loners.push(_nodeMap[cluster[0]]);
      } else {
        // Layout this cluster as a mindmap
        const clusterNodes = cluster.map(id => _nodeMap[id]);
        const clusterEdges = edges.filter(e => cluster.includes(e.source) && cluster.includes(e.target));
        // Use the existing layoutMindMap for this cluster, centered at (0,0) for now
        const clusterLayout = layoutMindMap(clusterNodes, clusterEdges, { x: 0, y: 0 });
        clusterLayouts.push(clusterLayout);
      }
    }

    // Arrange clusters in a grid, centered
    const totalClusters = clusterLayouts.length + (loners.length > 0 ? 1 : 0);
    const gridCols = Math.ceil(Math.sqrt(totalClusters));
    const gridRows = Math.ceil(totalClusters / gridCols);
    const clusterBoxSize = 1200; // space for each cluster
    let clusterIndex = 0;
    for (let row = 0; row < gridRows; row++) {
      for (let col = 0; col < gridCols; col++) {
        if (clusterIndex >= clusterLayouts.length) break;
        const offsetX = center.x + (col - (gridCols - 1) / 2) * clusterBoxSize;
        const offsetY = center.y + (row - (gridRows - 1) / 2) * clusterBoxSize;
        for (const n of clusterLayouts[clusterIndex]) {
          layouts[n.id] = {
            x: n.position.x + offsetX,
            y: n.position.y + offsetY,
          };
        }
        clusterIndex++;
      }
    }

    // Lay out loners in a square grid, centered below clusters
    if (loners.length > 0) {
      const lonerGridCols = Math.ceil(Math.sqrt(loners.length));
      const _lonerGridRows = Math.ceil(loners.length / lonerGridCols);
      const lonerSpacing = 220;
      const lonerStartX = center.x - ((lonerGridCols - 1) * lonerSpacing) / 2;
      const lonerStartY = center.y + (gridRows * clusterBoxSize) / 2 + 200;
      loners.forEach((n, i) => {
        const col = i % lonerGridCols;
        const row = Math.floor(i / lonerGridCols);
        layouts[n.id] = {
          x: lonerStartX + col * lonerSpacing,
          y: lonerStartY + row * lonerSpacing,
        };
      });
    }

    // Return all nodes with new positions
    return nodes.map(n => ({ ...n, position: layouts[n.id] || n.position }));
  }

  // --- Handler for Reorganize ---
  const handleReorganize = useCallback(() => {
    const newNodes = layoutMindMapAll(nodes, edges);
    setNodes(newNodes);
  }, [nodes, edges, setNodes]);

  const { enterFocusMode: _enterFocusMode, focusedNodeId: _focusedNodeId, setFocusTree: _setFocusTree } = useFocusStore();
  const { focusTreeNodes } = useFocusTree();
  const { selectedNode, selectedNodeId } = useBoard();

  // Compute selection context for chat
  let chatSelectionContext: string | undefined = undefined;
  // Collect unique nodes: focusTreeNodes + selectedNode (if not already included)
  let contextNodes = [...focusTreeNodes];
  if (selectedNode && !focusTreeNodes.some(n => n.id === selectedNode.id)) {
    contextNodes.push(selectedNode);
  }
  if (contextNodes.length > 0) {
    const titles = contextNodes.map(n => n.data.title || 'Untitled').filter(Boolean);
    if (titles.length === 1) {
      chatSelectionContext = `**${titles[0]}**`;
    } else if (titles.length === 2) {
      chatSelectionContext = `**${titles[0]}**, **${titles[1]}**`;
    } else if (titles.length > 2) {
      chatSelectionContext = titles.map(t => `**${t}**`).join(', ');
    }
  }

  // Handler for AI-assisted board setup completion
  const handleBoardSetupComplete = async (brief: BoardBrief) => {
    setBoardBrief(brief);
    setTopic(brief.topic);
    setShowSetup(false);
    // --- AI Brainstorm Node Generation ---
    setBrainstorming(true);
    setBrainstormError(null);
    try {
      // Build a context string from all onboarding info and extracted doc text
      const docText = (embeddings || []).map(d => `Document: ${d.fileName}\n${d.text.slice(0, 2000)}`).join('\n\n');
      const context = `Topic: ${brief.topic}\nRamble: ${brief.ramble || ''}\nGoal: ${brief.goal}\nAudience: ${brief.audience}\nResources: ${brief.resources.join(', ')}\nNotes: ${brief.notes || ''}\n${docText}`;
      const brainstormPrompt = `Given the following context, generate a brainstorm map for a mindmap app.\n\nContext:\n${context}\n\nInstructions:\n- Suggest the best central node (if not obvious, use the topic)\n- Brainstorm as many relevant subtopics as make sense (not just 4), each as a prompt or question to explore\n- Optionally, group or cluster subtopics if themes emerge\n- Respond in JSON with this structure:\n{\n  'center': 'Central Node Title',\n  'subtopics': [\n    { 'title': 'Subtopic', 'prompt': 'Prompt or question', 'group': 'Group Name (optional)' },\n    ...\n  ]\n}`;
      console.log('AI Brainstorm Prompt:', brainstormPrompt);
      const response = await ai.generate(brainstormPrompt, {
        model: 'gpt-4o',
        temperature: 0.7,
        maxTokens: 1200,
        systemPrompt: 'You are a helpful brainstorming assistant for a mindmap app.'
      });
      console.log('AI Raw Response:', response.content);
      let brainstorm;
      try {
        let raw = response.content.trim();
        if (raw.startsWith('```')) {
          raw = raw.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '').trim();
        }
        brainstorm = JSON.parse(raw);
        console.log('Parsed brainstorm:', brainstorm);
      } catch (e) {
        console.error('AI brainstorm JSON parse error:', e);
        console.error('Raw response:', response.content);
        throw new Error('AI did not return valid JSON. Raw response: ' + response.content);
      }
      // Create nodes and edges using intelligent positioning
      const centerPosition = { x: 400, y: 300 };
      const centerNode = {
        id: 'center',
        type: 'default',
        position: centerPosition,
        data: { title: brainstorm.center, content: '', aiGenerated: true }
      };
      const subtopicPositions = findNonOverlappingPositions(
        centerPosition,
        brainstorm.subtopics.length,
        [],
        180,
        40
      );
      const subtopicNodes = brainstorm.subtopics.map((s: any, i: number) => ({
        id: `subtopic-${i}`,
        type: 'default',
        position: subtopicPositions[i],
        data: { title: s.title, content: s.prompt, group: s.group, aiGenerated: true }
      }));
      const edges = subtopicNodes.map((n: any) => ({
        id: `edge-center-${n.id}`,
        source: 'center',
        target: n.id,
        type: 'floating',
        data: { type: 'ai' }
      }));
      setNodes(layoutMindMap([centerNode, ...subtopicNodes], edges));
      setEdges(edges);
    } catch (err) {
      console.error('AI brainstorm error:', err);
      setBrainstormError(err instanceof Error ? err.message : 'Brainstorming failed');
      setNodes([
        {
          id: 'ai-fail',
          type: 'default',
          position: { x: 400, y: 200 },
          data: { title: 'AI could not generate a brainstorm map. Try again or check your API key.' }
        }
      ]);
      setEdges([]);
    } finally {
      setBrainstorming(false);
    }
  };

  // Fullscreen logic
  const boardRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const enterFullscreen = () => {
    const el = boardRef.current
    if (el && el.requestFullscreen) {
      el.requestFullscreen()
    } else if (el && (el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen()
    } else if (el && (el as any).msRequestFullscreen) {
      (el as any).msRequestFullscreen()
    }
  }

  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen()
    } else if ((document as any).webkitExitFullscreen) {
      (document as any).webkitExitFullscreen()
    } else if ((document as any).msExitFullscreen) {
      (document as any).msExitFullscreen()
    }
  }

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Tips and Learn modal state
  const [showLearn, setShowLearn] = useState(false);
  const tips = [
    'Double-click to add a node',
    'Drag to pan the board',
    'Right-click for context menu',
    'Use AI to brainstorm',
    'Press Ctrl+F to search nodes',
    'Click a node to edit',
    'Use Free Chat Mode for open conversation',
    'Connect nodes to build your map',
    'Try uploading a PDF',
    'Use the Learn button for more help',
  ];

  useEffect(() => {
    if (
      reactFlowInstance &&
      nodes.length > 0 &&
      !hasFitView
    ) {
      reactFlowInstance.fitView({ padding: 0.3 });
      const { zoom } = reactFlowInstance.getViewport();
      if (zoom < 0.75) {
        reactFlowInstance.zoomTo(0.75);
      }
      if (zoom > 1) {
        reactFlowInstance.zoomTo(1);
      }
      setHasFitView(true);
    }
  }, [reactFlowInstance, nodes.length, hasFitView]);

  // Screenshot mode detection
  const isScreenshotMode = (() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('screenshot') === 'true';
    }
    return false;
  })();

  return (
    <div ref={boardRef} className={`w-full h-full relative${isScreenshotMode ? ' screenshot-mode' : ''}`}>
      {/* Tips Bubble and Learn Button (bottom left) */}
      {!isScreenshotMode && showTips && (
        <div className="fixed bottom-4 left-36 z-50 flex items-center gap-3">
          <div className="flex items-center">
            <button
              className="p-1 rounded-full -mr-2 hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-400 hover:text-red-500 transition"
              style={{ fontSize: '14px' }}
              aria-label="Close tips and learn"
              onClick={() => setShowTips(false)}
              type="button"
            >
              <X className="w-4 h-4" />
            </button>
            <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-full pl-2 pr-4 py-1 -mr-2 ">
              Tips:
            </span>
            <TipsBubble tips={tips} />
          </div>
          <div className="flex items-center">
            <button
              className="px-3 py-1.5 rounded-full bg-primary-600 text-white text-xs font-semibold shadow hover:bg-primary-700 transition"
              onClick={() => setShowLearn(true)}
              type="button"
            >
              Learn
            </button>
          </div>
        </div>
      )}
      {!isScreenshotMode && <LearnModal isOpen={showLearn} onClose={() => setShowLearn(false)} />}
      {/* Fullscreen Button */}
      {!isScreenshotMode && (
        <button
          className="fixed top-50 left-2 z-[10] px-4 py-2 bg-gray-900 text-white rounded shadow hover:bg-gray-800 transition-colors text-xs"
          onClick={isFullscreen ? exitFullscreen : enterFullscreen}
          style={{ minWidth: 90 }}
        >
          {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        </button>
      )}

      {/* Floating Action Button */}
      {!isScreenshotMode && (
        <FloatingActionButton
          onAddNode={handleAddNode}
          onOpenAIGenerator={() => setShowAIGenerator(true)}
          onClearBoard={handleClearBoard}
          onReorganize={handleReorganize}
          hasNodes={nodes.length > 0}
        />
      )}

      {/* Upload error notification */}
      {!isScreenshotMode && uploadError && (
        <div className="absolute top-20 left-4 z-20 bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-200 px-4 py-3 rounded shadow-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-sm">{uploadError}</span>
          </div>
        </div>
      )}

      {/* Chat Panel */}
      {!isScreenshotMode && (
        <ChatPanel
          selectionContext={chatSelectionContext}
          onSelectionContextUsed={handleSelectionContextUsed}
        />
      )}

      {/* AI Node Generator Modal */}
      {!isScreenshotMode && (
        <AINodeGenerator
          isOpen={showAIGenerator}
          onClose={() => setShowAIGenerator(false)}
        />
      )}

      {/* Board Setup Modal (AI Assisted New Board) */}
      {!isScreenshotMode && (
        <BoardSetupModal
          isOpen={showSetup}
          onComplete={handleBoardSetupComplete}
          onClose={() => setShowSetup(false)}
        />
      )}

      {/* Edit Topic Modal */}
      {!isScreenshotMode && (
        <TopicModal
          isOpen={showTopicModal}
          onClose={() => setShowTopicModal(false)}
          onSave={handleSaveTopic}
          defaultTopic={topic || ''}
        />
      )}


      {/* Topic Display */}
      {!isScreenshotMode && (
        <div className="absolute z-40">
          <TopicDisplay topic={topic} onEdit={handleEditTopic} />
          {/* Task List Button and Menu */}
          <button
            className="fixed left-4 top-30 flex items-center justify-center w-10 h-10 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full border border-gray-200 dark:border-gray-700 shadow transition-colors mt-2"
            title="Show board tasks"
            onClick={() => setShowTaskList(v => !v)}
            style={{ zIndex: 41 }}
          >
            <List size={20} className="text-gray-600 dark:text-gray-200" />
          </button>
          {showTaskList && (
            <div className="fixed left-4 top-52 z-40">
              <TaskList />
            </div>
          )}
        </div>
      )}

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
        onPaneContextMenu={handleContextMenu} // <-- use this prop
        onPaneClick={closeContextMenu}
        onNodeClick={(_, node) => setSelectedNode(node.id)}
      >
        <BokehBackground />
        {/* <MiniMap /> */}
        <Controls />
        <Background />
      </ReactFlow>
      {/* Context Menu */}
      {contextMenu && (
        <div
          style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 1000, background: '#fff', border: '1px solid #ccc', borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', minWidth: 160 }}
          onMouseDown={e => e.stopPropagation()} // Prevent menu from closing when clicking inside
        >
          <button style={{ display: 'block', width: '100%', padding: 8, border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => { handleAddBlankNode(); closeContextMenu(); }}>
            Add Blank Node
          </button>
          <button style={{ display: 'block', width: '100%', padding: 8, border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer' }} onClick={() => { handleGenerateAINodes(); closeContextMenu(); }}>
            Generate AI Nodes
          </button>
        </div>
      )}
    </div>
  )
} 
