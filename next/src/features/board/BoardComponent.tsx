'use client'

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Node, 
  Edge, 
  useNodesState, 
  useEdgesState, 
  Connection,
  ReactFlowProvider,
  useReactFlow, 
  Background,
  Controls,
  MiniMap,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
// import html2canvas from 'html2canvas' // Unused for now

import { useBoard } from './useBoard'
import { usePlacement } from './usePlacement'
import { boardStorage } from '../storage/storage'
import { templateStorage } from '../storage/templateStorage'
import DocumentNode from '../nodes/DocumentNode'
import ImageNode from '../nodes/ImageNode'
import NodalNode from '../nodes/nodalNode'
import TaskNode from '../nodes/TaskNode'
import VideoNode from '../nodes/VideoNode'
import { useBoardStore } from './boardSlice'
import FloatingEdge from './FloatingEdge'
import CustomConnectionLine from './CustomConnectionLine'
import FloatingActionButton from '../../components/FloatingActionButton'
import AINodeGenerator from '../../components/AINodeGenerator'
import AddNodesModal from '../../components/AddNodesModal'
import { useAIContext } from '../ai/aiContext'
import { getOpenAIService } from '../ai/aiService'
import BokehBackground from '../../components/BokehBackground'
import ChatPanel2 from '../../components/ChatPanel2'
import TaskList from '../../components/TaskList'
import ColorgoryManager from '../../components/ColorgoryManager'
import LeftDock from '../../components/LeftDock'
import OmniSearch from '../../components/OmniSearch'
import { useTheme } from '../../contexts/ThemeContext'
import TopicModal from '../../components/TopicModal'
import type { BoardBrief } from './boardTypes'
import NodeAddModal from '../../components/NodeAddModal'
import BoardContextMenu from '../../components/BoardContextMenu'
// import { supabase } from '../auth/supabaseClient'; // Using getSupabaseClient instead
import type { BoardNode } from './boardTypes';
import { supabaseStorage } from '../storage/supabaseStorage'
import { useRouter } from 'next/navigation'
import { useSupabaseUser } from '../auth/authUtils'
import { getSupabaseClient } from '../auth/supabaseClient'
import BoardReorganizeMenu from '../../components/BoardReorganizeMenu'
import { PlacementStrategy, LayoutAlgorithm } from './placementTypes'
import { placeNodes as enginePlaceNodes } from './placementEngine'
import { Info, X } from '@phosphor-icons/react'
import IconButton from '../../components/ui/IconButton'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import useBoardRealtime from './useBoardRealtime'
import useBoardAutosave from './useBoardAutosave'
import useNodeActions from './useNodeActions'
import useDocumentUpload from './useDocumentUpload'
import useBoardShortcuts from './useBoardShortcuts'

interface BoardProps {
  initialBoard?: { nodes: Node[]; edges: Edge[] }
  pendingBoardBrief?: BoardBrief // Now includes id
  onBoardStateChange?: (name: string, status: string, hasChanges: boolean) => void
  clearPendingBoardBrief?: () => void
  isBoardView?: boolean
  boardId?: string // Add board ID for existing boards
  boardName?: string // Add board name for existing boards
  screenshotMode?: boolean // Add screenshot mode
  onDeleteNode?: (nodeId: string) => void // Add delete function prop
}

// Add migrateNodeData definition if missing
const migrateNodeData = (nodes: Node[]): Node[] => {
  return nodes.map((node, index) => {
    // Ensure data object exists and migrate legacy label
    const data = (node?.data || {}) as any
    if (data && typeof data === 'object' && data.label && !data.title) {
      data.title = data.label
      delete data.label
    }

    // Ensure required fields exist
    const hasValidPosition =
      node && node.position &&
      typeof (node.position as any).x === 'number' && isFinite((node.position as any).x) &&
      typeof (node.position as any).y === 'number' && isFinite((node.position as any).y)

    // Fallback grid placement if missing/invalid
    const fallbackPos = { x: 120 + (index % 6) * 180, y: 120 + Math.floor(index / 6) * 140 }
    const position = hasValidPosition ? node.position : fallbackPos

    // Ensure type
    const type = node?.type || 'default'

    // Ensure id is a string
    const id = typeof node?.id === 'string' ? node.id : `node-${Date.now()}-${index}`

    return { ...node, id, type, position, data }
  })
}

// === XYFlow/React Flow: Stable nodeTypes/edgeTypes ===
// Define at module scope, never re-created
const stableHandlers: any = {};

export const nodeTypes = {
  default: (props: any) => <NodalNode {...props} {...stableHandlers} />,
  document: (props: any) => <DocumentNode {...props} {...stableHandlers} />,
  image: (props: any) => <ImageNode {...props} {...stableHandlers} />,
  task: (props: any) => <TaskNode {...props} {...stableHandlers} />,
  video: (props: any) => <VideoNode {...props} {...stableHandlers} />,
};

export const edgeTypes = {
  floating: (props: any) => <FloatingEdge {...props} onEdgeDelete={stableHandlers.onEdgeDelete} />,
};

