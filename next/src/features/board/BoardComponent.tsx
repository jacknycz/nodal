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
import { useBoardStore } from './boardSlice'
import FloatingEdge from './FloatingEdge'
import CustomConnectionLine from './CustomConnectionLine'
import FloatingActionButton from '../../components/FloatingActionButton'
import AINodeGenerator from '../../components/AINodeGenerator'
import { useAIContext } from '../ai/aiContext'
import { getOpenAIService } from '../ai/aiService'
import BokehBackground from '../../components/BokehBackground'
import ChatPanel2 from '../../components/ChatPanel2'
import TaskList from '../../components/TaskList'
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
  const [remoteCursors, setRemoteCursors] = useState<any[]>([])
  const [myCursor, setMyCursor] = useState<{ x: number; y: number } | null>(null)

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
    }
  }, [boardId])
  
  const [currentBoardName, setCurrentBoardName] = useState('Untitled Board')
  const localBoardIdRef = useRef<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [showAINodeGenerator, setShowAINodeGenerator] = useState(false)
  const [showNodeSetupModal, setShowNodeSetupModal] = useState(false)
  const [showReorganizeMenu, setShowReorganizeMenu] = useState(false)
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: { x: number; y: number } | null;
  }>({
    isOpen: false,
    position: null,
  })
  
  // Autosave state - simplified
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
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

  // Subscribe to remote cursors
  useEffect(() => {
    if (!boardId) return

    // Define fetchCursors first!
    const fetchCursors = async () => {
      const { data } = await supabase
        .from('board_cursors')
        .select('*')
        .eq('board_id', boardId)
      setRemoteCursors(data || [])
    }

    const channel = supabase
      .channel('board-cursors-' + boardId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_cursors',
          filter: `board_id=eq.${boardId}`,
        },
        payload => {
          fetchCursors()
        }
      )
      .subscribe()

    fetchCursors()
    return () => { supabase.removeChannel(channel) }
  }, [boardId])

  // Add node locking state and functions
  const [nodeLocks, setNodeLocks] = useState<any[]>([])

  // Subscribe to node locks
  useEffect(() => {
    if (!boardId) return

    const fetchLocks = async () => {
      // Fetch ALL locks for this board (including expired ones) for debugging
      const { data: allLocks, error: allError } = await supabase
        .from('node_locks')
        .select('*')
        .eq('board_id', boardId)
      
      // Fetch only active locks (normal query)
      const { data, error } = await supabase
        .from('node_locks')
        .select('*')
        .eq('board_id', boardId)
        .gt('expires_at', new Date().toISOString())
      
      // console.log('[BoardComponent] fetchLocks - ALL locks in DB:', allLocks)
      // console.log('[BoardComponent] fetchLocks - ACTIVE locks:', { data, error, boardId })
      setNodeLocks(data || [])
    }

    // Add manual refresh capability for debugging
    ;(window as any).refreshLocks = fetchLocks

    const channel = supabase
      .channel('node-locks-' + boardId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'node_locks',
          filter: `board_id=eq.${boardId}`,
        },
        payload => {
          fetchLocks()
        }
      )
      .subscribe()

    fetchLocks()
    return () => { supabase.removeChannel(channel) }
  }, [boardId])

  // Subscribe to board updates for real-time content sync
  useEffect(() => {
    if (!boardId || !user?.id) return

    // console.log('[BoardComponent] Setting up board_updates subscription for board:', boardId, 'user:', user.id)

    const applyRemoteUpdate = (payload: any) => {
      // console.log('[BoardComponent] RAW subscription payload received:', payload)
      
      const { node_id, update_type, data, user_id } = payload.new || {}
      
      // Don't apply our own updates
      if (user_id === user.id) {
        // console.log('[BoardComponent] Ignoring own update from user:', user_id)
        return
      }
      
      // console.log('[BoardComponent] Received remote update:', { node_id, update_type, data, user_id })
      
      if (update_type === 'content') {
        setNodes((nds) => nds.map((node) => 
          node.id === node_id ? { ...node, data: { ...node.data, ...data } } : node
        ))
        // console.log('[BoardComponent] Applied remote content update to node:', node_id)
      }
    }

    const channel = supabase
      .channel('board-updates-' + boardId)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'board_updates',
          filter: `board_id=eq.${boardId}`,
        },
        applyRemoteUpdate
      )
      .subscribe((status) => {
        // console.log('[BoardComponent] Board updates subscription status:', status)
      })

    // console.log('[BoardComponent] Board updates subscription channel created:', channel)

    return () => { 
      // console.log('[BoardComponent] Cleaning up board_updates subscription')
      supabase.removeChannel(channel) 
    }
  }, [boardId, user?.id, setNodes, supabase])

  // Create functions that get user from stableHandlers to avoid closure issues
  const acquireNodeLock = useCallback(async (nodeId: string) => {
    const currentUser = stableHandlers.currentUser
    // console.log('[BoardComponent] acquireNodeLock useCallback executed with current user:', currentUser)
    // console.log('[BoardComponent] acquireNodeLock called with:', { boardId, userId: currentUser?.id, nodeId })
    
    if (!boardId || !currentUser?.id) {
      // console.log('[BoardComponent] Early return - missing boardId or user.id:', { boardId, userId: currentUser?.id })
      return false
    }
    
    // console.log('[BoardComponent] Attempting to acquire lock:', { boardId, nodeId, userId: currentUser.id })
    
    try {
      const res = await fetch('/api/board/locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, nodeId, userId: currentUser.id })
      })
      
      if (res.ok) {
        // console.log('[BoardComponent] Lock acquired successfully for node:', nodeId)
        return true
      } else {
        const error = await res.json()
        // console.log('[BoardComponent] Failed to acquire lock:', error)
        // console.log('[BoardComponent] Response status:', res.status, res.statusText)
        return false
      }
    } catch (error) {
      // console.error('[BoardComponent] Error acquiring lock:', error)
      return false
    }
  }, [boardId])

  const releaseNodeLock = useCallback(async (nodeId: string) => {
    const currentUser = stableHandlers.currentUser
    // console.log('[BoardComponent] releaseNodeLock called with user?.id:', currentUser?.id)
    if (!boardId || !currentUser?.id) return
    
    // console.log('[BoardComponent] Attempting to release lock:', { boardId, nodeId, userId: currentUser.id })
    
    try {
      const res = await fetch('/api/board/locks', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId, nodeId, userId: currentUser.id })
      })
      
      if (res.ok) {
        // console.log('[BoardComponent] Lock released successfully for node:', nodeId)
      } else {
        const error = await res.json()
        // console.log('[BoardComponent] Failed to release lock:', error)
      }
    } catch (error) {
      // console.error('[BoardComponent] Error releasing lock:', error)
    }
  }, [boardId])

  // Helper to check if node is locked
  const isNodeLocked = useCallback((nodeId: string) => {
    return nodeLocks.some(lock => lock.node_id === nodeId)
  }, [nodeLocks])

  // Helper to get who locked a node
  const getNodeLockOwner = useCallback((nodeId: string) => {
    const lock = nodeLocks.find(lock => lock.node_id === nodeId)
    return lock?.user_id
  }, [nodeLocks])

  // Helper to check if current user locked a node
  const isNodeLockedByMe = useCallback((nodeId: string) => {
    const currentUser = stableHandlers.currentUser
    return nodeLocks.some(lock => lock.node_id === nodeId && lock.user_id === currentUser?.id)
  }, [nodeLocks])

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
  
  // Simple autosave function - KISS principle
  const triggerAutosave = useCallback(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current)
    }
    
    autosaveTimeoutRef.current = setTimeout(async () => {
      if (!localBoardIdRef.current) {
        // console.log('⏭️ Autosave skipped - no board ID')
        return
      }
      
      try {
        // console.log('🚀 Starting autosave...')
        setSaveStatus('saving')
        
        const boardData = {
          nodes,
          edges,
          viewport: reactFlowInstance.getViewport(),
        }
        
        // console.log('💾 Saving board data:', {
        //   boardId: localBoardIdRef.current,
        //   nodesCount: boardData.nodes.length,
        //   edgesCount: boardData.edges.length
        // })
        
        await boardStorage.updateBoard(localBoardIdRef.current, boardData)
        // If this board was created from a template, autosave template data as well
        try {
          if (typeof window !== 'undefined') {
            const tplId = localStorage.getItem(`templateMapping:${localBoardIdRef.current}`)
            if (tplId) {
              // Only update template data during autosave; avoid overwriting template name
              await templateStorage.updateTemplate(tplId, { data: boardData })
            }
          }
        } catch (err) {
          // Don't block board save on template save failures
        }
        
        // console.log('✅ Autosave completed successfully')
        setSaveStatus('saved')
        setHasUnsavedChanges(false)
        
        if (onBoardStateChange) {
          onBoardStateChange(currentBoardName, 'saved', false)
        }
      } catch (error) {
        // console.error('❌ Autosave failed:', error)
        setSaveStatus('error')
        setHasUnsavedChanges(true)
        
        if (onBoardStateChange) {
          onBoardStateChange(currentBoardName, 'error', true)
        }
      }
    }, 2000) // 2 second delay
  }, [nodes, edges, reactFlowInstance, currentBoardName])
  
  // Store the current triggerAutosave function in a ref to avoid dependency issues
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
      triggerAutosaveRef.current()
    }
    
    // Update previous values
    prevNodesRef.current = nodes
    prevEdgesRef.current = edges
  }, [nodes, edges, currentBoardName, saveStatus])
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current)
      }
    }
  }, [])

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
      })
      // If user provided manual starter nodes, prioritize those and skip AI
      if (Array.isArray(brief.starterNodes) && brief.starterNodes.length > 0) {
        const nodesToPlace = brief.starterNodes.map(title => ({ title, content: '', type: 'default' as const }))
        try {
          const rect = document.querySelector('.react-flow')?.getBoundingClientRect()
          const viewport = reactFlowInstance.getViewport()
          const placementResult = await (async () => {
            // Fan placement centered on topic
            const req = {
              nodes: nodesToPlace,
              context: {
                existingNodes: [topicNode] as any,
                existingEdges: [],
                viewport: { x: viewport.x, y: viewport.y, zoom: viewport.zoom, width: rect?.width || window.innerWidth, height: rect?.height || window.innerHeight },
                selectedNodeIds: [],
                focusNode: topicNode,
                constraints: { minDistance: 40, avoidOverlap: true, preferredDirection: 'down' },
              },
              strategy: PlacementStrategy.AI_GENERATION,
              algorithm: LayoutAlgorithm.FAN,
              options: { radius: 250, verticalOffset: 60 },
            } as any
            // We don't have direct placeNodes from hook; rely on placement engine via Board creation util when exposed
            // Temporarily approximate: map to manual fan fallback if unavailable
            return { success: false, placements: [], connections: [] } as any
          })()
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
            const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null }
            await boardStorage.updateBoard(boardId, boardData)
            setSaveStatus('saved')
            setHasUnsavedChanges(false)
            if (onBoardStateChange) onBoardStateChange(brief.boardName, 'saved', false)
            router.push(`/board/${boardId}`)
            return
          }
        } catch {}
        // Fallback: manual fan around topic
        const count = brief.starterNodes.length
        const radius = 250
        const angleCenter = Math.PI / 2
        const angleStep = (Math.PI) / Math.max(count, 1)
        const generatedNodes = brief.starterNodes.map((title, index) => {
          const angle = angleCenter - (angleStep * ((count - 1) / 2 - index))
          const position = { x: 500 + radius * Math.cos(angle), y: 400 + radius * Math.sin(angle) }
          return { id: `starter-node-${Date.now()}-${index}`, type: 'default' as const, position, data: { title, content: '' } }
        })
        const generatedEdges = generatedNodes.map(n => ({ id: `edge-${Date.now()}-${n.id}`, source: topicNode.id, target: n.id, type: 'floating' as const }))
        setNodes([topicNode, ...generatedNodes])
        setEdges(generatedEdges as any)
        const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null }
        await boardStorage.updateBoard(boardId, boardData)
        setSaveStatus('saved')
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
              type: 'default' as const
            }))
            // Fan placement using topic as parent
            const rect = document.querySelector('.react-flow')?.getBoundingClientRect()
            const viewport = reactFlowInstance.getViewport()
            const placementResult = { success: false, placements: [], connections: [] } as any

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
              const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null }
              await boardStorage.updateBoard(boardId, boardData)
            } else {
              // Fallback to simple fan around topic
              const count = nodesToPlace.length
              const radius = 250
              const angleCenter = Math.PI / 2
              const angleStep = (Math.PI) / Math.max(count, 1)
              const generatedNodes = nodesToPlace.map((n: any, index: number) => {
                const angle = angleCenter - (angleStep * ((count - 1) / 2 - index))
                const position = { x: 500 + radius * Math.cos(angle), y: 400 + radius * Math.sin(angle) }
                return { id: `starter-node-${Date.now()}-${index}`, type: 'default' as const, position, data: { title: n.title, content: n.content } }
              })
              const generatedEdges = generatedNodes.map(n => ({ id: `edge-${Date.now()}-${n.id}`, source: topicNode.id, target: n.id, type: 'floating' as const }))
              setNodes([topicNode, ...generatedNodes])
              setEdges(generatedEdges as any)
              const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null }
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
            const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null }
            await boardStorage.updateBoard(boardId, boardData)
          }
          
          // Update save status
          setSaveStatus('saved')
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
        const boardData = { nodes: [topicNode, newNode], edges: [newEdge] as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null }
        
        // console.log('💾 Saving single generated node immediately...')
        await boardStorage.updateBoard(boardId, boardData)
        // console.log('✅ Single generated node saved successfully')
        
        // Update save status
        setSaveStatus('saved')
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
          await boardStorage.saveBoardWithId(boardId, boardName, boardData)
          // console.log('🔵 CREATING BLANK BOARD with ID:', boardId, 'for name:', boardName)
          setCurrentBoardName(boardName)
          setSaveStatus('saved')
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
          setSaveStatus('error')
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
  
  // Save board function
  const saveBoard = useCallback(async (name?: string) => {
    // console.log('💾 saveBoard called with name:', name, 'localBoardId:', localBoardIdRef.current)
    try {
      // console.log('🚀 Starting manual save...')
      setSaveStatus('saving')
      setHasUnsavedChanges(false)
      
      const boardData = {
        nodes,
        edges,
        viewport: reactFlowInstance.getViewport(),
      }
      
      // console.log('💾 Manual save data:', {
      //   nodesCount: boardData.nodes.length,
      //   edgesCount: boardData.edges.length,
      //   boardId: localBoardIdRef.current
      // })
      
      if (localBoardIdRef.current && !name) {
        await boardStorage.updateBoard(localBoardIdRef.current, boardData)
        // console.log('✅ Updated existing board:', localBoardIdRef.current)
      } else {
        const boardName = name || `Board ${new Date().toLocaleDateString()}`
        const boardId = await boardStorage.saveBoard(boardName, boardData)
        // console.log('🆕 Created new board:', boardId, 'with name:', boardName)
        localBoardIdRef.current = boardId
        setCurrentBoardName(boardName)
      }
      
      // console.log('✅ Manual save completed successfully')
      setSaveStatus('saved')
      
      if (onBoardStateChange) {
        // console.log('🔄 Updating board state: saved, false')
        onBoardStateChange(currentBoardName, 'saved', false)
      }
    } catch (error) {
      // console.error('❌ Manual save failed:', error)
      setSaveStatus('error')
      setHasUnsavedChanges(true)
      
      if (onBoardStateChange) {
        // console.log('🔄 Updating board state: error, true')
        onBoardStateChange(currentBoardName, 'error', true)
      }
    }
  }, [nodes, edges, localBoardIdRef.current, currentBoardName, reactFlowInstance, onBoardStateChange])


  
  // Handle document upload - Memoize to prevent event listener recreation
  const handleDocumentUpload = useCallback(async (file: File, position?: { x: number; y: number }) => {
    const dropPosition = position || getViewportCenter()
    const nodeId = `document-${Date.now()}`
    
    // Upload file to Supabase Storage first
    try {
      // console.log('📤 Uploading file to Supabase Storage:', file.name)
      const documentId = await boardStorage.saveDocument(
        file.name,
        file,
        '', // Empty extracted text for now
        localBoardIdRef.current || 'temp',
        nodeId
      )
      
      // console.log('✅ File uploaded successfully, documentId:', documentId)
      
      // Create the node with file metadata (no File object)
      const signedUrl = await supabaseStorage.getSignedUrl(documentId);
      const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name)
      const newNode: any = {
        id: nodeId,
        type: isImage ? 'image' : 'document',
        position: dropPosition,
        data: {
          title: file.name,
          type: isImage ? 'image' : 'document',
          fileName: file.name,
          fileType: file.type || 'unknown',
          fileSize: file.size,
          status: 'processing' as const,
          extractedText: '',
          documentId, // Store the document ID instead of File object
          previewUrl: signedUrl, // Store the signed URL
        },
      }
      handleAddNodeToStore(newNode)
      
      // Extract text if the file type supports it
      if (isTextExtractable(file.type, file.name)) {
        try {
          // console.log('🔍 Starting client-side text extraction for:', file.name)
          
          // Dynamic import to avoid SSR issues
          const { extractTextFromFile } = await import('../storage/textExtractor')
          const extractedText = await extractTextFromFile(file, file.type, file.name)
          
          if (extractedText && extractedText.length > 0) {
            // console.log(`✅ Text extracted successfully: ${extractedText.length} characters`)
            
            // Update the node with extracted text
            setNodes((currentNodes) => {
              if (!Array.isArray(currentNodes)) return currentNodes
              return currentNodes.map(node => 
                node.id === nodeId 
                  ? { ...node, data: { ...node.data, extractedText, status: 'ready' } }
                  : node
              )
            })
          } else {
            // console.log('⚠️ No text was extracted from the file')
            setNodes((currentNodes) => {
              if (!Array.isArray(currentNodes)) return currentNodes
              return currentNodes.map(node => 
                node.id === nodeId 
                  ? { ...node, data: { ...node.data, status: 'ready' } }
                  : node
              )
            })
          }
        } catch (error) {
          // console.error('❌ Client-side text extraction failed:', error)
          setNodes((currentNodes) => {
            if (!Array.isArray(currentNodes)) return currentNodes
            return currentNodes.map(node => 
              node.id === nodeId 
                ? { 
                    ...node, 
                    data: { 
                      ...node.data, 
                      extractedText: `Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                      status: 'error' 
                    } 
                  }
                : node
            )
          })
        }
      } else {
        // For non-extractable files, mark as ready
        setNodes((currentNodes) => {
          if (!Array.isArray(currentNodes)) return currentNodes
          return currentNodes.map(node => 
            node.id === nodeId 
              ? { ...node, data: { ...node.data, status: 'ready' } }
              : node
          )
        })
      }
    } catch (error) {
      // console.error('❌ Failed to upload file to Supabase:', error)
      // Create node with error status
      const isImage2 = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(file.name)
      const newNode: any = {
        id: nodeId,
        type: isImage2 ? 'image' : 'document',
        position: dropPosition,
        data: {
          title: file.name,
          type: isImage2 ? 'image' : 'document',
          fileName: file.name,
          fileType: file.type || 'unknown',
          fileSize: file.size,
          status: 'error' as const,
          extractedText: 'File upload failed',
        },
      }
      handleAddNodeToStore(newNode)
    }
  }, [handleAddNodeToStore, isTextExtractable, setNodes, localBoardIdRef])

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
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault()
        saveBoard()
      } else if (event.key === 'Escape') {
        // Clear focus on Escape
        useBoardStore.getState().clearFocusedNodes()
        ;(window as any).__focusedNodeIds = []
        setNodes((nds) => Array.isArray(nds) ? [...nds] : nds)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [saveBoard])
  
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
      focusedNodeIds: useBoardStore.getState().focusedNodeIds,
      toggleFocusOnNode: (nodeId: string) => {
        useBoardStore.getState().toggleFocusOnNode(nodeId, true)
        setNodes((nds) => Array.isArray(nds) ? [...nds] : nds)
      },
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

  // Focus state wiring for nodes (exposed to node components via window for now)
  useEffect(() => {
    // keep global copy only for legacy consumers; nodes now receive focused ids via props
    (window as any).__focusedNodeIds = useBoardStore.getState().focusedNodeIds || []
  }, [nodes])

  const handleOpenAINodeGenerator = useCallback(() => {
    setShowAINodeGenerator(true)
  }, [])

  const [showAddNodeModal, setShowAddNodeModal] = useState(false)
  const [pendingNodePosition, setPendingNodePosition] = useState<{ x: number; y: number } | null>(null)
  const [pendingSourceNodeId, setPendingSourceNodeId] = useState<string | null>(null)

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
        onPaneClick={() => {
          setContextMenu({ isOpen: false, position: null })
          // Clear focus when clicking empty space
          useBoardStore.getState().clearFocusedNodes()
          ;(window as any).__focusedNodeIds = []
          clearConnecting()
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
        fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 2 }}
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
        <div className="hidden sm:block">
          <MiniMap />
        </div>

        <div className="hidden sm:block absolute bottom-4 left-16 z-10">
          <div className="p-2 bg-white/80 dark:bg-gray-800/80 rounded-lg shadow-lg backdrop-blur-sm">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              💡 Tip: Drag & drop documents and images here
            </p>
          </div>
        </div>
        
        {/** Removed FAB and ChatPanel from inside ReactFlow to avoid stacking context issues */}
      </ReactFlow>
      {isBoardView && (
        <FloatingActionButton
          onAddNode={() => {
            setShowAddNodeModal(true)
          }}
          onAIGenerate={handleOpenAINodeGenerator}
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
        <TaskList />
      )}
      
      {/* Context Menu */}
      <BoardContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={() => setContextMenu({ isOpen: false, position: null })}
        nodeId={pendingSourceNodeId}
        onAddConnectedNodes={(nodeId: string) => {
          if (contextMenu.position) {
            const flowPosition = reactFlowInstance.screenToFlowPosition({
              x: contextMenu.position.x,
              y: contextMenu.position.y,
            })
            setPendingNodePosition(flowPosition)
          }
          setPendingSourceNodeId(nodeId)
          setShowAddNodeModal(true)
          setContextMenu({ isOpen: false, position: null })
        }}
        onAddBlankNode={() => {
          // Store the position and show the modal instead of creating a blank node
          if (contextMenu.position) {
            const flowPosition = reactFlowInstance.screenToFlowPosition({
              x: contextMenu.position.x,
              y: contextMenu.position.y,
            });
            setPendingNodePosition(flowPosition);
          }
          setPendingSourceNodeId(null)
          setShowAddNodeModal(true);
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
        onGenerateAINode={handleOpenAINodeGenerator}
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
            />
          )}
          {/* NodeSetupModal deprecated for add-new-node; using NodeEditModal instead */}
          {isBoardView && (
            <>
              <FloatingActionButton
                onAddNode={() => {
                  setShowAddNodeModal(true)
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
          onSubmit={async ({ titles, description }) => {
            const center = pendingNodePosition || getViewportCenter()
            // If we have a parent (right-clicked node), use AI fan placement centered under parent
            if (pendingSourceNodeId) {
              const nodesToPlace = titles.map((t) => ({ title: t, content: titles.length === 1 ? description : '', type: 'default' as const }))
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
              // Single node: honor click by finding best position near the pending point
              const target = pendingNodePosition || center
              const finalPos = await findBestPosition(target, titles[0], description, { avoidOverlap: true, minDistance: 50 })
              const newNode: Node = {
                id: `node-${Date.now()}`,
                type: 'default',
                position: finalPos,
                data: { title: titles[0], content: description },
              }
              setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
            } else {
              // Multiple nodes: if we have a click position, place each near the click using manual placement
              if (pendingNodePosition) {
                const radius = 220
                const angleStep = (2 * Math.PI) / titles.length
                const created: Node[] = []
                for (let i = 0; i < titles.length; i++) {
                  const t = titles[i]
                  const base = {
                    x: pendingNodePosition.x + Math.cos(i * angleStep) * radius,
                    y: pendingNodePosition.y + Math.sin(i * angleStep) * radius,
                  }
                  const result = await findBestPosition(base, t, '', { avoidOverlap: true, minDistance: 50 })
                  const node: Node = {
                    id: `node-${Date.now()}-${i}`,
                    type: 'default',
                    position: result,
                    data: { title: t, content: '' },
                  }
                  created.push(node)
                }
                setNodes((nds) => (Array.isArray(nds) ? [...nds, ...created] : [...created]))
              } else {
                const nodesToPlace = titles.map(t => ({ title: t, content: '', type: 'default' as const }))
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
                  }
                } catch {
                  const fallbackNodes: Node[] = titles.map((t, i) => ({
                    id: `node-${Date.now()}-${i}`,
                    type: 'default',
                    position: { x: center.x + i * 60, y: center.y + 150 },
                    data: { title: t, content: '' },
                  }))
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
