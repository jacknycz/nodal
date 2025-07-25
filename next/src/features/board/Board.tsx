'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  ConnectionMode,
  MarkerType,
  type Connection,
  ReactFlowProvider,
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
import AISetupModal from '../../components/AISetupModal';
import { useReactFlow } from '@xyflow/react'
import { useAIContext } from '../ai/aiContext'

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

function BoardContent({ onBoardStateChange, initialBoard, onOpenBoardRoom, pendingBoardBrief, clearPendingBoardBrief }: BoardProps) {
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
  const [showAISetup, setShowAISetup] = useState(false);
  const reactFlowInstance = useReactFlow();
  const [hasFitView, setHasFitView] = useState(false);
  
  // AI Context
  const aiContext = useAIContext();

  // Refs for autosave
  const autosaveTimeoutRef = useRef<number | null>(null)
  const lastSavedDataRef = useRef<string>('')
  const lastChangeRef = useRef<string>('')

  // Save/Load functionality
  const saveBoard = useCallback(async (name?: string) => {
    if (nodes.length === 0 && edges.length === 0) {
      console.log('No content to save')
      return
    }

    setSaveStatus('saving')
    
    try {
      const boardData = {
        nodes,
        edges,
        viewport,
        topic: topic || null
      }

      const dataString = JSON.stringify(boardData)
      
      // Check if data has actually changed
      if (dataString === lastSavedDataRef.current) {
        setSaveStatus('saved')
        return
      }

      if (localBoardId && !name) {
        // Update existing board
        await boardStorage.updateBoard(localBoardId, boardData)
        console.log('Board updated:', localBoardId)
      } else {
        // Save as new board
        const boardName = name || `Board ${new Date().toLocaleDateString()}`
        const boardId = await boardStorage.saveBoard(boardName, boardData)
        setLocalBoardId(boardId)
        setCurrentBoardName(boardName)
        console.log('Board saved:', boardId)
      }

      lastSavedDataRef.current = dataString
      setSaveStatus('saved')
      setHasUnsavedChanges(false)
      
      // Notify parent component
      onBoardStateChange(currentBoardName, 'saved', false)
    } catch (error) {
      console.error('Failed to save board:', error)
      setSaveStatus('error')
      onBoardStateChange(currentBoardName, 'error', true)
    }
  }, [nodes, edges, viewport, topic, localBoardId, currentBoardName, onBoardStateChange])

  // Save As functionality
  const handleSaveAs = useCallback((name: string) => {
    saveBoard(name)
    setShowSaveModal(false)
  }, [saveBoard])

  // Load board functionality
  const loadBoard = useCallback(async (board: SavedBoard) => {
    setIsLoadingBoard(true)
    setSaveStatus('saving')
    
    try {
      // Clear current board
      clearBoard()
      
      // Load board data
      setNodes(board.data.nodes)
      setEdges(board.data.edges)
      updateViewport(board.data.viewport)
      
      if (board.data.topic) {
        setTopic(board.data.topic)
      }
      
      setLocalBoardId(board.id)
      setCurrentBoardName(board.name)
      setSaveStatus('saved')
      setHasUnsavedChanges(false)
      
      // Notify parent component
      onBoardStateChange(board.name, 'saved', false)
      
      console.log('Board loaded:', board.name)
    } catch (error) {
      console.error('Failed to load board:', error)
      setSaveStatus('error')
      onBoardStateChange(undefined, 'error', false)
    } finally {
      setIsLoadingBoard(false)
    }
  }, [clearBoard, setNodes, setEdges, updateViewport, setTopic, onBoardStateChange])

  // Initialize board from props
  useEffect(() => {
    if (initialBoard) {
      loadBoard(initialBoard)
    } else if (pendingBoardBrief) {
      // Create new board from brief
      setTopic(pendingBoardBrief.topic || '')
      setCurrentBoardName(pendingBoardBrief.topic || 'New Board')
      setHasUnsavedChanges(true)
      onBoardStateChange(pendingBoardBrief.topic, 'unsaved', true)
      
      if (clearPendingBoardBrief) {
        clearPendingBoardBrief()
      }
    }
  }, [initialBoard, pendingBoardBrief, loadBoard, setTopic, onBoardStateChange, clearPendingBoardBrief])

  // Track changes for autosave
  useEffect(() => {
    const currentData = JSON.stringify({ nodes, edges })
    
    if (nodes.length > 0 || edges.length > 0) {
      setHasUnsavedChanges(true)
      
      // Only call onBoardStateChange if data actually changed
      if (currentData !== lastChangeRef.current) {
        onBoardStateChange(currentBoardName, 'unsaved', true)
        lastChangeRef.current = currentData
        
        // Schedule autosave
        if (autosaveTimeoutRef.current) {
          clearTimeout(autosaveTimeoutRef.current)
        }
        autosaveTimeoutRef.current = window.setTimeout(() => {
          if (hasUnsavedChanges && localBoardId) {
            saveBoard()
          }
        }, 2000)
      }
    }
  }, [nodes, edges, currentBoardName, onBoardStateChange, hasUnsavedChanges, localBoardId, saveBoard])

  // Load existing board names for duplicate checking
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

  // Cleanup autosave on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (event.key) {
        case 'n':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            const center = getViewportCenter()
            addNode('New Node', center)
          }
          break
        case 'g':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            setShowAIGenerator(true)
          }
          break
        case 'c':
          if (event.ctrlKey || event.metaKey && event.shiftKey) {
            event.preventDefault()
            clearBoard()
          }
          break
        case 's':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            saveBoard()
          }
          break
        case 'Escape':
          setContextMenu(null)
          setShowAIGenerator(false)
          setShowTopicModal(false)
          setShowTaskList(false)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [addNode, clearBoard, getViewportCenter, setShowAIGenerator, saveBoard])

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
    
    // Check if AI is configured
    if (!aiContext.isInitialized) {
      setShowAISetup(true)
      setContextMenu(null)
      return
    }
    
    setShowAIGenerator(true)
    setContextMenu(null)
  }

  // Handle connections between nodes
  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return

    const sourceNode = getNodeById(nodes, connection.source)
    const targetNode = getNodeById(nodes, connection.target)

    if (!sourceNode || !targetNode) return

    // Check if connection is allowed
    const validation = canCreateConnection(edges, connection.source, connection.target)
    if (!validation.valid) {
      console.log('Connection not allowed:', validation.reason)
      return
    }

    // Add the edge using the proper function signature
    addEdge(connection.source, connection.target, {
      label: `${sourceNode.data.title || 'Node'} → ${targetNode.data.title || 'Node'}`,
    })
  }, [nodes, edges, addEdge])

  return (
    <div className="w-full h-full relative">
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
        connectionLineStyle={connectionLineStyle}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        className="bg-gray-50 dark:bg-gray-900"
        onPaneContextMenu={handleContextMenu}
        onPaneClick={closeContextMenu}
      >
        <Controls />
        <Background />
      </ReactFlow>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-2"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            onClick={handleAddBlankNode}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
          >
            Add Blank Node
          </button>
          <button
            onClick={handleGenerateAINodes}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
          >
            Generate AI Nodes
          </button>
        </div>
      )}

      {/* Floating Action Button */}
      <FloatingActionButton
        onAddNode={() => {
          const center = getViewportCenter()
          addNode('New Node', center)
        }}
        onOpenAIGenerator={() => {
          if (!aiContext.isInitialized) {
            setShowAISetup(true)
          } else {
            setShowAIGenerator(true)
          }
        }}
        onClearBoard={clearBoard}
        onReorganize={() => {
          // TODO: Implement reorganize
          console.log('Reorganize clicked')
        }}
        hasNodes={nodes.length > 0}
      />

      {/* Chat Panel */}
      {showChat && (
        <ChatPanel
          selectionContext={selectionContext}
          onSelectionContextUsed={() => setSelectionContext(undefined)}
          nodes={nodes}
          edges={edges}
          onNodesGenerated={(generatedNodes) => {
            generatedNodes.forEach(node => addNode(node.data.title || 'Generated Node', node.position))
          }}
          onAISetupRequested={() => setShowAISetup(true)}
        />
      )}

      {/* Status Bar */}
      <div className="fixed bottom-4 left-4 z-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <span>{nodes.length} nodes</span>
          <span>{edges.length} connections</span>
          <div className="relative">
            <button
              onClick={() => {
                if (localBoardId) {
                  saveBoard() // Quick save existing board
                } else {
                  setShowSaveModal(true) // Show save modal for new board
                }
              }}
              disabled={saveStatus === 'saving' || (nodes.length === 0 && edges.length === 0)}
              className={`px-2 py-1 rounded text-xs transition-colors ${
                saveStatus === 'saving' 
                  ? 'bg-yellow-100 text-yellow-800 cursor-not-allowed' :
                saveStatus === 'error' 
                  ? 'bg-red-100 text-red-800 hover:bg-red-200' :
                hasUnsavedChanges 
                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' :
                  'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title={saveStatus === 'saving' ? 'Saving...' : localBoardId ? 'Save Board (Ctrl+S)' : 'Save Board As...'}
            >
              {saveStatus === 'saving' ? 'Saving...' : localBoardId ? 'Save' : 'Save As...'}
            </button>
            {localBoardId && (
              <button
                onClick={() => setShowSaveModal(true)}
                className="ml-1 px-1 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                title="Save As..."
              >
                ...
              </button>
            )}
          </div>
          {saveStatus !== 'saved' && saveStatus !== 'saving' && (
            <span className={`px-2 py-1 rounded text-xs ${
              saveStatus === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {saveStatus}
            </span>
          )}
        </div>
      </div>

      {/* Topic Display */}
      <TopicDisplay topic={topic || undefined} onEdit={() => setShowTopicModal(true)} />

      {/* Task List Toggle */}
      <button
        onClick={() => setShowTaskList(!showTaskList)}
        className="fixed top-4 right-4 z-40 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
        title="Toggle Task List"
      >
        <List className="w-5 h-5" />
      </button>

      {/* Task List */}
      {showTaskList && (
        <TaskList />
      )}

      {/* Tips Bubble */}
      {showTips && (
        <TipsBubble tips={[
          'Right-click anywhere on the canvas to add nodes',
          'Use the floating action button (bottom right) for quick actions',
          'Drag nodes to reposition them',
          'Connect nodes by dragging from one node to another',
          'Use keyboard shortcuts for faster workflow',
          'Press Ctrl+S to save your board'
        ]} />
      )}

      {/* AI Node Generator Modal */}
      {showAIGenerator && (
        <AINodeGenerator
          isOpen={showAIGenerator}
          onClose={() => setShowAIGenerator(false)}
          existingNodes={nodes}
          onGenerate={(generatedNodes) => {
            generatedNodes.forEach(node => addNode(node.data.title || 'Generated Node', node.position))
          }}
        />
      )}

      {/* AI Setup Modal */}
      {showAISetup && (
        <AISetupModal
          isOpen={showAISetup}
          onClose={() => setShowAISetup(false)}
        />
      )}

      {/* Topic Modal */}
      {showTopicModal && (
        <TopicModal
          isOpen={showTopicModal}
          onClose={() => setShowTopicModal(false)}
          onSave={(newTopic) => {
            setTopic(newTopic)
            setShowTopicModal(false)
          }}
          defaultTopic={topic || ''}
        />
      )}

      {/* Board Name Modal */}
      {showSaveModal && (
        <BoardNameModal
          isOpen={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          onSave={handleSaveAs}
          defaultName={currentBoardName || `Board ${new Date().toLocaleDateString()}`}
          existingNames={existingBoardNames}
        />
      )}
    </div>
  )
}

export default function Board(props: BoardProps) {
  return (
    <ReactFlowProvider>
      <BoardContent {...props} />
    </ReactFlowProvider>
  )
}