function BoardContent({
  initialBoard,
  pendingBoardBrief,
  onBoardStateChange,
  clearPendingBoardBrief,
  isBoardView = true,
  boardId,
  boardName, // Add this parameter
  screenshotMode = false, // Add screenshotMode
  onDeleteNode, // Add delete function prop
}: BoardProps) {
  const { theme } = useTheme()
  const { isInitialized: aiInitialized } = useAIContext()
  const router = useRouter() // Add this line
  const user = useSupabaseUser()
  const supabase = getSupabaseClient()
  const [myCursor, setMyCursor] = useState<{ x: number; y: number } | null>(null)

  // Centralized realtime subscriptions: cursors, locks, and board updates
  const {
    remoteCursors,
    nodeLocks,
    isNodeLocked,
    getNodeLockOwner,
    isNodeLockedByMe,
    acquireNodeLock: acquireNodeLockRaw,
    releaseNodeLock: releaseNodeLockRaw,
  } = useBoardRealtime({
    boardId,
    userId: user?.id || null,
    supabase,
    applyRemoteNodeContent: (nodeId, data) => {
      setNodes((nds) => nds.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node))
    }
  })

  // Basic state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  
  // Sync XYFlow nodes with Zustand board store for DocumentsMenu
  useEffect(() => {
    useBoardStore.getState().setNodes(nodes)
  }, [nodes])
  // Sync XYFlow edges with store so focus neighbor computation has data
  useEffect(() => {
    useBoardStore.getState().setEdges(edges)
  }, [edges])
  
  // Set Zustand currentBoardId from prop
  useEffect(() => {
    if (boardId) {
      useBoardStore.getState().setCurrentBoardId(boardId)
      // Load saved colorgories for this board if available
      ;(async () => {
        try {
          const saved = await boardStorage.loadBoard(boardId)
          const savedColorgories = saved?.data?.colorgories
          if (Array.isArray(savedColorgories) && savedColorgories.length > 0) {
            useBoardStore.getState().setColorgories(savedColorgories as any)
          }
        } catch {}
      })()
    }
  }, [boardId])
  
  const [currentBoardName, setCurrentBoardName] = useState('Untitled Board')
  const localBoardIdRef = useRef<string | null>(null)
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [showTips, setShowTips] = useState(false)
  const [showAINodeGenerator, setShowAINodeGenerator] = useState(false)
  const [showNodeSetupModal, setShowNodeSetupModal] = useState(false)
  const [showReorganizeMenu, setShowReorganizeMenu] = useState(false)
  const [aiParentNodeId, setAiParentNodeId] = useState<string | null>(null)
  const [leftDockActive, setLeftDockActive] = useState<'tasks' | 'colorgories' | 'tips' | null>(null)
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number } | null;
  }>({
    isOpen: false,
    position: null,
  })
  
  // Autosave state handled by useBoardAutosave
  const isInitializedRef = useRef(false)
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useReactFlow()
  const setConnectingSource = useBoardStore((s: any) => s.setConnectingSource)
  
  // Broadcast local cursor position
  useEffect(() => {
    if (!boardId || !user?.id) return
    let lastSent = 0
    const handleMouseMove = (e: MouseEvent) => {
      // Get board-relative coordinates
      const wrapper = reactFlowWrapper.current
      if (!wrapper) return
      const rect = wrapper.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      setMyCursor({ x, y })
      const now = Date.now()
      if (now - lastSent > 50) { // throttle
        lastSent = now
        supabase.from('board_cursors').upsert({
          board_id: boardId,
          user_id: user.id,
          x,
          y,
          last_updated: new Date().toISOString(),
        }).then(({ error, data }) => {
          if (error) {
          } else {
          }
        })
      }
    }
    const wrapper = reactFlowWrapper.current
    if (wrapper) {
      wrapper.addEventListener('mousemove', handleMouseMove)
    }
    return () => {
      if (wrapper) wrapper.removeEventListener('mousemove', handleMouseMove)
    }
  }, [boardId, user?.id])

  // Wrappers for lock operations bound to current board/user
  const acquireNodeLock = useCallback(async (nodeId: string) => {
    if (!boardId) return false
    return acquireNodeLockRaw(boardId, nodeId, user?.id || null)
  }, [acquireNodeLockRaw, boardId, user?.id])

  const releaseNodeLock = useCallback(async (nodeId: string) => {
    if (!boardId) return
    return releaseNodeLockRaw(boardId, nodeId, user?.id || null)
  }, [releaseNodeLockRaw, boardId, user?.id])

  // isNodeLocked, getNodeLockOwner, isNodeLockedByMe provided by useBoardRealtime

  // Helper to get avatar for a user_id
  const getCursorAvatar = (userId: string) => {
    if (user && user.id === userId) {
      const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
      if (avatar) {
        return <img src={avatar} alt="avatar" className="w-6 h-6 rounded-full object-cover border-2 border-white" />
      }
    }
    return (
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white border-2 border-white">
        {userId.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  // Render remote cursors (excluding self)
  const renderRemoteCursors = () => {
    return remoteCursors.filter(c => user && c.user_id !== user.id).map(c => (
      <div
        key={`${c.user_id}-${c.x}-${c.y}`}
        className="pointer-events-none absolute z-50"
        style={{ left: c.x, top: c.y, transform: 'translate(-50%, -50%)', border: '2px solid red', background: 'rgba(255,255,255,0.7)' }}
      >
        {getCursorAvatar(c.user_id)}
      </div>
    ))
  }
  
  // Helper function to check if a file type supports text extraction
  const isTextExtractable = (fileType: string, fileName: string): boolean => {
    const normalizedType = fileType.toLowerCase()
    const normalizedName = fileName.toLowerCase()
    
    return (
      normalizedType.includes('pdf') ||
      normalizedType.includes('word') ||
      normalizedType.includes('document') ||
      normalizedType.includes('text/') ||
      normalizedType.includes('json') ||
      normalizedType.includes('markdown') ||
      normalizedName.endsWith('.docx') ||
      normalizedName.endsWith('.doc') ||
      normalizedName.endsWith('.txt') ||
      normalizedName.endsWith('.md') ||
      normalizedName.endsWith('.json')
    )
  }
  
  // Autosave and manual save via hook
  const { saveStatus, hasUnsavedChanges, setHasUnsavedChanges, triggerAutosave, manualSave } = useBoardAutosave({
    boardStorage,
    templateStorage,
    getViewport: () => reactFlowInstance.getViewport(),
    getColorgories: () => useBoardStore.getState().colorgories || [],
    localBoardIdRef,
    onBoardStateChange,
    currentBoardName,
  })
  const triggerAutosaveRef = useRef(triggerAutosave)
  triggerAutosaveRef.current = triggerAutosave
  
  // Store onBoardStateChange in a ref to avoid dependency issues
  const onBoardStateChangeRef = useRef(onBoardStateChange)
  onBoardStateChangeRef.current = onBoardStateChange
  
  // Track previous nodes/edges to detect actual changes
  const prevNodesRef = useRef<Node[]>([])
  const prevEdgesRef = useRef<Edge[]>([])
  
  // Simple effect to trigger autosave when nodes/edges change
  useEffect(() => {
    // Skip during initialization
    if (!isInitializedRef.current) {
      return
    }
    
    // Skip if no board ID
    if (!localBoardIdRef.current) {
      return
    }
    
    // Skip if we're currently saving
    if (saveStatus === 'saving') {
      return
    }
    
    // Check if nodes or edges have actually changed
    const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(prevNodesRef.current)
    const edgesChanged = JSON.stringify(edges) !== JSON.stringify(prevEdgesRef.current)
    
    // Only trigger autosave if there are actual changes
    if ((nodesChanged || edgesChanged) && (nodes.length > 0 || edges.length > 0)) {
      // console.log('📝 Changes detected, triggering autosave...')
      setHasUnsavedChanges(true)
      if (onBoardStateChangeRef.current) {
        onBoardStateChangeRef.current(currentBoardName, 'saving', true)
      }
      triggerAutosaveRef.current(nodes, edges)
    }
    
    // Update previous values
    prevNodesRef.current = nodes
    prevEdgesRef.current = edges
  }, [nodes, edges, currentBoardName, saveStatus])
  
  // No local autosave timeout cleanup needed; handled in hook

  // Thumbnails removed

  // Thumbnails removed: no generation after save
  
  // Board utilities
  // Generate starter nodes using AI
  const generateStarterNodes = async (brief: BoardBrief, boardId: string) => {
    // console.log('🚀 generateStarterNodes called with boardId:', boardId, 'for brief:', brief.boardName)
    try {
      const aiService = getOpenAIService()
      // Ensure a topic parent node exists
      const topicNodeId = `topic-${boardId}`
      const topicNode = {
        id: topicNodeId,
        type: 'default' as const,
        position: { x: 500, y: 400 },
        data: { title: brief.boardTopic, content: '' },
      }
      setNodes((prev) => {
        const list = Array.isArray(prev) ? prev : []
        const exists = list.some((n: any) => n.id === topicNodeId)
        return exists ? list : [topicNode, ...list]
      })
      await boardStorage.updateBoard(boardId, {
        nodes: [topicNode],
        edges: [],
        viewport: reactFlowInstance.getViewport(),
        topic: brief.boardTopic || null,
        colorgories: useBoardStore.getState().colorgories || []
      })
      // If user provided manual starter nodes, prioritize those and skip AI
      if (Array.isArray(brief.starterNodes) && brief.starterNodes.length > 0) {
        // Use hierarchical GRID under the topic as parent
        const nodesToPlace = brief.starterNodes.map(title => ({ title, content: '', type: 'default' as const, parentId: topicNodeId }))
        try {
          const rect = document.querySelector('.react-flow')?.getBoundingClientRect()
          const viewport = reactFlowInstance.getViewport()
          const context = {
            existingNodes: [topicNode] as any,
            existingEdges: [] as any[],
            viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom, width: rect?.width || window.innerWidth, height: rect?.height || window.innerHeight },
            selectedNodeIds: [] as string[],
            focusNode: topicNode as any,
            constraints: { minDistance: 40, avoidOverlap: true, preferredDirection: 'down' as const },
          }
          const placementResult = await enginePlaceNodes({
            nodes: nodesToPlace,
            context,
            strategy: PlacementStrategy.AI_GENERATION,
            algorithm: LayoutAlgorithm.GRID
          } as any)
          if (placementResult.success && placementResult.placements.length > 0) {
            const generatedNodes = placementResult.placements.map((placement: any) => ({
              id: placement.node.id,
              type: placement.node.type,
              position: placement.position,
              data: { ...placement.node.data },
            }))
            const generatedEdges = (placementResult.connections || []).map((connection: any) => ({
              id: connection.edge.id,
              source: connection.edge.source,
              target: connection.edge.target,
              type: connection.edge.type || 'floating',
            }))
            setNodes([topicNode, ...generatedNodes])
            if (generatedEdges.length > 0) setEdges(generatedEdges)
            const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
            await boardStorage.updateBoard(boardId, boardData)
            // Save state handled by autosave hook; avoid using setSaveStatus here
            setHasUnsavedChanges(false)
            if (onBoardStateChange) onBoardStateChange(brief.boardName, 'saved', false)
            router.push(`/board/${boardId}`)
            return
          }
        } catch {}
        // Fallback: simple local grid under topic
        const count = brief.starterNodes.length
        const columns = Math.ceil(Math.sqrt(count))
        const rows = Math.ceil(count / columns)
        const spacingX = 300
        const spacingY = 200
        const startX = topicNode.position.x - ((columns - 1) * spacingX) / 2
        const startY = topicNode.position.y + spacingY
        const generatedNodes = brief.starterNodes.map((title, index) => {
          const r = Math.floor(index / columns)
          const c = index % columns
          const position = { x: startX + c * spacingX, y: startY + r * spacingY }
          return { id: `starter-node-${Date.now()}-${index}`, type: 'default' as const, position, data: { title, content: '' } }
        })
        const generatedEdges = generatedNodes.map(n => ({ id: `edge-${Date.now()}-${n.id}`, source: topicNode.id, target: n.id, type: 'floating' as const }))
        setNodes([topicNode, ...generatedNodes])
        setEdges(generatedEdges as any)
        const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
        await boardStorage.updateBoard(boardId, boardData)
        // Save state handled by autosave hook; avoid using setSaveStatus here
        setHasUnsavedChanges(false)
        if (onBoardStateChange) onBoardStateChange(brief.boardName, 'saved', false)
        router.push(`/board/${boardId}`)
        return
      }
      if (!aiService) {
        router.push(`/board/${boardId}`)
        return
      }

      const prompt = `Create 3-5 starter nodes for a board about "${brief.boardTopic}" with description: "${brief.description}". Return them as a JSON array of objects with this structure: [{ "label": "Node title", "content": "Brief description" }]. Make the nodes diverse and actionable. Return ONLY the JSON array, no markdown formatting.`

      const response = await aiService.generate({
        prompt,
        systemPrompt: 'You are a helpful AI assistant that creates structured, actionable nodes for mind mapping and project planning. Always return clean JSON without markdown formatting.',
        temperature: 0.7,
        model: 'gpt-4o-mini'
      })

      try {
        let jsonContent = response.content.trim()
        if (jsonContent.startsWith('```json')) {
          jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
        } else if (jsonContent.startsWith('```')) {
          jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
        }
        
        const nodeDataArray = JSON.parse(jsonContent)
        if (Array.isArray(nodeDataArray)) {
          // Use our intelligent placement system for board creation
          try {
            const nodesToPlace = nodeDataArray.map((nodeData: any) => ({
              title: nodeData.label,
              content: nodeData.content,
              type: 'default' as const,
              parentId: topicNodeId
            }))
            const rect = document.querySelector('.react-flow')?.getBoundingClientRect()
            const viewport = reactFlowInstance.getViewport()
            const context = {
              existingNodes: [topicNode] as any,
              existingEdges: [] as any[],
              viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom, width: rect?.width || window.innerWidth, height: rect?.height || window.innerHeight },
              selectedNodeIds: [] as string[],
              focusNode: topicNode as any,
              constraints: { minDistance: 40, avoidOverlap: true, preferredDirection: 'down' as const },
            }
            const placementResult = await enginePlaceNodes({
              nodes: nodesToPlace,
              context,
              strategy: PlacementStrategy.AI_GENERATION,
              algorithm: LayoutAlgorithm.GRID
            } as any)

            if (placementResult.success && (placementResult as any).placements.length > 0) {
              const generatedNodes = (placementResult as any).placements.map((placement: any) => ({
                id: placement.node.id,
                type: placement.node.type,
                position: placement.position,
                data: { ...placement.node.data },
              }))
              const generatedEdges = (placementResult as any).connections.map((connection: any) => ({
                id: connection.edge.id,
                source: connection.edge.source,
                target: connection.edge.target,
                type: connection.edge.type || 'floating',
              }))
              setNodes([topicNode, ...generatedNodes])
              if (generatedEdges.length > 0) setEdges(generatedEdges)
              const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
              await boardStorage.updateBoard(boardId, boardData)
            } else {
              // Fallback: simple local grid under topic
              const count = nodesToPlace.length
              const columns = Math.ceil(Math.sqrt(count))
              const rows = Math.ceil(count / columns)
              const spacingX = 300
              const spacingY = 200
              const startX = topicNode.position.x - ((columns - 1) * spacingX) / 2
              const startY = topicNode.position.y + spacingY
              const generatedNodes = nodesToPlace.map((n: any, index: number) => {
                const r = Math.floor(index / columns)
                const c = index % columns
                const position = { x: startX + c * spacingX, y: startY + r * spacingY }
                return { id: `starter-node-${Date.now()}-${index}`, type: 'default' as const, position, data: { title: n.title, content: n.content } }
              })
              const generatedEdges = generatedNodes.map(n => ({ id: `edge-${Date.now()}-${n.id}`, source: topicNode.id, target: n.id, type: 'floating' as const }))
              setNodes([topicNode, ...generatedNodes])
              setEdges(generatedEdges as any)
              const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
              await boardStorage.updateBoard(boardId, boardData)
            }
            
          } catch (placementError) {
            // Fallback: fan around topic
            const count = nodeDataArray.length
            const radius = 250
            const angleCenter = Math.PI / 2
            const angleStep = (Math.PI) / Math.max(count, 1)
            const generatedNodes = nodeDataArray.map((nodeData: any, index: number) => {
              const angle = angleCenter - (angleStep * ((count - 1) / 2 - index))
              const position = { x: 500 + radius * Math.cos(angle), y: 400 + radius * Math.sin(angle) }
              return { id: `starter-node-${Date.now()}-${index}`, type: 'default' as const, position, data: { title: nodeData.label, content: nodeData.content } }
            })
            const generatedEdges = generatedNodes.map(n => ({ id: `edge-${Date.now()}-${n.id}`, source: topicNode.id, target: n.id, type: 'floating' as const }))
            setNodes([topicNode, ...generatedNodes])
            setEdges(generatedEdges as any)
            const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
            await boardStorage.updateBoard(boardId, boardData)
          }
          
          // Update save status
          // Save state handled by autosave hook; avoid using setSaveStatus here
          setHasUnsavedChanges(false)
          
          if (onBoardStateChange) {
            onBoardStateChange(brief.boardName, 'saved', false)
          }
          
          // Navigate to the board URL after successful AI generation
          router.push(`/board/${boardId}`)
        }
      } catch (parseError) {
        // console.error('Failed to parse AI response:', parseError)
        // console.log('Raw response content:', response.content)
        const newNode = { id: `starter-node-${Date.now()}`, type: 'default' as const, position: { x: topicNode.position.x + 250, y: topicNode.position.y }, data: { title: `Getting Started with ${brief.boardTopic}`, content: response.content } }
        const newEdge = { id: `edge-${Date.now()}-${newNode.id}`, source: topicNode.id, target: newNode.id, type: 'floating' as const }
        setNodes([topicNode, newNode])
        setEdges([newEdge] as any)
        
        // Save with topic and connection
        const boardData = { nodes: [topicNode, newNode], edges: [newEdge] as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
        
        // console.log('💾 Saving single generated node immediately...')
        await boardStorage.updateBoard(boardId, boardData)
        // console.log('✅ Single generated node saved successfully')
        
        // Update save status
        // Save state handled by autosave hook
        setHasUnsavedChanges(false)
        
        if (onBoardStateChange) {
          onBoardStateChange(brief.boardName, 'saved', false)
        }
        
        // Navigate to the board URL after fallback node creation
        router.push(`/board/${boardId}`)
      }
    } catch (error) {
      // console.error('Failed to generate starter nodes:', error)
      // Navigate to the board even if AI generation fails
      router.push(`/board/${boardId}`)
    }
  }
  const { addNode, addNodeToStore, getViewportCenter } = useBoard()
  const nodeActions = useNodeActions({ setNodes, setEdges })
  const { placeAINodes, placeBoardNodes, placeManualNode, findBestPosition } = usePlacement()
  
  // Initialize board
  useEffect(() => {
    // Prevent multiple initializations
    if (isInitializedRef.current) {
      return
    }
    
    // Set board ID for existing boards
    if (boardId && !localBoardIdRef.current) {
      // console.log('🆔 Setting board ID for existing board:', boardId)
      localBoardIdRef.current = boardId
    }
    
    // Set board name for existing boards
    if (boardName && !pendingBoardBrief) {
      // console.log('📝 Setting board name for existing board:', boardName)
      setCurrentBoardName(boardName)
      if (onBoardStateChange) {
        onBoardStateChange(boardName, 'saved', false)
      }
    }
    
    if (initialBoard && initialBoard.nodes) {
      // console.log('📥 Loading initial board nodes:', initialBoard.nodes.length)
      const migratedNodes = migrateNodeData(initialBoard.nodes);
      setNodes(migratedNodes)
    }
    if (initialBoard && initialBoard.edges) {
      // console.log('📥 Loading initial board edges:', initialBoard.edges.length)
      setEdges(initialBoard.edges)
    }
    if (pendingBoardBrief && !localBoardIdRef.current) { // Only run if we don't already have a localBoardId
      // console.log('🔄 useEffect triggered for pendingBoardBrief:', pendingBoardBrief.boardName)
      setCurrentBoardName(pendingBoardBrief.boardName)
      if (onBoardStateChange) {
        onBoardStateChange(pendingBoardBrief.boardName, 'saved', false)
      }
      // console.log('pendingBoardBrief:', pendingBoardBrief, 'typeof id:', typeof pendingBoardBrief.id)
      localBoardIdRef.current = pendingBoardBrief.id;
      // console.log('AFTER ASSIGNMENT:', localBoardIdRef.current, typeof localBoardIdRef.current);
      // ALWAYS create the blank board first to get the localBoardId
      (async () => {
        const boardId = pendingBoardBrief.id
        const boardName = pendingBoardBrief.boardName
        const boardData = {
          nodes: [],
          edges: [],
          viewport: reactFlowInstance.getViewport(),
          topic: pendingBoardBrief.boardTopic || null,
        }
        try {
          await boardStorage.saveBoardWithId(boardId, boardName, { ...boardData, colorgories: useBoardStore.getState().colorgories || [] })
          // console.log('🔵 CREATING BLANK BOARD with ID:', boardId, 'for name:', boardName)
          setCurrentBoardName(boardName)
          // Save state handled by autosave hook; avoid using setSaveStatus here
          if (onBoardStateChange) {
            onBoardStateChange(boardName, 'saved', false)
          }
          // console.log('✅ Blank board created and saved:', boardName)
          // If startWithAI is true, now generate AI nodes to update the same board
          if (pendingBoardBrief.startWithAI) {
            // console.log('🤖 Starting AI generation for board ID:', boardId)
            generateStarterNodes(pendingBoardBrief, boardId)
          }
        } catch (error) {
          // console.error('Failed to create blank board:', error)
          // Save state handled by autosave hook
          if (onBoardStateChange) {
            onBoardStateChange(boardName, 'error', false)
          }
        }
      })()
    }
    
    // Mark as initialized
    isInitializedRef.current = true
  }, [initialBoard, pendingBoardBrief, clearPendingBoardBrief, boardId, boardName]) // Removed setNodes, setEdges from dependencies
  
  // Handle connections
  const onConnect = useCallback(
    (params: Connection) => {
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: params.source!,
        target: params.target!,
        type: 'floating',
      }
      setEdges((eds) => {
        if (!Array.isArray(eds)) return [newEdge]
        return [...eds, newEdge]
      })
    },
    [setEdges]
  )

  // Node-wide drop connection support
  const connectingSourceRef = useRef<string | null>(null)
  const clearConnecting = useCallback(() => {
    connectingSourceRef.current = null
    setConnectingSource(null)
  }, [setConnectingSource])

  const onConnectStart = useCallback((_: any, params: any) => {
    const srcId = params?.nodeId ?? null
    connectingSourceRef.current = srcId
    setConnectingSource(srcId)
  }, [setConnectingSource])

  const onConnectEnd = useCallback((event: any) => {
    const sourceId = connectingSourceRef.current
    const done = () => clearConnecting()
    if (!sourceId) return done()

    // If released over a handle, let default onConnect flow handle it
    const targetHandle = (event?.target as Element | null)?.closest?.('.react-flow__handle')
    if (targetHandle) return done()

    // Otherwise, accept drop on a node surface
    const nodeEl = (event?.target as Element | null)?.closest?.('.react-flow__node') as HTMLElement | null
    const targetId = nodeEl?.getAttribute?.('data-id') || null

    if (targetId && targetId !== sourceId) {
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: sourceId,
        target: targetId,
        type: 'floating',
      }
      setEdges((eds) => (Array.isArray(eds) ? [...eds, newEdge] : [newEdge]))
    }
    done()
  }, [setEdges, clearConnecting])
  
  // Handle adding nodes
  const handleAddNode = useCallback((nodeData: { title: string; content?: string }, position: { x: number; y: number }) => {
    // console.log('➕ Adding new node:', { nodeData, position })
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'default',
      position,
      data: { 
        title: nodeData.title,
        content: nodeData.content 
      },
    }
    // Use React Flow's addNode utility
    const addNode = (node: Node) => {
      // console.log('📝 Adding node to state:', node.id)
      setNodes((nds) => {
        if (!Array.isArray(nds)) return [node]
        return [...nds, node]
      })
    }
    addNode(newNode)
  }, [setNodes])

  // Add handler for node setup modal
  const handleNodeSetupComplete = useCallback((nodeData: { title: string; content?: string }) => {
    const position = getViewportCenter()
    handleAddNode(nodeData, position)
    setShowNodeSetupModal(false)
  }, [handleAddNode, getViewportCenter])
  
  // Handle adding nodes to store (for AI generation)
  const handleAddNodeToStore = useCallback((node: Node) => {
    setNodes((nds) => {
      const list = Array.isArray(nds) ? nds : []
      // Ensure unique ID to avoid React key collisions
      let candidate = node
      if (list.some((n: any) => n.id === node.id)) {
        const uniqueId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? `node-${(crypto as any).randomUUID()}`
          : `${node.id}-${Math.random().toString(36).slice(2,8)}`
        candidate = { ...node, id: uniqueId }
      }
      return [...list, candidate]
    })
  }, [setNodes])
  
  const saveBoard = useCallback(async (name?: string) => {
    await manualSave(nodes, edges, name)
  }, [manualSave, nodes, edges])


  
  // Document upload via hook
  const { handleDocumentUpload } = useDocumentUpload({
    boardStorage,
    supabaseStorage,
    isTextExtractable,
    localBoardIdRef,
    addNodeToStore: handleAddNodeToStore,
    setNodes,
  })

  // Drag and drop handlers
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])

  // Handle XYFlow's selection changes
  const handleSelectionChange = useCallback(({ nodes }: { nodes: BoardNode[] }) => {
    const selectedIds = nodes.map(node => node.id)
    // console.log('Selection changed:', selectedIds)
    setSelectedNodes(selectedIds)
    // Also update our store for chat integration
    useBoardStore.getState().setSelectedNodes(selectedIds)
  }, [])

  // Global drag event listener to handle files dragged from outside
  useEffect(() => {
    let isFileBeingDragged = false

    const handleGlobalDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const handleGlobalDrop = (e: DragEvent) => {
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const handleWindowDragEnter = (e: DragEvent) => {
      // Only activate if we have files and haven't already activated
      if (!isFileBeingDragged && e.dataTransfer?.types.includes("Files")) {
        e.preventDefault() // This is the key fix - tell browser this is a custom drop zone
        isFileBeingDragged = true
        setIsDragOver(true)
        // console.log("🔄 File drag detected - overlay ON")
      }
    }

    const handleWindowDragOver = (e: DragEvent) => {
      // Always prevent default for file drags
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = "copy"
      }
    }

    const handleWindowDragEnd = (_e: DragEvent) => {
      // Drag operation completely ended
      if (isFileBeingDragged) {
        isFileBeingDragged = false
        setIsDragOver(false)
        // console.log("🏁 File drag ended - overlay OFF")
      }
    }

    const handleWindowDrop = (e: DragEvent) => {
      // Always prevent default for file drops
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        
        // console.log("🎯 Files dropped - preventing default behavior")
        
        // Check if we're dropping on the board
        const boardElement = document.querySelector(".react-flow") as HTMLElement
        if (boardElement) {
          const rect = boardElement.getBoundingClientRect()
          const isOnBoard = e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom

            if (isOnBoard) {
              // console.log("🎯 Files dropped on board!")
              // Convert FileList to Array and process each file
              const files = Array.from(e.dataTransfer.files)
              const validFiles = files.filter(file => {
              const validTypes = [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
                'text/markdown',
                'text/csv',
                'image/png',
                'image/jpeg',
                'image/jpg',
                'image/gif',
                'image/webp'
              ]
              return validTypes.includes(file.type) || 
                file.name.endsWith('.pdf') || 
                file.name.endsWith('.doc') || 
                file.name.endsWith('.docx') || 
                file.name.endsWith('.txt') || 
                file.name.endsWith('.md') || 
                file.name.endsWith('.csv') ||
                file.name.endsWith('.png') ||
                file.name.endsWith('.jpg') ||
                file.name.endsWith('.jpeg') ||
                file.name.endsWith('.gif') ||
                file.name.endsWith('.webp')
            })

              if (validFiles.length > 0) {
                validFiles.forEach(file => {
                  // Convert screen coordinates (client) to flow coordinates via XYFlow utility
                  const flowPosition = reactFlowInstance.screenToFlowPosition({
                    x: e.clientX,
                    y: e.clientY,
                  })
                  handleDocumentUpload(file, flowPosition)
                })
              }
          }
        }
      }
      
      // Reset drag state
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
  }, [handleDocumentUpload])
  
  // Keyboard shortcuts via hook
  useBoardShortcuts(() => { saveBoard() })
  
  // Handler functions
  const handleNodeDelete = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId))
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    if (onDeleteNode) onDeleteNode(nodeId)
  }, [onDeleteNode, setNodes, setEdges])

  const handleNodeUpdate = useCallback(async (nodeId: string, updates: Partial<{ label: string; title: string; content: string }>) => {
    // Update local nodes immediately
    setNodes((nds) => nds.map((node) => 
      node.id === nodeId ? { ...node, data: { ...node.data, ...updates } } : node
    ))

    // Broadcast the update to other users via Supabase
    if (boardId && user?.id) {
      try {
        const { error } = await supabase
          .from('board_updates')
          .insert({
            board_id: boardId,
            node_id: nodeId,
            update_type: 'content',
            data: updates,
            user_id: user.id
          })
        
        if (error) {
          // console.error('[BoardComponent] Failed to broadcast node update:', error)
        } else {
          // console.log('[BoardComponent] Broadcasted node update:', { nodeId, updates })
        }
      } catch (error) {
        // console.error('[BoardComponent] Error broadcasting node update:', error)
      }
    }
  }, [setNodes, boardId, user?.id, supabase])

  const handleEdgeDelete = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId))
  }, [setEdges])

  // Shift+Click connect: connect from the single selected node to clicked node
  const handleShiftClickConnect = useCallback((targetId: string) => {
    const selected = useBoardStore.getState().selectedNodeIds || []
    const sourceId = selected.length === 1 ? selected[0] : null
    if (!sourceId || sourceId === targetId) return

    setEdges((eds) => {
      const list = Array.isArray(eds) ? eds : []
      const exists = list.some((e: any) => (
        (e.source === sourceId && e.target === targetId) ||
        (e.source === targetId && e.target === sourceId)
      ))
      if (exists) return eds
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: sourceId,
        target: targetId,
        type: 'floating',
      }
      return [...list, newEdge]
    })
  }, [setEdges])

  // Memoize handlers object for node/edge types
  const handlers = useMemo(() => {
    // console.log('[BoardComponent] Creating handlers, user:', user, 'user?.id:', user?.id)
    // console.log('[BoardComponent] acquireNodeLock reference:', acquireNodeLock)
    
    const newHandlers = {
      onNodeDelete: handleNodeDelete,
      onNodeUpdate: handleNodeUpdate,
      onEdgeDelete: handleEdgeDelete,
      acquireNodeLock,
      releaseNodeLock,
      isNodeLocked,
      getNodeLockOwner,
      isNodeLockedByMe,
      nodeLocks,
      currentUser: user, // Add current user to handlers
      onNodeShiftClickConnect: handleShiftClickConnect,
    }
    
    // Force update stableHandlers immediately
    Object.assign(stableHandlers, newHandlers)
    // console.log('[BoardComponent] Updated stableHandlers.acquireNodeLock:', stableHandlers.acquireNodeLock)
    
    return newHandlers
  }, [
    handleNodeDelete,
    handleNodeUpdate,
    handleEdgeDelete,
    acquireNodeLock,
    releaseNodeLock,
    isNodeLocked,
    getNodeLockOwner,
    isNodeLockedByMe,
    nodeLocks,
    user, // User dependency triggers re-creation when user changes
  ])

  

  

  const [showAddNodeModal, setShowAddNodeModal] = useState(false)
  const [showUnifiedAddModal, setShowUnifiedAddModal] = useState(false)
  const [pendingNodePosition, setPendingNodePosition] = useState<{ x: number; y: number } | null>(null)
  const [awaitingNodePlacement, setAwaitingNodePlacement] = useState(false)
  const [pendingSourceNodeId, setPendingSourceNodeId] = useState<string | null>(null)

  const handleOpenAINodeGenerator = useCallback(() => {
    // Prefer explicit pendingSourceNodeId from context menu; fallback to current selection
    const selectedIds = useBoardStore.getState().selectedNodeIds || []
    const parentId = pendingSourceNodeId || (selectedIds.length > 0 ? selectedIds[0] : null)
    setAiParentNodeId(parentId)
    setShowAINodeGenerator(true)
  }, [pendingSourceNodeId])

  // Trigger autosave when chat updates (so chat meta is saved with the board)
  useEffect(() => {
    const handler = (e: Event) => {
      if (!localBoardIdRef.current) return
      if (saveStatus === 'saving') return
      setHasUnsavedChanges(true)
      if (onBoardStateChangeRef.current) {
        onBoardStateChangeRef.current(currentBoardName, 'saving', true)
      }
      triggerAutosaveRef.current(nodes, edges)
    }
    window.addEventListener('nodal:chat-updated', handler as EventListener)
    return () => {
      window.removeEventListener('nodal:chat-updated', handler as EventListener)
    }
  }, [saveStatus, currentBoardName])

  return (
    <div 
      className="w-full h-full relative" 
      ref={reactFlowWrapper}
    >
      {/* Drag and drop overlay */}
      {isDragOver && (
        <div className="absolute inset-0 z-50 bg-blue-500/20 border-4 border-dashed border-blue-500 rounded-lg flex items-center justify-center pointer-events-none">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg text-center">
            <div className="text-4xl mb-4">📄</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Drop your documents here
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Supported formats: PDF, Word, Text, Markdown, CSV
            </p>
          </div>
        </div>
      )}
      <BokehBackground />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
          onNodeContextMenu={(event: React.MouseEvent, node: any) => {
            event.preventDefault()
            event.stopPropagation()
            setPendingSourceNodeId(node?.id || null)
            setContextMenu({
              isOpen: true,
              position: { x: event.clientX, y: event.clientY }
            })
          }}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onSelectionChange={handleSelectionChange}
        onPaneClick={(event) => {
          // If we're awaiting a placement click (triggered by FAB), capture this click and open the modal
          if (awaitingNodePlacement) {
            try {
              const flowPosition = reactFlowInstance.screenToFlowPosition({ x: (event as any).clientX, y: (event as any).clientY })
              setPendingNodePosition(flowPosition)
            } catch (e) {
              setPendingNodePosition(getViewportCenter())
            }
            setAwaitingNodePlacement(false)
            setShowAddNodeModal(true)
            setContextMenu({ isOpen: false, position: null })
            return
          }

          setContextMenu({ isOpen: false, position: null })
          clearConnecting()
          // Close left dock panel if click is outside dock/panels
          try {
            const target = event.target as HTMLElement
            const inDock = target.closest('[data-left-dock]') || target.closest('[data-left-dock-panel]')
            if (!inDock && leftDockActive) {
              setLeftDockActive(null)
            }
          } catch {}
        }}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          // Right-click on empty pane (not a node)
          setPendingSourceNodeId(null)
          setContextMenu({
            isOpen: true,
            position: { x: event.clientX, y: event.clientY }
          })
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineComponent={CustomConnectionLine}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 1.5 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        className={`${theme === 'dark' ? 'dark' : ''}`}
        style={{ background: 'transparent' }} // Make ReactFlow background transparent
        multiSelectionKeyCode="Meta"
        deleteKeyCode="Delete"
      >
        {renderRemoteCursors()}
        {/* Remove the Background component - BokehBackground will handle the background */}
        <div className="hidden sm:block">
          <Controls />
        </div>
        {/* Place MiniMap bottom-left next to Controls */}
        <MiniMap
          className="hidden sm:block !bg-white/80 dark:!bg-gray-900/70 !rounded-md !shadow-lg"
          style={{ position: 'absolute', left: 30, bottom: 0, right: 'auto', top: 'auto', width: 160, height: 104 }}
        />
        
        {/** Removed FAB and ChatPanel from inside ReactFlow to avoid stacking context issues */}
      </ReactFlow>
      {isBoardView && (
        <LeftDock
          active={leftDockActive}
          onToggle={(key) => setLeftDockActive(prev => (prev === key ? null : key))}
        />
      )}
      {isBoardView && (
        <FloatingActionButton
          onAddNode={() => {
            // Use unified modal directly
            setShowUnifiedAddModal(true)
          }}
          onAIGenerate={() => setShowUnifiedAddModal(true)}
          onUploadDocument={() => {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp'
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) {
                const viewportCenter = getViewportCenter()
                handleDocumentUpload(file, viewportCenter)
              }
            }
            input.click()
          }}
          onReorganize={() => setShowReorganizeMenu(true)}
          aiInitialized={aiInitialized}
          nodeCount={nodes.length}
        />
      )}
      {isBoardView && (
        <ChatPanel2 />
      )}
      {isBoardView && (
        <TaskList dock open={leftDockActive === 'tasks'} onClose={() => setLeftDockActive(null)} leftOffsetPx={56} topOffsetPx={72} />
      )}
      {isBoardView && (
        <ColorgoryManager dock open={leftDockActive === 'colorgories'} onClose={() => setLeftDockActive(null)} leftOffsetPx={56} topOffsetPx={116} />
      )}
      {isBoardView && leftDockActive === 'tips' && (
        <div
          className="fixed rounded-4xl z-60 w-64 max-h-[calc(100dvh-80px)] bg-white/80 backdrop-blur-xs dark:bg-gray-900/80 shadow-xl flex flex-col transition-all duration-200 ease-out"
          style={{ top: 160, left: 56 }}
          data-left-dock-panel
        >
          <div className="flex items-center justify-between py-2 px-4 shadow-lg shadow-gray-400/10 dark:shadow-none">
            <div className="flex items-center space-x-2">
              <img src="/nobot.svg" alt="Nodal" width={24} height={24} className="opacity-90" />
              <span className="text-xs text-gray-600 dark:text-gray-300">Tips & Info</span>
            </div>
            <button onClick={() => setLeftDockActive(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Cmd/Ctrl + click</strong> on nodes to multi-select.</li>
              <li><strong>Shift + click</strong> a node (with another selected) to connect them.</li>
              <li><strong>Hold Shift</strong> + click and drag to select multiple nodes with a marquee.</li>
              <li><strong>Drag & drop</strong> documents or images onto the board to create nodes.</li>
              <li><strong>Drag</strong> nodes to reposition; use the delete key to remove selected nodes.</li>
              <li><strong>Double-click</strong> a node to expand or open editing.</li>
              <li><strong>Use the FAB</strong> (bottom center) to quickly add nodes, upload, or generate with AI.</li>
              <li><strong>Use MiniMap/Controls</strong> to navigate large boards quickly.</li>
            </ul>
          </div>
        </div>
      )}
      {isBoardView && (
        <OmniSearch />
      )}
      {/* Removed old Tips button; now opened via LeftDock */}
      
      {/* Context Menu */}
      <BoardContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={() => setContextMenu({ isOpen: false, position: null })}
        nodeId={pendingSourceNodeId}
        onAddConnectedNodes={(nodeId: string, screenPos: { x: number; y: number }) => {
          try {
            const flowPosition = reactFlowInstance.screenToFlowPosition(screenPos)
            setPendingNodePosition(flowPosition)
          } catch (e) {
            setPendingNodePosition(getViewportCenter())
          }
          setPendingSourceNodeId(nodeId)
          setShowUnifiedAddModal(true)
          setContextMenu({ isOpen: false, position: null })
        }}
        onAddBlankNode={(screenPos: { x: number; y: number }) => {
          // Store the position and show the modal instead of creating a blank node
          try {
            const flowPosition = reactFlowInstance.screenToFlowPosition(screenPos)
            setPendingNodePosition(flowPosition)
          } catch (e) {
            setPendingNodePosition(getViewportCenter())
          }
          setPendingSourceNodeId(null)
          setShowUnifiedAddModal(true);
          setContextMenu({ isOpen: false, position: null });
        }}
        onAddTaskNode={() => {
          if (!contextMenu.position) return
          const flowPosition = reactFlowInstance.screenToFlowPosition({
            x: contextMenu.position.x,
            y: contextMenu.position.y,
          })
          const newId = `task-${Date.now()}`
          const newNode: Node = {
            id: newId,
            type: 'task',
            position: flowPosition,
            data: { title: 'New Task', completed: false },
          }
          setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
          if (pendingSourceNodeId) {
            const newEdge: Edge = { id: `edge-${Date.now()}`, source: pendingSourceNodeId, target: newId, type: 'floating' }
            setEdges((eds) => (Array.isArray(eds) ? [...eds, newEdge] : [newEdge]))
          }
          setContextMenu({ isOpen: false, position: null })
          setPendingSourceNodeId(null)
          setPendingNodePosition(null)
        }}
        onGenerateAINode={() => {
          handleOpenAINodeGenerator()
          setContextMenu({ isOpen: false, position: null })
        }}
      />
      
      {/* Hide overlays, modals, and toolbars in screenshot mode */}
      {!screenshotMode && (
        <>
          {showTopicModal && (
            <TopicModal
              isOpen={showTopicModal}
              onClose={() => setShowTopicModal(false)}
              onSave={(topic: string) => {
                setCurrentBoardName(topic)
                setShowTopicModal(false)
              }}
            />
          )}
          {showAINodeGenerator && (
            <AINodeGenerator
              isOpen={showAINodeGenerator}
              onClose={() => setShowAINodeGenerator(false)}
              onGenerate={(nodeData: { label: string; content?: string }) => {
                const position = getViewportCenter()
                const newNode = {
                  id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? `ai-node-${crypto.randomUUID()}`
                    : `ai-node-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
                  type: 'default',
                  position,
                  data: { ...nodeData },
                }
                handleAddNodeToStore(newNode)
                setShowAINodeGenerator(false)
              }}
              initialContext={pendingBoardBrief ? {
                topic: pendingBoardBrief.boardTopic,
                description: pendingBoardBrief.description
              } : undefined}
              parentNodeId={aiParentNodeId || undefined}
            />
          )}

          {/* Quick Tips Modal */}
          {showTips && (
            <Modal
              open={showTips}
              onClose={() => setShowTips(false)}
              title="Board quick tips"
              description="Useful shortcuts and gestures to navigate and edit your board faster"
            >
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Cmd/Ctrl + click</strong> on nodes to multi-select.</li>
                  <li><strong>Shift + click</strong> a node (with another selected) to connect them.</li>
                  <li><strong>Hold Shift</strong> + click and drag to select multiple nodes with a marquee.</li>
                  <li><strong>Drag & drop</strong> documents or images onto the board to create nodes.</li>
                  <li><strong>Drag</strong> nodes to reposition; use the delete key to remove selected nodes.</li>
                  <li><strong>Double-click</strong> a node to expand or open editing.</li>
                  <li><strong>Use the FAB</strong> (bottom center) to quickly add nodes, upload, or generate with AI.</li>
                  <li><strong>Use MiniMap/Controls</strong> to navigate large boards quickly.</li>
                </ul>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={() => setShowTips(false)}>Close</Button>
              </div>
            </Modal>
          )}
          {/* NodeSetupModal deprecated for add-new-node; using NodeEditModal instead */}
          {isBoardView && (
            <>
              <FloatingActionButton
                onAddNode={() => {
                  // Trigger next click/tap on the board to pick placement
                  setAwaitingNodePlacement(true)
                }}
                onAIGenerate={handleOpenAINodeGenerator}
                onUploadDocument={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp'
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) {
                      // Use viewport center for manual uploads
                      const viewportCenter = getViewportCenter()
                      handleDocumentUpload(file, viewportCenter)
                    }
                  }
                  input.click()
                }}
                onReorganize={() => setShowReorganizeMenu(true)}
                aiInitialized={aiInitialized}
                nodeCount={nodes.length}
              />
            </>
          )}
        </>
      )}
      {showAddNodeModal && (
        <NodeAddModal
          open={showAddNodeModal}
          onClose={() => {
            setShowAddNodeModal(false)
            setPendingNodePosition(null)
            setPendingSourceNodeId(null)
          }}
          onSubmit={async ({ titles, description, generateDescription }) => {
            const center = pendingNodePosition || getViewportCenter()
            // Optionally generate AI description for single node
            let desc = (description || '').trim()
            if (generateDescription && titles.length === 1 && !desc) {
              try {
                const service = getOpenAIService()
                if (service) {
                  const titleForAI = titles[0]
                  const prompt = `Write a concise, helpful 1-2 sentence description for a mind-map node titled "${titleForAI}". Keep it clear and actionable. Return plain text only.`
                  const res = await service.generate({ prompt, maxTokens: 120 })
                  desc = (res.content || '').trim()
                }
              } catch {}
            }
            // If we have a parent (right-clicked node), use AI fan placement centered under parent
            if (pendingSourceNodeId) {
              const nodesToPlace = titles.map((t) => ({ title: t, content: titles.length === 1 ? desc : '', type: 'default' as const, parentId: pendingSourceNodeId }))
              try {
                const result = await placeAINodes(nodesToPlace, pendingSourceNodeId, { preferredDirection: 'down', minDistance: 40 })
                if (result.success && result.placements.length > 0) {
                  const newNodes: Node[] = result.placements.map(p => ({
                    id: p.node.id,
                    type: p.node.type,
                    position: p.position,
                    data: { ...p.node.data },
                  }))
                  setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
                  if (result.connections.length > 0) {
                    const newEdges: Edge[] = result.connections.map(c => ({
                      id: c.edge.id,
                      source: c.edge.source,
                      target: c.edge.target,
                      type: c.edge.type || 'floating',
                    }))
                    setEdges((eds) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
                  }
                }
              } catch {}
            } else if (titles.length === 1) {
              // Single node: place EXACTLY at the click/touch point (no auto-adjustment)
              const target = pendingNodePosition || center
              const newNode: Node = {
                id: `node-${Date.now()}`,
                type: 'default',
                position: target,
                data: { title: titles[0], content: desc },
              }
              setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
            } else {
              // Multiple nodes: if we have a click position, place each near the click using manual placement
              if (pendingNodePosition) {
                // STRICT GRID centered on click/touch (no auto-adjustment)
                const count = titles.length
                const columns = Math.ceil(Math.sqrt(count))
                const rows = Math.ceil(count / columns)
                const spacingX = 300
                const spacingY = 200
                const startX = pendingNodePosition.x - ((columns - 1) * spacingX) / 2
                const startY = pendingNodePosition.y - ((rows - 1) * spacingY) / 2
                const created: Node[] = []
                let idx = 0
                for (let r = 0; r < rows; r++) {
                  for (let c = 0; c < columns; c++) {
                    if (idx >= count) break
                    const x = startX + c * spacingX
                    const y = startY + r * spacingY
                    created.push({
                      id: `node-${Date.now()}-${idx}`,
                      type: 'default',
                      position: { x, y },
                      data: { title: titles[idx], content: '' },
                    })
                    idx++
                  }
                }
                setNodes((nds) => (Array.isArray(nds) ? [...nds, ...created] : [...created]))
              } else {
                const nodesToPlace = titles.map(t => ({ title: t, content: '', type: 'default' as const }))
                let placed = false
                try {
                  const placementResult = await placeBoardNodes(nodesToPlace)
                  if (placementResult.success && placementResult.placements.length > 0) {
                    const newNodes: Node[] = placementResult.placements.map(p => ({
                      id: p.node.id,
                      type: p.node.type,
                      position: p.position,
                      data: { ...p.node.data },
                    }))
                    setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
                    placed = true
                  }
                } catch (e) {
                  // fall through to grid fallback
                }

                // If placement failed or returned no placements, use a deterministic grid fallback
                if (!placed) {
                  const count = titles.length
                  const columns = Math.ceil(Math.sqrt(count))
                  const rows = Math.ceil(count / columns)
                  const spacingX = 300
                  const spacingY = 200
                  // center is from earlier (viewport center)
                  const startX = center.x - ((columns - 1) * spacingX) / 2
                  const startY = center.y - ((rows - 1) * spacingY) / 2
                  const fallbackNodes: Node[] = []
                  let idx = 0
                  for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < columns; c++) {
                      if (idx >= count) break
                      const x = startX + c * spacingX
                      const y = startY + r * spacingY
                      fallbackNodes.push({
                        id: `node-${Date.now()}-${idx}`,
                        type: 'default',
                        position: { x, y },
                        data: { title: titles[idx], content: '' },
                      })
                      idx++
                    }
                  }
                  setNodes((nds) => (Array.isArray(nds) ? [...nds, ...fallbackNodes] : [...fallbackNodes]))
                }
              }
            }
            setShowAddNodeModal(false)
            setPendingNodePosition(null)
            setPendingSourceNodeId(null)
          }}
        />
      )}

      {showUnifiedAddModal && (
        <AddNodesModal
          open={showUnifiedAddModal}
          onClose={() => setShowUnifiedAddModal(false)}
          parentNodeTitle={aiParentNodeId ? (nodes.find(n => n.id === aiParentNodeId)?.data as any)?.title : undefined}
          initialAIContext={pendingBoardBrief ? { topic: pendingBoardBrief.boardTopic, description: pendingBoardBrief.description } : undefined}
          onManualSubmit={async ({ titles, description, generateDescription }) => {
            const center = pendingNodePosition || getViewportCenter()
            let desc = (description || '').trim()
            if (generateDescription && titles.length === 1 && !desc) {
              try {
                const service = getOpenAIService()
                if (service) {
                  const titleForAI = titles[0]
                  const prompt = `Write a concise, helpful 1-2 sentence description for a mind-map node titled "${titleForAI}". Keep it clear and actionable. Return plain text only.`
                  const res = await service.generate({ prompt, maxTokens: 120 })
                  desc = (res.content || '').trim()
                }
              } catch {}
            }
            if (pendingSourceNodeId) {
              const nodesToPlace = titles.map((t) => ({ title: t, content: titles.length === 1 ? desc : '', type: 'default' as const, parentId: pendingSourceNodeId }))
              try {
                const result = await placeAINodes(nodesToPlace, pendingSourceNodeId, { preferredDirection: 'down', minDistance: 40 })
                if (result.success && result.placements.length > 0) {
                  const newNodes: Node[] = result.placements.map(p => ({ id: p.node.id, type: p.node.type, position: p.position, data: { ...p.node.data } }))
                  setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
                  if (result.connections.length > 0) {
                    const newEdges: Edge[] = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || 'floating' }))
                    setEdges((eds) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
                  }
                }
              } catch {}
            } else if (titles.length === 1) {
              const target = pendingNodePosition || center
              const newNode: Node = { id: `node-${Date.now()}`, type: 'default', position: target, data: { title: titles[0], content: desc } }
              setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
            } else {
              if (pendingNodePosition) {
                const count = titles.length
                const columns = Math.ceil(Math.sqrt(count))
                const rows = Math.ceil(count / columns)
                const spacingX = 300
                const spacingY = 200
                const startX = pendingNodePosition.x - ((columns - 1) * spacingX) / 2
                const startY = pendingNodePosition.y - ((rows - 1) * spacingY) / 2
                const created: Node[] = []
                let idx = 0
                for (let r = 0; r < rows; r++) {
                  for (let c = 0; c < columns; c++) {
                    if (idx >= count) break
                    const x = startX + c * spacingX
                    const y = startY + r * spacingY
                    created.push({ id: `node-${Date.now()}-${idx}`, type: 'default', position: { x, y }, data: { title: titles[idx], content: '' } })
                    idx++
                  }
                }
                setNodes((nds) => (Array.isArray(nds) ? [...nds, ...created] : [...created]))
              } else {
                const nodesToPlace = titles.map(t => ({ title: t, content: '', type: 'default' as const }))
                let placed = false
                try {
                  const placementResult = await placeBoardNodes(nodesToPlace)
                  if (placementResult.success && placementResult.placements.length > 0) {
                    const newNodes: Node[] = placementResult.placements.map(p => ({ id: p.node.id, type: p.node.type, position: p.position, data: { ...p.node.data } }))
                    setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
                    placed = true
                  }
                } catch {}
                if (!placed) {
                  const count = titles.length
                  const columns = Math.ceil(Math.sqrt(count))
                  const rows = Math.ceil(count / columns)
                  const spacingX = 300
                  const spacingY = 200
                  const startX = center.x - ((columns - 1) * spacingX) / 2
                  const startY = center.y - ((rows - 1) * spacingY) / 2
                  const fallbackNodes: Node[] = []
                  let idx = 0
                  for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < columns; c++) {
                      if (idx >= count) break
                      const x = startX + c * spacingX
                      const y = startY + r * spacingY
                      fallbackNodes.push({ id: `node-${Date.now()}-${idx}`, type: 'default', position: { x, y }, data: { title: titles[idx], content: '' } })
                      idx++
                    }
                  }
                  setNodes((nds) => (Array.isArray(nds) ? [...nds, ...fallbackNodes] : [...fallbackNodes]))
                }
              }
            }
            setShowUnifiedAddModal(false)
          }}
          onAIConfirm={async (items) => {
            try {
              const nodesToPlace = items.map(p => ({ title: p.title, content: p.content || '', parentId: aiParentNodeId || pendingSourceNodeId }))
              const result = await placeAINodes(nodesToPlace, aiParentNodeId || pendingSourceNodeId || undefined, { preferredDirection: 'down', minDistance: 40 })
              if (result.success && result.placements.length > 0) {
                const newNodes: Node[] = result.placements.map(p => ({ id: p.node.id, type: p.node.type, position: p.position, data: { ...p.node.data } }))
                setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
                if (result.connections.length > 0) {
                  const newEdges: Edge[] = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || 'floating' }))
                  setEdges((eds) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
                }
              }
            } catch {}
            setShowUnifiedAddModal(false)
          }}
          onVideoSubmit={(url) => {
            const center = pendingNodePosition || getViewportCenter()
            const newNode: Node = {
              id: `video-${Date.now()}`,
              type: 'video',
              position: center,
              data: { title: 'Video', videoUrl: url, status: 'idle' } as any,
            }
            setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
            setShowUnifiedAddModal(false)
          }}
        />
      )}
      
      {/* Reorganize Menu */}
      <BoardReorganizeMenu
        isOpen={showReorganizeMenu}
        onClose={() => setShowReorganizeMenu(false)}
        nodeCount={nodes.length}
      />
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
