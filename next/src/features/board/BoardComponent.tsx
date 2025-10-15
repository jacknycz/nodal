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
import HeadlineNode from '../nodes/HeadlineNode'
import TaskNode from '../nodes/TaskNode'
import VideoNode from '../nodes/VideoNode'
import LinkNode from '../nodes/LinkNode'
import { useBoardStore } from './boardSlice'
import FloatingEdge from './FloatingEdge'
import FloatingStraightEdge from './FloatingStraightEdge'
import FloatingStepEdge from './FloatingStepEdge'
import FloatingSmoothEdge from './FloatingSmoothEdge'
// import RemoteCursor from '../collab/RemoteCursor'
// import useYCursorPresence from '../collab/useYCursorPresence'
import CustomConnectionLine from './CustomConnectionLine'
import FloatingActionButton from '../../components/FloatingActionButton'
import AINodeGenerator from '../../components/AINodeGenerator'
import AddNodesModal from '../../components/AddNodesModal'
import { useAIContext } from '../ai/aiContext'
import { getOpenAIService } from '../ai/aiService'
import BokehBackground from '../../components/BokehBackground'
import { SpinnerGap } from '@phosphor-icons/react/ssr'
import ChatPanel from '../../components/ChatPanel'
import TaskList from '../../components/TaskList'
import ColorgoryManager from '../../components/ColorgoryManager'
import LeftDock from '../../components/LeftDock'
import OmniSearch from '../../components/OmniSearch'
import { useTheme } from '../../contexts/ThemeContext'
import TopicModal from '../../components/TopicModal'
import type { BoardBrief } from './boardTypes'
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
import Toast from '../../components/ui/Toast'
import useBoardRealtime from './useBoardRealtime'
import useBoardAutosave from './useBoardAutosave'
import useNodeActions from './useNodeActions'
import useDocumentUpload from './useDocumentUpload'
import useBoardShortcuts from './useBoardShortcuts'
import NodeEditModal from '../../components/NodeEditModal'

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
  link: (props: any) => <LinkNode {...props} {...stableHandlers} />,
  headline: (props: any) => <HeadlineNode {...props} {...stableHandlers} />,
};

export const edgeTypes = {
  floating: (props: any) => <FloatingEdge {...props} onEdgeDelete={stableHandlers.onEdgeDelete} />,
  'floating-straight': (props: any) => <FloatingStraightEdge {...props} onEdgeDelete={stableHandlers.onEdgeDelete} />,
  'floating-step': (props: any) => <FloatingStepEdge {...props} onEdgeDelete={stableHandlers.onEdgeDelete} />,
  'floating-smoothstep': (props: any) => <FloatingSmoothEdge {...props} onEdgeDelete={stableHandlers.onEdgeDelete} />,
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
  // Collaborative cursor presence (yjs)

  // Centralized realtime subscriptions: cursors, locks, and board updates
  const {
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
          const savedEdgeType = (saved?.data as any)?.meta?.edgeType as any
          if (savedEdgeType) {
            useBoardStore.getState().setEdgeType?.(savedEdgeType)
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
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string>('')
  const [quickAiGenerating, setQuickAiGenerating] = useState(false)
  const edgeTypePref = useBoardStore((s: any) => s.edgeType || 'floating')
  const toVisualEdgeType = useCallback((pref: string) => {
    switch (pref) {
      case 'straight': return 'floating-straight'
      case 'step': return 'floating-step'
      case 'smoothstep': return 'floating-smoothstep'
      case 'floating': return 'floating'
      case 'bezier': default: return 'floating'
    }
  }, [])

  // Mobile: single-tap opens context menu (simulate right-click)
  useEffect(() => {
    let startX = 0
    let startY = 0
    let startT = 0
    let startTarget: EventTarget | null = null
    let startInCanvas = false
    const TAP_MAX_MS = 300
    const MOVE_CANCEL_PX = 10
    let isTracking = false
    let suppressNextClickUntil = 0
    const justClosedUntilRef = { current: 0 }

    const cancel = () => { isTracking = false; startTarget = null }

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { cancel(); return }
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      startT = Date.now()
      startTarget = e.target
      isTracking = true
      // Limit handling to the board canvas area only
      try {
        const el = (e.target as HTMLElement) || null
        startInCanvas = !!(el && (el.closest('.react-flow') || el.closest('.xyflow')))
        if (!startInCanvas) { isTracking = false; return }
      } catch { startInCanvas = false }

      // If context menu is already open
      try {
        const targetEl = (e.target as HTMLElement) || null
        const insideMenu = !!(targetEl && targetEl.closest('[data-board-context-menu]'))
        if (contextMenuOpenRef.current) {
          if (insideMenu) {
            // Let taps inside menu pass through; don't track to avoid reopening
            isTracking = false
            return
          }
          // Tapped outside menu while open: close and consume this tap
          e.preventDefault(); e.stopPropagation()
          setContextMenu({ isOpen: false, position: null })
          isTracking = false
          suppressNextClickUntil = Date.now() + 300
          justClosedUntilRef.current = suppressNextClickUntil
          return
        }
        // If tap starts inside menu container while closed (edge case), ignore
        if (insideMenu) { isTracking = false; return }
      } catch {}
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!isTracking) return
      const t = e.touches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) cancel()
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!isTracking) return
      const dt = Date.now() - startT
      const t = (e.changedTouches && e.changedTouches[0]) || null
      const endX = t ? t.clientX : startX
      const endY = t ? t.clientY : startY
      const dx = endX - startX
      const dy = endY - startY
      const moved = Math.hypot(dx, dy)
      // Treat as tap if quick and not moved much
      if (dt <= TAP_MAX_MS && moved <= MOVE_CANCEL_PX && startInCanvas) {
        if (Date.now() < justClosedUntilRef.current) { cancel(); return }
        try {
          e.preventDefault()
          e.stopPropagation()
        } catch {}
        try {
          const elAtPoint = (startTarget as HTMLElement) || (document.elementFromPoint(endX, endY) as HTMLElement)
          let el: HTMLElement | null = elAtPoint
          let nodeId: string | null = null
          while (el && el !== document.body) {
            try {
              const cls = el.classList ? Array.from(el.classList) : []
              if (cls.some((c) => c === 'react-flow__node' || c === 'xyflow__node')) {
                nodeId = el.getAttribute('data-id') || null
                break
              }
              el = el.parentElement
            } catch { break }
          }
          // If tap ended inside the menu container, do nothing
          const endTarget = (e.target as HTMLElement) || null
          if (endTarget && endTarget.closest('[data-board-context-menu]')) { cancel(); return }
          setPendingSourceNodeId(nodeId)
          setContextMenu({ isOpen: true, position: { x: endX, y: endY } })
          suppressNextClickUntil = Date.now() + 350
        } catch {}
      }
      cancel()
    }

    document.addEventListener('touchstart', onTouchStart as any, { capture: true })
    document.addEventListener('touchmove', onTouchMove as any, { capture: true })
    document.addEventListener('touchend', onTouchEnd as any, { capture: true })
    const onClickCapture = (e: MouseEvent) => {
      if (suppressNextClickUntil && Date.now() < suppressNextClickUntil) {
        // Allow clicks inside the context menu itself
        const target = e.target as HTMLElement | null
        if (target && (target.closest('[data-board-context-menu]') || target.closest('[role="dialog"]'))) return
        e.preventDefault()
        e.stopPropagation()
        suppressNextClickUntil = 0
      }
    }
    document.addEventListener('click', onClickCapture, true)
    return () => {
      document.removeEventListener('touchstart', onTouchStart as any, true)
      document.removeEventListener('touchmove', onTouchMove as any, true)
      document.removeEventListener('touchend', onTouchEnd as any, true)
      document.removeEventListener('click', onClickCapture, true)
    }
  }, [])

  const showAddToast = useCallback((kind: 'added' | 'generated', count: number) => {
    if (!count || count < 1) return
    const noun = count === 1 ? 'node' : 'nodes'
    const verb = kind === 'generated' ? (count === 1 ? 'Generated' : 'Generated') : (count === 1 ? 'Added' : 'Added')
    const article = count === 1 ? 'a ' : ''
    const msg = `${verb} ${article}${count === 1 ? noun : count + ' ' + noun}!`
    setToastMessage(msg)
    setToastOpen(true)
  }, [])
  
  // Close LeftDock panels on click-away / Escape / external right-click
  useEffect(() => {
    if (!isBoardView) return

    const handleGlobalPointer = (e: MouseEvent | TouchEvent) => {
      if (!leftDockActive) return
      const target = e.target as Element | null
      if (!target) return
      const insideDock = target.closest?.('[data-left-dock]')
      const insidePanel = target.closest?.('[data-left-dock-panel]')
      if (!insideDock && !insidePanel) {
        setLeftDockActive(null)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && leftDockActive) {
        setLeftDockActive(null)
      }
    }

    document.addEventListener('mousedown', handleGlobalPointer, true)
    document.addEventListener('touchstart', handleGlobalPointer, true)
    document.addEventListener('contextmenu', handleGlobalPointer, true)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleGlobalPointer, true)
      document.removeEventListener('touchstart', handleGlobalPointer, true)
      document.removeEventListener('contextmenu', handleGlobalPointer, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [leftDockActive, isBoardView])
  
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

  // (cursor presence paused)

  // --- History (undo/redo) ---
  type Snapshot = { nodes: Node[]; edges: Edge[]; viewport: any }
  const pastRef = useRef<Snapshot[]>([])
  const futureRef = useRef<Snapshot[]>([])
  const isRestoringRef = useRef(false)
  const HISTORY_LIMIT = 5

  const broadcastHistoryState = useCallback(() => {
    try { window.dispatchEvent(new CustomEvent('nodal:history-state', { detail: { canUndo: pastRef.current.length > 0, canRedo: futureRef.current.length > 0 } })) } catch {}
  }, [])

  const captureSnapshot = useCallback((): Snapshot => {
    return { nodes: Array.isArray(nodes) ? [...nodes] : [], edges: Array.isArray(edges) ? [...edges] : [], viewport: reactFlowInstance.getViewport() }
  }, [nodes, edges, reactFlowInstance])

  const pushHistory = useCallback(() => {
    if (isRestoringRef.current) return
    const snap = captureSnapshot()
    pastRef.current = [...pastRef.current, snap].slice(-HISTORY_LIMIT)
    futureRef.current = []
    broadcastHistoryState()
  }, [captureSnapshot, broadcastHistoryState])

  const undo = useCallback(() => {
    if (pastRef.current.length === 0) return
    isRestoringRef.current = true
    const current = captureSnapshot()
    const prev = pastRef.current[pastRef.current.length - 1]
    pastRef.current = pastRef.current.slice(0, -1)
    futureRef.current = [...futureRef.current, current].slice(-HISTORY_LIMIT)
    setNodes(prev.nodes)
    setEdges(prev.edges)
    try { reactFlowInstance.setViewport(prev.viewport, { duration: 0 }) } catch {}
    isRestoringRef.current = false
    broadcastHistoryState()
  }, [captureSnapshot, setNodes, setEdges, reactFlowInstance, broadcastHistoryState])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return
    isRestoringRef.current = true
    const current = captureSnapshot()
    const next = futureRef.current[futureRef.current.length - 1]
    futureRef.current = futureRef.current.slice(0, -1)
    pastRef.current = [...pastRef.current, current].slice(-HISTORY_LIMIT)
    setNodes(next.nodes)
    setEdges(next.edges)
    try { reactFlowInstance.setViewport(next.viewport, { duration: 0 }) } catch {}
    isRestoringRef.current = false
    broadcastHistoryState()
  }, [captureSnapshot, setNodes, setEdges, reactFlowInstance, broadcastHistoryState])
  const centerOnPositions = (positions: { x: number; y: number }[], opts?: { align?: 'center' | 'rightCenter' | 'midLeft' }) => {
    if (!positions || positions.length === 0) return
    try {
      const cx = positions.reduce((s, p) => s + p.x, 0) / positions.length
      const cy = positions.reduce((s, p) => s + p.y, 0) / positions.length
      if (opts?.align === 'rightCenter') {
        const rect = (document.querySelector('.react-flow') as HTMLElement | null)?.getBoundingClientRect()
        const screenW = rect?.width || window.innerWidth
        const screenH = rect?.height || window.innerHeight
        const zoom = Math.max(0.8, Math.min(1.2, reactFlowInstance.getZoom()))
        // Place node center near the right edge with a small margin so it's fully visible
        const rightMargin = 180 // px from right edge
        const targetScreenX = Math.max(0, screenW - rightMargin)
        const targetScreenY = Math.max(0, screenH * 0.5)
        // For setViewport, mapping is: screen = flow * zoom + translation
        const x = targetScreenX - cx * zoom
        const y = targetScreenY - cy * zoom
        reactFlowInstance.setViewport({ x, y, zoom }, { duration: 600 })
        return
      }
      if (opts?.align === 'midLeft') {
        const rect = (document.querySelector('.react-flow') as HTMLElement | null)?.getBoundingClientRect()
        const screenW = rect?.width || window.innerWidth
        const screenH = rect?.height || window.innerHeight
        const zoom = Math.max(0.8, Math.min(1.2, reactFlowInstance.getZoom()))
        // For midLeft, caller should pass left-edge x for x values and center y for y values
        const targetScreenX = screenW * 0.5
        const targetScreenY = screenH * 0.5
        const x = targetScreenX - cx * zoom
        const y = targetScreenY - cy * zoom
        reactFlowInstance.setViewport({ x, y, zoom }, { duration: 600 })
        return
      }
      reactFlowInstance.setCenter(cx, cy, { zoom: Math.max(0.8, Math.min(1.2, reactFlowInstance.getZoom())), duration: 600 })
    } catch {}
  }
  const centerOnNodeIds = (ids: string[], opts?: { align?: 'center' | 'rightCenter' | 'midLeft' }) => {
    if (!ids || ids.length === 0) return
    setTimeout(() => {
      try {
        const setIds = new Set(ids)
        const nodes = reactFlowInstance.getNodes().filter(n => setIds.has(n.id))
        if (nodes.length === 0) return
        let positions: { x: number; y: number }[]
        if (opts?.align === 'midLeft') {
          positions = nodes.map(n => ({ x: n.position.x, y: n.position.y + (((n as any).height || 140) / 2) }))
        } else {
          positions = nodes.map(n => ({ x: n.position.x + ((n as any).width || 240) / 2, y: n.position.y + ((n as any).height || 140) / 2 }))
        }
        centerOnPositions(positions, opts)
        const targetId = nodes[0].id
        const nodeOuter = document.querySelector(`.react-flow__node[data-id="${targetId}"]`) as HTMLElement | null
        const nodeInner = nodeOuter?.querySelector(':scope > div') as HTMLElement | null
        const el = nodeInner || nodeOuter
        if (el) { el.classList.add('node-pulse-highlight'); window.setTimeout(() => el.classList.remove('node-pulse-highlight'), 1500) }
      } catch {}
    }, 50)
  }
  const setConnectingSource = useBoardStore((s: any) => s.setConnectingSource)
  
  // Send local cursor at ~20Hz in board coordinates
  // Capture directly from ReactFlow mouse move for consistent coords

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

  // Remote cursor rendering disabled
  
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
  const colorgoriesState = useBoardStore((s: any) => s.colorgories || [])
  const prevColorgoriesRef = useRef<any[]>([])
  const contextMenuOpenRef = useRef<boolean>(false)
  useEffect(() => { contextMenuOpenRef.current = (typeof contextMenu?.isOpen === 'boolean' ? contextMenu.isOpen : false) }, [contextMenu?.isOpen])

  // Helper: ignore transient view-only properties (like node position/selection) when checking for real changes
  const normalizeNodesForCompare = useCallback((list: Node[] = []) => {
    try {
      return list.map((n: any) => ({
        id: n?.id,
        type: n?.type,
        data: n?.data, // include real content/props
        // position is intentionally omitted to avoid saves on drag
        // selected/dragging/positionAbsolute omitted as well
        width: (n as any)?.width, // keep width/resizes as a meaningful change
        height: (n as any)?.height,
      }))
    } catch {
      return list
    }
  }, [])

  // When edge type preference changes, update existing edges
  useEffect(() => {
    setEdges((eds) => (Array.isArray(eds) ? eds.map(e => ({ ...e, type: toVisualEdgeType(edgeTypePref) as any })) : eds))
  }, [edgeTypePref, setEdges, toVisualEdgeType])

  // Persist edge type preference changes even if there are no edges/nodes changes
  useEffect(() => {
    if (!isInitializedRef.current) return
    if (!localBoardIdRef.current) return
    // Mark and autosave current state including meta.edgeType
    setHasUnsavedChanges(true)
    if (onBoardStateChangeRef.current) {
      onBoardStateChangeRef.current(currentBoardName, 'saving', true)
    }
    triggerAutosaveRef.current(nodes, edges)
  }, [edgeTypePref])
  
  // Simple effect to trigger autosave when nodes/edges change (excluding pure position/selection moves)
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
    
    // Check if nodes or edges have actually changed (ignoring transient position/selection)
    const nodesChanged = JSON.stringify(normalizeNodesForCompare(nodes)) !== JSON.stringify(normalizeNodesForCompare(prevNodesRef.current))
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
  }, [nodes, edges, currentBoardName, saveStatus, normalizeNodesForCompare])
  
  // Trigger save when colorgories (names/order/visibility) change
  useEffect(() => {
    if (!isInitializedRef.current) return
    if (saveStatus === 'saving') return
    const changed = JSON.stringify(colorgoriesState) !== JSON.stringify(prevColorgoriesRef.current)
    if (changed) {
      setHasUnsavedChanges(true)
      if (onBoardStateChangeRef.current) {
        onBoardStateChangeRef.current(currentBoardName, 'saving', true)
      }
      // Always use manualSave so we persist even when nodes/edges are empty
      manualSave(nodes, edges).catch(() => {})
      prevColorgoriesRef.current = colorgoriesState
    }
  }, [colorgoriesState, nodes, edges, saveStatus, currentBoardName, manualSave])
  
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
      // Do not auto-generate a description for the topic node per spec

      // If user provided manual starter nodes, prioritize those and skip AI
      if (Array.isArray(brief.starterNodes) && brief.starterNodes.length > 0) {
        // Optionally generate descriptions for each starter node
        const descriptionsByTitle: Record<string, string> = {}
        if (brief.generateDescriptionsForStarter) {
          try {
            if (aiService) {
              for (const t of brief.starterNodes) {
                const prompt = brief.boardTopic
                  ? `Given the board topic "${brief.boardTopic}", write a concise, helpful 1-2 sentence description for a mind-map node titled "${t}" in that context. Keep it clear and actionable. Return plain text only.`
                  : `Write a concise, helpful 1-2 sentence description for a mind-map node titled "${t}". Keep it clear and actionable. Return plain text only.`
                const res = await aiService.generate({ prompt, maxTokens: 120 })
                const d = (res.content || '').trim()
                if (d) descriptionsByTitle[t] = d
              }
            }
          } catch {}
        }
        // Deterministic single-row placement under parent (match reorg fallback)
        const count = brief.starterNodes.length
        const cellWidth = 300
        const padding = 60
        const rowY = topicNode.position.y + (cellWidth - 100)
        const groupWidth = (count * cellWidth) + Math.max(0, count - 1) * padding
        const startX = topicNode.position.x - groupWidth / 2 + cellWidth / 2
        const generatedNodes = brief.starterNodes.map((title, index) => {
          const position = { x: startX + index * (cellWidth + padding), y: rowY }
          return { id: `starter-node-${Date.now()}-${index}`, type: 'default' as const, position, data: { title, content: descriptionsByTitle[title] || '' } }
        })
        const generatedEdges = generatedNodes.map(n => ({ id: `edge-${Date.now()}-${n.id}`, source: topicNode.id, target: n.id, type: toVisualEdgeType(edgeTypePref) as any }))
        setNodes([topicNode, ...generatedNodes])
        setEdges(generatedEdges as any)
        const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
        await boardStorage.updateBoard(boardId, boardData)
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
            // Deterministic single-row placement under parent (match reorg fallback)
            const nodesToPlace = nodeDataArray.map((nodeData: any) => ({ title: nodeData.label, content: nodeData.content }))
              const count = nodesToPlace.length
            const cellWidth = 300
            const padding = 60
            const rowY = topicNode.position.y + (cellWidth - 100)
            const groupWidth = (count * cellWidth) + Math.max(0, count - 1) * padding
            const startX = topicNode.position.x - groupWidth / 2 + cellWidth / 2
              const generatedNodes = nodesToPlace.map((n: any, index: number) => {
              const position = { x: startX + index * (cellWidth + padding), y: rowY }
                return { id: `starter-node-${Date.now()}-${index}`, type: 'default' as const, position, data: { title: n.title, content: n.content } }
              })
            const generatedEdges = generatedNodes.map(n => ({ id: `edge-${Date.now()}-${n.id}`, source: topicNode.id, target: n.id, type: toVisualEdgeType(edgeTypePref) as any }))
              setNodes([topicNode, ...generatedNodes])
              setEdges(generatedEdges as any)
              const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
              await boardStorage.updateBoard(boardId, boardData)
            
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
            const generatedEdges = generatedNodes.map(n => ({ id: `edge-${Date.now()}-${n.id}`, source: topicNode.id, target: n.id, type: toVisualEdgeType(edgeTypePref) as any }))
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
        const newEdge = { id: `edge-${Date.now()}-${newNode.id}`, source: topicNode.id, target: newNode.id, type: toVisualEdgeType(edgeTypePref) as any }
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
  const { placeAINodes, placeBoardNodes, placeManualNode, findBestPosition, reorganizeBoardLayout } = usePlacement()
  const { reorganizeSubtree } = usePlacement()
  const [creatingBoard, setCreatingBoard] = useState(false)
  
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
          setCreatingBoard(true)
          await boardStorage.saveBoardWithId(boardId, boardName, { ...boardData, colorgories: useBoardStore.getState().colorgories || [] })
          // console.log('🔵 CREATING BLANK BOARD with ID:', boardId, 'for name:', boardName)
          setCurrentBoardName(boardName)
          // Save state handled by autosave hook; avoid using setSaveStatus here
          if (onBoardStateChange) {
            onBoardStateChange(boardName, 'saved', false)
          }
          // console.log('✅ Blank board created and saved:', boardName)
          // Always create and persist a topic node immediately so the board is interactive
          const topicNodeId = `topic-${boardId}`
          const topicNode = {
            id: topicNodeId,
            type: 'default' as const,
            position: { x: 500, y: 400 },
            data: { title: pendingBoardBrief.boardTopic, content: '' },
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
            topic: pendingBoardBrief.boardTopic || null,
            colorgories: useBoardStore.getState().colorgories || []
          })
          // If startWithAI is true, now generate AI nodes to update the same board
          if (pendingBoardBrief.startWithAI) {
            // console.log('🤖 Starting AI generation for board ID:', boardId)
            await generateStarterNodes(pendingBoardBrief, boardId)
            setCreatingBoard(false)
          } else {
            // No AI/starters: navigate immediately to the board now that topic exists
            setCreatingBoard(false)
            router.push(`/board/${boardId}`)
          }
        } catch (error) {
          // console.error('Failed to create blank board:', error)
          // Save state handled by autosave hook
          if (onBoardStateChange) {
            onBoardStateChange(boardName, 'error', false)
          }
          setCreatingBoard(false)
        }
      })()
    }
    
    // Mark as initialized
    isInitializedRef.current = true
  }, [initialBoard, pendingBoardBrief, clearPendingBoardBrief, boardId, boardName]) // Removed setNodes, setEdges from dependencies
  
  // Handle connections
  const onConnect = useCallback(
    (params: Connection) => {
      pushHistory()
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: params.source!,
        target: params.target!,
        type: toVisualEdgeType(edgeTypePref) as any,
      }
      setEdges((eds) => {
        const list = Array.isArray(eds) ? eds : []
        const exists = list.some((e: any) => (
          (e.source === newEdge.source && e.target === newEdge.target) ||
          (e.source === newEdge.target && e.target === newEdge.source)
        ))
        if (exists) return eds
        return [...list, newEdge]
      })
      try { channelRef.current?.send({ type: 'broadcast', event: 'edge:add', payload: { edge: newEdge, userId: user?.id || null, ts: Date.now() } }) } catch {}
    },
    [setEdges, edgeTypePref, toVisualEdgeType, pushHistory, boardId, user?.id]
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
      pushHistory()
      const newEdge: Edge = {
        id: `edge-${Date.now()}`,
        source: sourceId,
        target: targetId,
        type: toVisualEdgeType(edgeTypePref) as any,
      }
      setEdges((eds) => {
        const list = Array.isArray(eds) ? eds : []
        const exists = list.some((e: any) => (
          (e.source === newEdge.source && e.target === newEdge.target) ||
          (e.source === newEdge.target && e.target === newEdge.source)
        ))
        if (exists) return eds
        return [...list, newEdge]
      })
      try { channelRef.current?.send({ type: 'broadcast', event: 'edge:add', payload: { edge: newEdge, userId: user?.id || null, ts: Date.now() } }) } catch {}
    }
    done()
  }, [setEdges, clearConnecting, pushHistory])
  
  // Handle adding nodes
  const handleAddNode = useCallback((nodeData: { title: string; content?: string }, position: { x: number; y: number }) => {
    pushHistory()
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
  }, [setNodes, pushHistory])

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

  // Open a mobile-safe file picker and handle upload
  const openUploadPicker = useCallback(() => {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      // Accept images, documents, and supported video uploads (mp4)
      input.accept = '.pdf,.doc,.docx,.txt,.md,.markdown,.csv,.json,.png,.jpg,.jpeg,.gif,.webp,.svg,.heic,image/*,.mp4,video/mp4'
      // Ensure element stays alive during native picker
      input.style.position = 'fixed'
      input.style.left = '-9999px'
      document.body.appendChild(input)

      const cleanup = () => {
        try { document.body.removeChild(input) } catch {}
      }

      input.addEventListener('change', () => {
        const file = input.files?.[0]
        if (file) {
          const viewportCenter = getViewportCenter()
          handleDocumentUpload(file, viewportCenter)
          showAddToast('added', 1)
        }
        cleanup()
      }, { once: true })

      // Some browsers fire 'cancel' when user closes picker without selecting
      input.addEventListener('cancel', () => cleanup(), { once: true } as any)

      input.click()
    } catch (err) {
      console.error('Failed to open file picker', err)
    }
  }, [getViewportCenter, handleDocumentUpload, showAddToast])

  // Drag and drop handlers
  const [isDragOver, setIsDragOver] = useState(false)
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const editingNodeIdRef = useRef<string | null>(null)
  const lastEditedNodeIdRef = useRef<string | null>(null)

  // Handle XYFlow's selection changes
  const handleSelectionChange = useCallback(({ nodes }: { nodes: BoardNode[] }) => {
    const selectedIds = nodes.map(node => node.id)
    const enforced = editingNodeIdRef.current ? Array.from(new Set([...selectedIds, editingNodeIdRef.current])) : selectedIds
    setSelectedNodes(enforced)
    useBoardStore.getState().setSelectedNodes(enforced)
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
                'image/webp',
                'image/svg+xml',
                'video/mp4'
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
                file.name.endsWith('.webp') ||
                file.name.endsWith('.svg') ||
                file.name.toLowerCase().endsWith('.mp4')
            })

              if (validFiles.length > 1) {
                setShowPasteLimitModal(true)
              } else if (validFiles.length === 1) {
                const file = validFiles[0]
                  const flowPosition = reactFlowInstance.screenToFlowPosition({
                    x: e.clientX,
                    y: e.clientY,
                  })
                  handleDocumentUpload(file, flowPosition)
                showAddToast('added', 1)
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
  }, [handleDocumentUpload, showAddToast])
  
  // Paste handler: supports URLs (video/link) and files (image/pdf/etc.)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      try {
        // Skip when focus is in an editor/input or contentEditable
        const active = (document.activeElement as HTMLElement | null)
        if (active) {
          const tag = active.tagName?.toLowerCase()
          if (tag === 'input' || tag === 'textarea' || (active as any).isContentEditable) return
        }
        const cd = e.clipboardData
        if (!cd) return
        const center = pendingNodePosition || getViewportCenter()

        // If files are present, prefer files
        if (cd.files && cd.files.length > 0) {
          if (cd.files.length > 1) {
            // Block multi-item paste
            e.preventDefault()
            setShowPasteLimitModal(true)
            return
          }
          const files = Array.from(cd.files)
          const hasProcessable = files.some(f => !!f.type)
          if (hasProcessable) {
            e.preventDefault()
            // Only allow one
            const file = files[0]
            handleDocumentUpload(file as File, center)
            showAddToast('added', 1)
            return
          }
        }

        // Otherwise, check for a URL in text
        const text = cd.getData('text') || cd.getData('text/plain') || ''
        const trimmed = (text || '').trim()
        if (!trimmed) return
        // Heuristic: if clipboard contains multiple lines that each look like URLs, block
        const lines = trimmed.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
        if (lines.length > 1) {
          const urlish = lines.filter(l => /^https?:\/\//i.test(l))
          if (urlish.length > 1) {
            e.preventDefault()
            setShowPasteLimitModal(true)
            return
          }
        }
        let url: URL | null = null
        try { url = new URL(trimmed) } catch {}
        if (!url) return
        e.preventDefault()

        const href = url.toString()
        const host = url.hostname.toLowerCase()
        const isYouTube = host.includes('youtube.com') || host.includes('youtu.be')

        if (isYouTube) {
          const newNode: Node = {
            id: `video-${Date.now()}`,
            type: 'video',
            position: center,
            data: { title: 'Video', videoUrl: href, status: 'idle' } as any,
          }
          setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
          showAddToast('added', 1)
        } else {
          const newNode: Node = {
            id: `link-${Date.now()}`,
            type: 'link',
            position: center,
            data: { title: 'Link', linkUrl: href, status: 'idle' } as any,
          }
          setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
          showAddToast('added', 1)
        }
      } catch {}
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [getViewportCenter, handleDocumentUpload, setNodes, showAddToast])
  
  // Keyboard shortcuts via hook
  useBoardShortcuts(() => { saveBoard() })
  
  // Handler functions
  const handleNodeDelete = useCallback((nodeId: string) => {
    console.log('[BoardComponent] handleNodeDelete called for', nodeId)
    pushHistory()
    setNodes((nds) => (Array.isArray(nds) ? nds.filter((node) => node.id !== nodeId) : nds))
    setEdges((eds) => (Array.isArray(eds) ? eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId) : eds))
    try {
      const store = useBoardStore.getState()
      const selected = store.selectedNodeIds || []
      if (selected.includes(nodeId)) {
        store.setSelectedNodes(selected.filter((id: string) => id !== nodeId))
      }
    } catch {}
    setTimeout(() => {
      const store = useBoardStore.getState()
      console.log('[BoardComponent] post-delete nodes', (store.nodes || []).length, 'edges', (store.edges || []).length)
    }, 0)
    if (onDeleteNode) onDeleteNode(nodeId)
  }, [onDeleteNode, setNodes, setEdges, pushHistory])

  // Fallback: respond to global delete events
  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ id: string }>
      const id = ce?.detail?.id
      if (typeof id === 'string' && id) {
        handleNodeDelete(id)
      }
    }
    window.addEventListener('nodal:delete-node', handler as EventListener)
    return () => window.removeEventListener('nodal:delete-node', handler as EventListener)
  }, [handleNodeDelete])

  // Expose a global delete function so external UI (context menu) can always delete reliably
  useEffect(() => {
    (window as any).__deleteNodeFromBoard = (id: string) => {
      if (typeof id === 'string' && id) handleNodeDelete(id)
    }
    return () => { try { delete (window as any).__deleteNodeFromBoard } catch {} }
  }, [handleNodeDelete])

  // Intercept Delete key to confirm before deleting
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') return
      // Ignore when editing inputs/editors
      const active = document.activeElement as HTMLElement | null
      if (active) {
        const tag = active.tagName
        if (active.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA') return
      }
      const selectedIds: string[] = useBoardStore.getState().selectedNodeIds || []
      if (selectedIds.length > 0) {
        e.preventDefault()
        e.stopPropagation()
        setShowKeyboardDeleteModal(true)
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [])

  // Ensure right-click on selection overlay opens our pane context menu (not pass-through)
  useEffect(() => {
    const isSelectionOverlay = (ev: Event) => {
      const path: any[] = (ev as any).composedPath ? (ev as any).composedPath() : []
      const testEl = (el: any) => {
        try {
          if (!el || !el.classList) return false
          const cls = Array.from(el.classList)
          return cls.some((c: string) => (
            c === 'react-flow__selection' ||
            c === 'react-flow__selection-rect' ||
            c === 'xyflow__selection' ||
            c === 'xyflow__selection-rect'
          ))
        } catch { return false }
      }
      if (path.length) return path.some(testEl)
      const t = ev.target as any
      if (typeof t?.closest === 'function') {
        if (t.closest('.react-flow__selection') || t.closest('.react-flow__selection-rect') || t.closest('.xyflow__selection') || t.closest('.xyflow__selection-rect')) return true
      }
      return false
    }

    const onContextMenu = (e: MouseEvent) => {
      if (!isSelectionOverlay(e)) return
      e.preventDefault()
      e.stopPropagation()
      setPendingSourceNodeId(null)
      setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY } })
    }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 2) return
      if (!isSelectionOverlay(e)) return
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('contextmenu', onContextMenu, true)
    document.addEventListener('mousedown', onMouseDown, true)
    return () => {
      document.removeEventListener('contextmenu', onContextMenu, true)
      document.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [])

  const handleNodeUpdate = useCallback(async (nodeId: string, updates: Partial<{ label: string; title: string; content: string }>) => {
    pushHistory()
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
  }, [setNodes, boardId, user?.id, supabase, pushHistory])

  const handleEdgeDelete = useCallback((edgeId: string) => {
    pushHistory()
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId))
    try { channelRef.current?.send({ type: 'broadcast', event: 'edge:remove', payload: { edgeId, userId: user?.id || null, ts: Date.now() } }) } catch {}
  }, [setEdges, pushHistory, boardId, user?.id])

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
        type: toVisualEdgeType(edgeTypePref) as any,
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
      isNodeLockedNow: (nodeId: string) => {
        try {
          const map = (window as any).__wsLocks || {}
          const by = map[nodeId]
          const me = user?.id || ''
          return !!(by && by !== me)
        } catch { return false }
      },
      onNodeShiftClickConnect: handleShiftClickConnect,
      onQuickAddNodes: (nodeId: string) => {
        setPendingSourceNodeId(nodeId)
        setShowUnifiedAddModal(true)
      },
      onOrganizeSubtree: (nodeId: string) => reorganizeSubtree(nodeId),
      onLiveResize: (nodeId: string, width: number) => {
        const now = Date.now()
        const last = lastLiveSentRef.current || 0
        if (now - last > 80) {
          lastLiveSentRef.current = now
          try { channelRef.current?.send({ type: 'broadcast', event: 'node:resize', payload: { nodeId, width: Math.round(width), userId: user?.id || null, ts: now } }) } catch {}
        }
      },
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
    // wsLocks removed here; nodes read from window.__wsLocks dynamically
  ])

  

  

  const [showAddNodeModal, setShowAddNodeModal] = useState(false)
  const [showUnifiedAddModal, setShowUnifiedAddModal] = useState(false)
  const [pendingNodePosition, setPendingNodePosition] = useState<{ x: number; y: number } | null>(null)
  const [awaitingNodePlacement, setAwaitingNodePlacement] = useState(false)
  const [pendingSourceNodeId, setPendingSourceNodeId] = useState<string | null>(null)
  const [editNodeId, setEditNodeId] = useState<string | null>(null)
  const editorMode = !!editNodeId
  const [showKeyboardDeleteModal, setShowKeyboardDeleteModal] = useState(false)
  // Task assignment UI state (to avoid calling hooks inside conditional renders)
  const [taskAssignOptions, setTaskAssignOptions] = useState<Array<{ value: string; label: string }> | null>(null)
  const [taskAssignee, setTaskAssignee] = useState<string | null>(null)

  // Load board members once when opening a task for edit; also seed current assignee from node
  useEffect(() => {
    (async () => {
      if (!editNodeId) return
      try {
        const n = nodes.find((nn: any) => nn.id === editNodeId)
        if (n && n.type === 'task') {
          try { setTaskAssignee(((n.data as any)?.assigneeId) || null) } catch {}
          if (taskAssignOptions === null) {
            const bid = useBoardStore.getState().currentBoardId
            if (bid) {
              try {
                const res = await fetch(`/api/board/members?boardId=${encodeURIComponent(bid)}`)
                const json = await res.json()
                if (res.ok && Array.isArray(json.members)) {
                  const opts = json.members.map((m: any) => ({ value: m.userId as string, label: (m.username || m.email || m.userId) as string }))
                  setTaskAssignOptions(opts)
                } else {
                  setTaskAssignOptions([])
                }
              } catch { setTaskAssignOptions([]) }
            } else {
              setTaskAssignOptions([])
            }
          }
        }
      } catch {}
    })()
  }, [editNodeId, nodes, taskAssignOptions])
  const [showPasteLimitModal, setShowPasteLimitModal] = useState(false)
  
  // Supabase Realtime: broadcast + presence for live updates
  const [wsLocks, setWsLocks] = useState<Record<string, string>>({})
  const channelRef = useRef<any>(null)
  useEffect(() => {
    if (!boardId || !user?.id) return
    const channel = getSupabaseClient().channel(`board:${boardId}`, {
      config: { broadcast: { self: false }, presence: { key: user.id } }
    })
    channel
      .on('broadcast', { event: 'node:content' }, (p: any) => {
        const { nodeId, patch, userId: from } = p.payload || {}
        if ((user?.id || '') === from) return
        if (!nodeId || !patch || typeof patch !== 'object') return
        setNodes((nds) => (Array.isArray(nds) ? nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n) : nds))
      })
      .on('broadcast', { event: 'node:pos' }, (p: any) => {
        const { nodeId, x, y, userId: from } = p.payload || {}
        if ((user?.id || '') === from) return
        if (!nodeId || typeof x !== 'number' || typeof y !== 'number') return
        setNodes((nds) => (Array.isArray(nds) ? nds.map(n => n.id === nodeId ? { ...n, position: { x, y } } : n) : nds))
      })
      .on('broadcast', { event: 'node:resize' }, (p: any) => {
        const { nodeId, width, userId: from } = p.payload || {}
        if ((user?.id || '') === from) return
        if (!nodeId || typeof width !== 'number') return
        setNodes((nds) => (Array.isArray(nds) ? nds.map(n => n.id === nodeId ? { ...n, data: { ...(n.data as any), width } } : n) : nds))
      })
      .on('broadcast', { event: 'edge:add' }, (p: any) => {
        const { edge, userId: from } = p.payload || {}
        if ((user?.id || '') === from) return
        if (!edge || !edge.id) return
        setEdges((eds) => {
          const list = Array.isArray(eds) ? eds : []
          const exists = list.some((e: any) => e.id === edge.id || ((e.source === edge.source && e.target === edge.target) || (e.source === edge.target && e.target === edge.source)))
          return exists ? eds : [...list, edge]
        })
      })
      .on('broadcast', { event: 'edge:remove' }, (p: any) => {
        const { edgeId, userId: from } = p.payload || {}
        if ((user?.id || '') === from) return
        if (!edgeId) return
        setEdges((eds) => (Array.isArray(eds) ? eds.filter(e => e.id !== edgeId) : eds))
      })
      .on('presence', { event: 'sync' }, () => {
        try {
          const state = channel.presenceState() as Record<string, any[]>
          const map: Record<string, string> = {}
          Object.keys(state || {}).forEach((uid) => {
            const arr = state[uid] || []
            const latest = arr[arr.length - 1] || {}
            const editing = latest?.editingNodeId
            if (editing) map[editing] = uid
          })
          setWsLocks(map)
          ;(window as any).__wsLocks = map
        } catch {}
      })
    channel.subscribe(async (status: any) => {
      if (status === 'SUBSCRIBED') {
        try { await channel.track({ userId: user.id, editingNodeId: null }) } catch {}
      }
    })
    channelRef.current = channel
    return () => {
      try { getSupabaseClient().removeChannel(channel) } catch {}
      channelRef.current = null
    }
  }, [boardId, user?.id])

  const sendBroadcast = useCallback((event: string, payload: any) => {
    try { channelRef.current?.send({ type: 'broadcast', event, payload }) } catch {}
  }, [])

  const lastLiveSentRef = useRef<number>(0)
  const sendLivePatch = useCallback((nodeId: string, patch: any) => {
    try {
      const now = Date.now()
      if (now - lastLiveSentRef.current < 80) return
      lastLiveSentRef.current = now
      sendBroadcast('node:content', { nodeId, patch, userId: user?.id || null, ts: now })
    } catch {}
  }, [boardId, user?.id, sendBroadcast])

  // Live position broadcasting (throttled per node)
  const lastPosSentRef = useRef<Record<string, number>>({})
  const draggingRef = useRef<Set<string>>(new Set())
  const handleNodesChange = useCallback((changes: any[]) => {
    onNodesChange(changes)
    const now = Date.now()
    for (const ch of changes) {
      if (ch?.type === 'position' && ch?.position && ch?.id) {
        const id = ch.id as string
        if (ch.dragging) {
          draggingRef.current.add(id)
          const last = lastPosSentRef.current[id] || 0
          if (now - last > 80) {
            lastPosSentRef.current[id] = now
            channelRef.current?.send({ type: 'broadcast', event: 'node:pos', payload: { nodeId: id, x: ch.position.x, y: ch.position.y, userId: user?.id || null, ts: now } })
          }
        } else {
          draggingRef.current.delete(id)
          channelRef.current?.send({ type: 'broadcast', event: 'node:pos', payload: { nodeId: id, x: ch.position.x, y: ch.position.y, userId: user?.id || null, ts: now } })
        }
      }
    }
  }, [onNodesChange, boardId, user?.id])
  
  // Release lock when modal closes or component unmounts
  useEffect(() => {
    return () => {
      const id = editNodeId
      if (id && boardId && user?.id) {
        releaseNodeLockRaw(boardId, id, user.id)
      }
    }
  }, [editNodeId, boardId, user?.id, releaseNodeLockRaw])

  const handleCloseEditModal = useCallback(() => {
    try {
      if (editNodeId && boardId && user?.id) {
        releaseNodeLockRaw(boardId, editNodeId, user.id)
        try { channelRef.current?.track({ userId: user.id, editingNodeId: null }) } catch {}
        console.log('[locks] released & tracked unlock', { nodeId: editNodeId, boardId })
      }
    } catch {}
    setEditNodeId(null)
  }, [editNodeId, boardId, user?.id, releaseNodeLockRaw])

  // Safety: release lock if tab closes while editing
  useEffect(() => {
    const onBeforeUnload = () => {
      try {
        if (editNodeId && boardId && user?.id) {
          navigator.sendBeacon?.('/api/board/locks', new Blob([JSON.stringify({ boardId, nodeId: editNodeId, userId: user.id })], { type: 'application/json' }))
        }
      } catch {}
    }
    if (editorMode) {
      window.addEventListener('beforeunload', onBeforeUnload)
    }
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [editorMode, editNodeId, boardId, user?.id])

  // Cleanup: remove edges that reference nodes that no longer exist (prevents "runaway" edges)
  useEffect(() => {
    if (!Array.isArray(nodes) || nodes.length === 0) return
    if (!Array.isArray(edges) || edges.length === 0) return
    try {
      const validNodeIds = new Set((nodes || []).map((n: any) => n.id))
      setEdges((eds) => {
        const list = Array.isArray(eds) ? eds : []
        const cleaned = list.filter((e: any) => validNodeIds.has(e?.source) && validNodeIds.has(e?.target))
        return cleaned.length !== list.length ? cleaned : eds
      })
    } catch {}
  }, [nodes, edges, setEdges])

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
    // History events
    const onUndo = () => undo()
    const onRedo = () => redo()
    window.addEventListener('nodal:undo', onUndo as EventListener)
    window.addEventListener('nodal:redo', onRedo as EventListener)
    // Immediate save trigger (e.g., from ColorgoryManager changes)
    const saveNow = (e: Event) => {
      if (!localBoardIdRef.current) return
      manualSave(nodes, edges).catch(() => {})
    }
    window.addEventListener('nodal:save-now', saveNow as EventListener)
    return () => {
      window.removeEventListener('nodal:chat-updated', handler as EventListener)
      window.removeEventListener('nodal:undo', onUndo as EventListener)
      window.removeEventListener('nodal:redo', onRedo as EventListener)
      window.removeEventListener('nodal:save-now', saveNow as EventListener)
    }
  }, [saveStatus, currentBoardName, nodes, edges, manualSave, undo, redo])

  // Update local name when renamed via settings modal
  useEffect(() => {
    const onName = (ev: any) => {
      const id = ev?.detail?.boardId
      const name = ev?.detail?.name
      if (!id || !name) return
      if (id !== boardId) return
      try { setCurrentBoardName(name) } catch {}
    }
    window.addEventListener('nodal:board-name-updated', onName as EventListener)
    return () => window.removeEventListener('nodal:board-name-updated', onName as EventListener)
  }, [boardId])

  // External trigger: open edit modal for a node (e.g., from TaskList)
  useEffect(() => {
    const onEditNode = (ev: any) => {
      try {
        const nodeId = ev?.detail?.id as string | undefined
        if (!nodeId) return
        ;(async () => {
          try {
            if (!boardId) { setEditNodeId(nodeId); return }
            const ok = await acquireNodeLockRaw(boardId, nodeId, user?.id || null)
            if (!ok) {
              alert('This node is currently being edited by someone else.')
              return
            }
            try { channelRef.current?.track({ userId: user?.id || null, editingNodeId: nodeId }) } catch {}
            setEditNodeId(nodeId)
            try { centerOnNodeIds([nodeId], { align: 'midLeft' }) } catch {}
          } catch {
            setEditNodeId(nodeId)
            try { centerOnNodeIds([nodeId], { align: 'midLeft' }) } catch {}
          }
        })()
      } catch {}
    }
    window.addEventListener('nodal:edit-node', onEditNode as EventListener)
    return () => window.removeEventListener('nodal:edit-node', onEditNode as EventListener)
  }, [boardId, user?.id, centerOnNodeIds])

  // Broadcast editor mode and toggle a root class for global styling (e.g., hide headers)
  useEffect(() => {
    try {
      const open = !!editNodeId
      document.documentElement.classList.toggle('nodal-editor-mode', open)
      window.dispatchEvent(new CustomEvent('nodal:editor-mode', { detail: { open } }))
    } catch {}
    return () => {
      try { document.documentElement.classList.remove('nodal-editor-mode') } catch {}
    }
  }, [editNodeId])

  // Ensure the node being edited remains in the board's selected set for chat context
  useEffect(() => {
    if (editNodeId) {
      editingNodeIdRef.current = editNodeId
      lastEditedNodeIdRef.current = editNodeId
      try { useBoardStore.getState().addSelectedNode(editNodeId) } catch {}
    } else {
      // On close, unpin previously edited node from selection if present
      const prev = lastEditedNodeIdRef.current
      if (prev) {
        try {
          const current = Array.from(useBoardStore.getState().selectedNodeIds || [])
          const filtered = current.filter(id => id !== prev)
          useBoardStore.getState().setSelectedNodes(filtered)
          setSelectedNodes(filtered)
        } catch {}
      }
      editingNodeIdRef.current = null
      lastEditedNodeIdRef.current = null
    }
  }, [editNodeId])

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
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
          onNodeContextMenu={(event: React.MouseEvent, node: any) => {
            if (editorMode) { event.preventDefault(); return }
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
          if (editorMode) { event.preventDefault(); return }
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
        // Disable built-in Delete behavior; we show a confirm modal instead
      >
        {/* Remove the Background component - BokehBackground will handle the background */}
        <div className="hidden sm:block">
          <Controls showInteractive={false} showFitView={true} showZoom={true} />
        </div>
        {/* Place MiniMap bottom-left next to Controls */}
        <MiniMap
          className="hidden sm:block !bg-white/80 dark:!bg-gray-900/70 !rounded-md !shadow-lg"
          style={{ position: 'absolute', left: 30, bottom: 0, right: 'auto', top: 'auto', width: 160, height: 104 }}
        />
        
        {/* (cursor presence paused) */}
        
        {/** Removed FAB and ChatPanel from inside ReactFlow to avoid stacking context issues */}
      </ReactFlow>
      
      {isBoardView && (
        <LeftDock
          active={leftDockActive}
          onToggle={(key) => setLeftDockActive(prev => (prev === key ? null : key))}
        />
      )}
      {isBoardView && !editorMode && (
        <FloatingActionButton
          onAddNode={() => {
            console.log('[BoardComponent] onAddNode called')
            try {
              // Ensure we're adding from a clean state like the context menu's blank add
              setPendingSourceNodeId(null)
              try {
                const center = getViewportCenter()
                setPendingNodePosition(center)
              } catch {
                setPendingNodePosition(null)
              }
              // Defer opening to avoid any event ordering conflicts with the menu
              setTimeout(() => { console.log('[BoardComponent] opening AddNodesModal now'); setShowUnifiedAddModal(true) }, 0)
            } catch {
              console.warn('[BoardComponent] onAddNode fallback immediate open')
            setShowUnifiedAddModal(true)
            }
          }}
          onAIGenerate={() => setShowUnifiedAddModal(true)}
          onUploadDocument={openUploadPicker}
          onReorganize={() => setShowReorganizeMenu(true)}
          aiInitialized={aiInitialized}
          nodeCount={nodes.length}
        />
      )}
      {isBoardView && (
        <div className={editorMode ? 'hidden lg:block' : ''}>
          <ChatPanel />
        </div>
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
              <li><strong>Cmd/Ctrl + click</strong> nodes to multi-select.</li>
              <li><strong>Shift + click</strong> a second node to quickly connect to the first.</li>
              <li><strong>Shift + drag</strong> to marquee-select multiple nodes.</li>
              <li><strong>Right‑click</strong> the board or a node for context actions.</li>
              <li><strong>Drag & drop</strong> images or PDFs to create Image/Document nodes.</li>
              <li><strong>Paste</strong> a single file or URL to create a node (one at a time).</li>
              <li><strong>Double‑click</strong> a node to expand or open editing.</li>
              <li><strong>Use the FAB</strong> to add a Task/Headline, upload, or generate with AI.</li>
              <li><strong>Use MiniMap/Controls</strong> to navigate large boards quickly.</li>
              <li><strong>Delete/Backspace</strong> removes selected nodes. Use Undo/Redo from the Left Dock if needed.</li>
            </ul>
          </div>
        </div>
      )}
      {isBoardView && (
        <div className={editorMode ? 'hidden lg:block' : ''}>
        <OmniSearch />
        </div>
      )}
      {/* Removed old Tips button; now opened via LeftDock */}
      
      {/* Context Menu */}
      <BoardContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={() => setContextMenu({ isOpen: false, position: null })}
        nodeId={pendingSourceNodeId}
        isLockedByOther={(() => {
          try {
            if (!pendingSourceNodeId) return false
            const wsLockedBy = wsLocks[pendingSourceNodeId]
            return !!(wsLockedBy && wsLockedBy !== (user?.id || ''))
          } catch { return false }
        })()}
        onEditNode={(nodeId: string) => {
          console.log('[BoardComponent] Open edit modal for', nodeId)
          ;(async () => {
            try {
              if (!boardId) { setEditNodeId(nodeId); return }
              const ok = await acquireNodeLockRaw(boardId, nodeId, user?.id || null)
              if (!ok) {
                alert('This node is currently being edited by someone else.')
                return
              }
              // Presence lock
              try { channelRef.current?.track({ userId: user?.id || null, editingNodeId: nodeId }) } catch {}
              console.log('[locks] acquired & tracked lock', { nodeId, boardId })
              setEditNodeId(nodeId)
              try { centerOnNodeIds([nodeId], { align: 'midLeft' }) } catch {}
            } catch {
              setEditNodeId(nodeId)
              try { centerOnNodeIds([nodeId], { align: 'midLeft' }) } catch {}
            }
          })()
        }}
        onUpdateNode={(nodeId: string, updates: Record<string, any>) => {
          handleNodeUpdate(nodeId, updates)
        }}
        onDeleteNode={(nodeId: string) => {
          console.log('[BoardComponent] onDeleteNode prop called for', nodeId)
          handleNodeDelete(nodeId)
          setContextMenu({ isOpen: false, position: null })
          setPendingSourceNodeId(null)
        }}
        onAddConnectedNodes={(nodeId: string, screenPos: { x: number; y: number }) => {
          console.log('[BoardComponent] Context: Add Node(s) for', nodeId, 'at', screenPos)
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
          pushHistory()
          const newId = `task-${Date.now()}`
          const newNode: Node = {
            id: newId,
            type: 'task',
            position: flowPosition,
            data: { title: '', content: '', completed: false, focusOnMount: true },
          }
          setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
          showAddToast('added', 1)
          // Open the edit modal immediately for quick entry
          setTimeout(() => {
            try {
              setEditNodeId(newId)
              centerOnNodeIds([newId], { align: 'midLeft' })
            } catch {}
          }, 0)
          if (pendingSourceNodeId) {
            const newEdge: Edge = { id: `edge-${Date.now()}`, source: pendingSourceNodeId, target: newId, type: toVisualEdgeType(edgeTypePref) as any }
            setEdges((eds) => {
              const list = Array.isArray(eds) ? eds : []
              const exists = list.some((e: any) => (
                (e.source === newEdge.source && e.target === newEdge.target) ||
                (e.source === newEdge.target && e.target === newEdge.source)
              ))
              if (exists) return eds
              return [...list, newEdge]
            })
          }
          setContextMenu({ isOpen: false, position: null })
          setPendingSourceNodeId(null)
          setPendingNodePosition(null)
        }}
        onAddHeadlineNode={() => {
          if (!contextMenu.position) return
          const flowPosition = reactFlowInstance.screenToFlowPosition({
            x: contextMenu.position.x,
            y: contextMenu.position.y,
          })
          pushHistory()
          const newId = `headline-${Date.now()}`
          const newNode: Node = {
            id: newId,
            type: 'headline',
            position: flowPosition,
            data: { title: 'New headline', titleSize: 'sm' },
          }
          setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
          showAddToast('added', 1)
          setContextMenu({ isOpen: false, position: null })
          setPendingSourceNodeId(null)
          setPendingNodePosition(null)
        }}
        onGenerateAINode={() => {
          handleOpenAINodeGenerator()
          setContextMenu({ isOpen: false, position: null })
        }}
        onQuickAIGenerateNodes={async (nodeId?: string | null) => {
          try {
            setQuickAiGenerating?.(true)
            console.log('[QuickAI] start, nodeId:', nodeId)
            const store = useBoardStore.getState()
            const nodesList = store.nodes || []
            const edgesList = store.edges || []
            const topic = store.topic || pendingBoardBrief?.boardTopic || ''
            const parentOf: Record<string, string> = {}
            edgesList.forEach((e: any) => {
              const s = e?.source; const t = e?.target
              if (typeof s === 'string' && typeof t === 'string' && !parentOf[t]) parentOf[t] = s
            })
            const selectedId = nodeId || (store.selectedNodeIds?.[0] ?? null)
            const selectedNode = nodesList.find(n => n.id === selectedId)
            // Attach generated nodes to the selected node itself (not its parent)
            const attachParentId = selectedNode ? selectedNode.id : undefined
            const contextTitle = selectedNode?.data?.title || ''
            const contextContent = (selectedNode?.data?.content || (selectedNode?.data as any)?.extractedText || (selectedNode?.data as any)?.extracted_text || '') as string
            console.log('[QuickAI] selectedId:', selectedId, 'title:', contextTitle, 'content.len:', contextContent?.length || 0, 'topic:', topic)

            const ai = getOpenAIService()
            if (!ai) { console.warn('[QuickAI] ai service unavailable'); return }
            const promptParts = [
              topic && `Board topic: ${topic}`,
              contextTitle && `Selected node: ${contextTitle}`,
              contextContent && `Context: ${contextContent}`,
              'Generate 4-6 concise related nodes (JSON only): { "nodes": [ { "title": "...", "content": "..." } ] }'
            ].filter(Boolean)
            const prompt = promptParts.join('\n\n')
            const sys = 'You generate contextually relevant child ideas. Return strict JSON only.'
            const res = await ai.generate({ prompt, systemPrompt: sys, temperature: 0.8 })
            const raw = (res.content || '').trim()
            let items: any[] = []
            try {
              const fenced = raw.match(/```json\s*([\s\S]*?)\s*```/i)
              const text = fenced ? fenced[1] : raw
              let parsed: any
              try { parsed = JSON.parse(text) } catch {}
              if (Array.isArray(parsed?.nodes)) {
                items = parsed.nodes
              } else if (Array.isArray(parsed)) {
                items = parsed
              } else {
                const nodesArrayMatch = text.match(/"nodes"\s*:\s*(\[\s*[\s\S]*?\])/i)
                if (nodesArrayMatch) {
                  try { items = JSON.parse(nodesArrayMatch[1]) } catch {}
                }
                if (!items || items.length === 0) {
                  const jsonMatch = text.match(/\{[\s\S]*\}/)
                  if (jsonMatch) {
                    try {
                      const obj = JSON.parse(jsonMatch[0])
                      if (Array.isArray(obj?.nodes)) items = obj.nodes
                    } catch {}
                  }
                }
              }
            } catch {}
            if (!items || items.length === 0) {
              const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(l => l)
              const candidates = lines.map(l => l.replace(/^[-*\d\.\)\s]+/, '').trim()).filter(l => l.length > 0).slice(0, 6)
              if (candidates.length > 0) items = candidates.map(t => ({ title: t, content: '' }))
            }
            console.log('[QuickAI] parsed items count:', items?.length || 0)
            if (!items || items.length === 0) { console.warn('[QuickAI] no items parsed from AI'); return }
            const nodesToPlace = items.map((p: any) => ({ title: String(p.title || p.label || ''), content: String(p.content || ''), parentId: attachParentId }))
            const result = await placeAINodes(nodesToPlace, attachParentId, { preferredDirection: 'down', minDistance: 40 })
            console.log('[QuickAI] placement result:', result?.placements?.length || 0, 'placements')
            if (result.success && result.placements.length > 0) {
              const newNodes: Node[] = result.placements.map(p => ({ id: p.node.id, type: p.node.type, position: p.position, data: { ...p.node.data } }))
              setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
              if (result.connections.length > 0) {
                const newEdges: Edge[] = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || 'floating' }))
                setEdges((eds) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
              }
              showAddToast('generated', newNodes.length)
            } else {
              console.warn('[QuickAI] placement produced no placements — using simple fallback under parent')
              const itemsCount = items.length
              const created: Node[] = []
              const edgesToAdd: Edge[] = []
              if (attachParentId) {
                const parent = (useBoardStore.getState().nodes || []).find(n => n.id === attachParentId)
                const center = parent?.position || reactFlowInstance.getViewport()
                const baseX = parent?.position?.x ?? 0
                const baseY = (parent?.position?.y ?? 0) + 300
                const spacingX = 260
                const columns = Math.min(itemsCount, 4)
                const rows = Math.ceil(itemsCount / columns)
                const startX = baseX - ((columns - 1) * spacingX) / 2
                let idx = 0
                for (let r = 0; r < rows; r++) {
                  for (let c = 0; c < columns; c++) {
                    if (idx >= itemsCount) break
                    const pos = { x: startX + c * spacingX, y: baseY + r * 220 }
                    const id = `node-${Date.now()}-${idx}`
                    const it = items[idx]
                    created.push({ id, type: 'default', position: pos, data: { title: String(it.title || it.label || ''), content: String(it.content || '') } } as any)
                    edgesToAdd.push({ id: `edge-${Date.now()}-${id}`, source: attachParentId, target: id, type: toVisualEdgeType(edgeTypePref) as any } as any)
                    idx++
                  }
                }
              } else {
                // No parent, place around viewport center in grid
                const vp = reactFlowInstance.getViewport()
                const center = getViewportCenter()
                const spacingX = 260
                const spacingY = 200
                const columns = Math.min(itemsCount, 4)
                const rows = Math.ceil(itemsCount / columns)
                const startX = center.x - ((columns - 1) * spacingX) / 2
                const startY = center.y - ((rows - 1) * spacingY) / 2
                let idx = 0
                for (let r = 0; r < rows; r++) {
                  for (let c = 0; c < columns; c++) {
                    if (idx >= itemsCount) break
                    const pos = { x: startX + c * spacingX, y: startY + r * spacingY }
                    const id = `node-${Date.now()}-${idx}`
                    const it = items[idx]
                    created.push({ id, type: 'default', position: pos, data: { title: String(it.title || it.label || ''), content: String(it.content || '') } } as any)
                    idx++
                  }
                }
              }
              if (created.length > 0) {
                setNodes((nds) => (Array.isArray(nds) ? [...nds, ...created] : [...created]))
                if (edgesToAdd.length > 0) setEdges((eds) => (Array.isArray(eds) ? [...eds, ...edgesToAdd] : [...edgesToAdd]))
                showAddToast('generated', created.length)
              }
            }
          } catch {}
          finally { try { setQuickAiGenerating?.(false) } catch {} }
        }}
        onOrganizeSubtree={async (nodeId: string) => {
          try {
            // Capture history before layout mutation
            pushHistory()
            await reorganizeSubtree(nodeId)
            // Persist immediately after reorg completes
            try {
              const st = useBoardStore.getState()
              await manualSave(st.nodes || [], st.edges || [])
            } catch {}
          } catch {}
        }}
        onPasteNode={async (screenPos: { x: number; y: number }) => {
          try {
            const flowPosition = reactFlowInstance.screenToFlowPosition(screenPos)
            const cd = await navigator.clipboard.read()
            if (cd && cd.length > 1) {
              setShowPasteLimitModal(true)
              return
            }
            // Prefer files if present
            let handled = false
            for (const item of cd) {
              const types = item.types
              // Look for image/pdf or any file
              if (types.some(t => t.startsWith('image/')) || types.includes('application/pdf')) {
                const type = types.find(t => t.startsWith('image/')) || 'application/pdf'
                const blob = await item.getType(type)
                const file = new File([blob], `pasted-${Date.now()}.${type.includes('pdf') ? 'pdf' : type.split('/')[1] || 'bin'}`, { type })
                handleDocumentUpload(file, flowPosition)
                handled = true
              }
            }
            if (handled) return

            // Else try text
            const text = await navigator.clipboard.readText()
            const trimmed = (text || '').trim()
            if (!trimmed) return

            let url: URL | null = null
            try { url = new URL(trimmed) } catch {}
            if (url) {
              const href = url.toString()
              const host = url.hostname.toLowerCase()
              const isYouTube = host.includes('youtube.com') || host.includes('youtu.be')
              const newNode: Node = isYouTube ? {
                id: `video-${Date.now()}`,
                type: 'video',
                position: flowPosition,
                data: { title: 'Video', videoUrl: href, status: 'idle' } as any,
              } : {
                id: `link-${Date.now()}`,
                type: 'link',
                position: flowPosition,
                data: { title: 'Link', linkUrl: href, status: 'idle' } as any,
              }
              setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
              showAddToast('added', 1)
              return
            }

            // Otherwise create a default node with description
            const newNode: Node = {
              id: `node-${Date.now()}`,
              type: 'default',
              position: flowPosition,
              data: { title: 'New Node', content: trimmed } as any,
            }
            setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
            showAddToast('added', 1)
          } catch {}
        }}
        onPasteConnectedNode={async (sourceNodeId: string, screenPos: { x: number; y: number }) => {
          try {
            const flowPosition = reactFlowInstance.screenToFlowPosition(screenPos)
            const cd = await navigator.clipboard.read()
            if (cd && cd.length > 1) {
              setShowPasteLimitModal(true)
              return
            }
            let handled = false
            for (const item of cd) {
              const types = item.types
              if (types.some(t => t.startsWith('image/')) || types.includes('application/pdf')) {
                const type = types.find(t => t.startsWith('image/')) || 'application/pdf'
                const blob = await item.getType(type)
                const file = new File([blob], `pasted-${Date.now()}.${type.includes('pdf') ? 'pdf' : type.split('/')[1] || 'bin'}`, { type })
                // Upload creates node asynchronously; we won't have id yet
                // As a simpler approach, create a temporary node, then replace? For now, just drop without edge.
                handleDocumentUpload(file, flowPosition)
                handled = true
              }
            }
            if (handled) return
            const text = await navigator.clipboard.readText()
            const trimmed = (text || '').trim()
            if (!trimmed) return
            let url: URL | null = null
            try { url = new URL(trimmed) } catch {}
            let newId = `node-${Date.now()}`
            if (url) {
              const href = url.toString()
              const host = url.hostname.toLowerCase()
              const isYouTube = host.includes('youtube.com') || host.includes('youtu.be')
              const node: Node = isYouTube ? {
                id: `video-${Date.now()}`,
                type: 'video',
                position: flowPosition,
                data: { title: 'Video', videoUrl: href, status: 'idle' } as any,
              } : {
                id: `link-${Date.now()}`,
                type: 'link',
                position: flowPosition,
                data: { title: 'Link', linkUrl: href, status: 'idle' } as any,
              }
              newId = node.id
              setNodes((nds) => (Array.isArray(nds) ? [...nds, node] : [node]))
              showAddToast('added', 1)
            } else {
              const node: Node = {
                id: newId,
                type: 'default',
                position: flowPosition,
                data: { title: 'New Node', content: trimmed } as any,
              }
              setNodes((nds) => (Array.isArray(nds) ? [...nds, node] : [node]))
              showAddToast('added', 1)
            }
            // Connect source -> new node
                setEdges((eds) => (Array.isArray(eds) ? [...eds, { id: `edge-${Date.now()}`, source: sourceNodeId, target: newId, type: toVisualEdgeType(edgeTypePref) as any }] : [{ id: `edge-${Date.now()}`, source: sourceNodeId, target: newId, type: toVisualEdgeType(edgeTypePref) as any }]))
          } catch {}
        }}
      />
      {/* Confirm delete modal for keyboard Delete */}
      <Modal
        open={showKeyboardDeleteModal}
        onClose={() => setShowKeyboardDeleteModal(false)}
        title={(() => {
          const ids: string[] = useBoardStore.getState().selectedNodeIds || []
          return ids.length > 1 ? `Delete ${ids.length} nodes` : 'Delete Node'
        })()}
        description="Are you sure you want to delete the selected node(s)? This action cannot be undone."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowKeyboardDeleteModal(false)}>Cancel</Button>
            <Button
              variant="danger"
              onClick={() => {
                const ids: string[] = useBoardStore.getState().selectedNodeIds || []
                setShowKeyboardDeleteModal(false)
                if (ids.length === 0) return
                // Delete each selected node
                setNodes((nds) => (Array.isArray(nds) ? nds.filter(n => !ids.includes(n.id)) : nds))
                setEdges((eds) => (Array.isArray(eds) ? eds.filter(e => !ids.includes(e.source) && !ids.includes(e.target)) : eds))
                try { useBoardStore.getState().clearSelectedNodes() } catch {}
              }}
            >
              Delete
            </Button>
          </>
        }
      />
      {/* Node edit modal for default, link, and image nodes */}
      <Modal
        open={showPasteLimitModal}
        onClose={() => setShowPasteLimitModal(false)}
        title="Paste limit"
        description="You can paste only one item at a time. This prevents accidental bulk pastes."
        actions={
          <>
            <Button onClick={() => setShowPasteLimitModal(false)}>OK</Button>
          </>
        }
      />
      
      {/* Node edit modal for default, link, and image nodes */}
      {editNodeId && (() => {
        const n = nodes.find(nn => nn.id === editNodeId)
        if (!n) return null
        const d: any = n.data || {}
        if (n.type === 'default') {
          return (
            <NodeEditModal
              open={true}
              onClose={handleCloseEditModal}
              initialTitle={d.title || ''}
              initialContent={d.content || ''}
              initialColorgoryIds={d.colorgoryIds || []}
              initialTitleSize={d.titleSize || 'sm'}
              initialPageMode={!!d.pageMode}
              onLocate={() => { if (editNodeId) centerOnNodeIds([editNodeId], { align: 'midLeft' }) }}
              onSave={(title, content, colorgoryIds, titleSize, pageMode) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, content, colorgoryIds, titleSize, pageMode } } : nn) : nds))
                centerOnNodeIds([editNodeId!])
              }}
              onLiveChange={(title, content, colorgoryIds, titleSize, pageMode) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, content, colorgoryIds, titleSize, pageMode } } : nn) : nds))
                if (editNodeId) sendLivePatch(editNodeId, { title, content, colorgoryIds, titleSize, pageMode })
              }}
            />
          )
        }
        if (n.type === 'link') {
          const safeHostname = (() => { try { return d.linkUrl ? new URL(d.linkUrl).hostname : '' } catch { return '' } })()
          return (
            <NodeEditModal
              open={true}
              onClose={handleCloseEditModal}
              initialTitle={d.title || safeHostname || ''}
              initialContent={d.description || ''}
              initialColorgoryIds={d.colorgoryIds || []}
              initialTitleSize={'sm'}
              onLocate={() => { if (editNodeId) centerOnNodeIds([editNodeId], { align: 'midLeft' }) }}
              onSave={(title, content, colorgoryIds) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, description: content, colorgoryIds } } : nn) : nds))
                centerOnNodeIds([editNodeId!])
              }}
              onLiveChange={(title, content, colorgoryIds) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, description: content, colorgoryIds } } : nn) : nds))
                if (editNodeId) sendLivePatch(editNodeId, { title, description: content, colorgoryIds })
              }}
            />
          )
        }
        if (n.type === 'image') {
          const initialTitle = d.title || d.fileName || 'Image'
          const initialContent = d.content || ''
          return (
            <NodeEditModal
              open={true}
              onClose={handleCloseEditModal}
              initialTitle={initialTitle}
              initialContent={initialContent}
              initialColorgoryIds={d.colorgoryIds || []}
              initialTitleSize={'sm'}
              onLocate={() => { if (editNodeId) centerOnNodeIds([editNodeId], { align: 'midLeft' }) }}
              onSave={(title, content, colorgoryIds) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, content, colorgoryIds } } : nn) : nds))
                centerOnNodeIds([editNodeId!])
              }}
              onLiveChange={(title, content, colorgoryIds) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, content, colorgoryIds } } : nn) : nds))
                if (editNodeId) sendLivePatch(editNodeId, { title, content, colorgoryIds })
              }}
            />
          )
        }
        if (n.type === 'document') {
          const initialTitle = d.title || d.fileName || 'Document'
          const initialContent = d.content || ''
          return (
            <NodeEditModal
              open={true}
              onClose={handleCloseEditModal}
              initialTitle={initialTitle}
              initialContent={initialContent}
              initialColorgoryIds={d.colorgoryIds || []}
              initialTitleSize={(d.titleSize as any) || 'sm'}
              onLocate={() => { if (editNodeId) centerOnNodeIds([editNodeId], { align: 'midLeft' }) }}
              onSave={(title, content, colorgoryIds, titleSize) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, content, colorgoryIds, titleSize } } : nn) : nds))
                centerOnNodeIds([editNodeId!])
              }}
              onLiveChange={(title, content, colorgoryIds, titleSize) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, content, colorgoryIds, titleSize } } : nn) : nds))
                if (editNodeId) sendLivePatch(editNodeId, { title, content, colorgoryIds, titleSize })
              }}
              showTitleSize={true}
            />
          )
        }
        if (n.type === 'task') {
          const initialTitle = (d.title ?? '')
          const initialContent = (d.content ?? '')
          const toPlain = (html: string) => {
            try { const tmp = document.createElement('div'); tmp.innerHTML = html; return (tmp.textContent || tmp.innerText || '').trim() } catch { return html }
          }
          const assignee = (typeof taskAssignee !== 'undefined' && taskAssignee !== null) ? taskAssignee : (((d as any)?.assigneeId || '') as string)
          return (
            <NodeEditModal
              open={true}
              onClose={handleCloseEditModal}
              initialTitle={initialTitle}
              initialContent={initialContent}
              initialColorgoryIds={d.colorgoryIds || []}
              initialTitleSize={'sm'}
              onLocate={() => { if (editNodeId) centerOnNodeIds([editNodeId], { align: 'midLeft' }) }}
              onSave={async (title, content) => {
                const plainContent = toPlain(content || '')
                const safeTitle = (title || '').trim() || 'Untitled Task'
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title: safeTitle, content: plainContent, assigneeId: assignee || null } } : nn) : nds))
                // Persist assignment to DB (board_updates row; durable storage handled by autosave elsewhere)
                try {
                  const bid = useBoardStore.getState().currentBoardId
                  if (bid) {
                    await fetch('/api/board/updates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ boardId: bid, nodeId: editNodeId, updateType: 'content', data: { title: safeTitle, content: plainContent, assigneeId: assignee || null } }) })
                  }
                } catch {}
                centerOnNodeIds([editNodeId!])
              }}
              onLiveChange={(title, content) => {
                const plainContent = toPlain(content || '')
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, content: plainContent, assigneeId: assignee || null } } : nn) : nds))
                if (editNodeId) sendLivePatch(editNodeId, { title, content: plainContent, assigneeId: assignee || null })
              }}
              showContent={true}
              showPageMode={false}
              showTitle={true}
              showTitleSize={false}
              assignOptions={taskAssignOptions || undefined}
              assignValue={assignee || ''}
              onAssignChange={(v) => setTaskAssignee(v)}
              assignLabel="Assign"
              focusTitleFirst={true}
            />
          )
        }
        if (n.type === 'video') {
          const initialTitle = d.title || 'Video'
          const initialContent = d.content || ''
          return (
            <NodeEditModal
              open={true}
              onClose={handleCloseEditModal}
              initialTitle={initialTitle}
              initialContent={initialContent}
              initialColorgoryIds={d.colorgoryIds || []}
              initialTitleSize={'sm'}
              onLocate={() => { if (editNodeId) centerOnNodeIds([editNodeId], { align: 'midLeft' }) }}
              onSave={(title, content, colorgoryIds) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, content, colorgoryIds } } : nn) : nds))
                centerOnNodeIds([editNodeId!])
              }}
              onLiveChange={(title, content, colorgoryIds) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, content, colorgoryIds } } : nn) : nds))
                if (editNodeId) sendLivePatch(editNodeId, { title, content, colorgoryIds })
              }}
            />
          )
        }
        if (n.type === 'headline') {
          const initialTitle = (d.title ?? 'New headline')
          const initialTitleSize = (d.titleSize as any) || 'sm'
          return (
            <NodeEditModal
              open={true}
              onClose={handleCloseEditModal}
              initialTitle={initialTitle}
              initialContent={''}
              initialColorgoryIds={[]}
              initialTitleSize={initialTitleSize}
              titleSizeOptions={['sm','md','lg','xl']}
              onLocate={() => { if (editNodeId) centerOnNodeIds([editNodeId], { align: 'midLeft' }) }}
              onSave={(title, _content, _cids, titleSize) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, titleSize } } : nn) : nds))
                centerOnNodeIds([editNodeId!])
              }}
              onLiveChange={(title, _content, _cids, titleSize) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? { ...nn, data: { ...(nn.data as any), title, titleSize } } : nn) : nds))
                if (editNodeId) sendLivePatch(editNodeId, { title, titleSize })
              }}
              // Hide content/page mode for headline nodes
              showContent={false as any}
              showPageMode={false as any}
            />
          )
        }
        return null
      })()}
      
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
              showAddToast('generated', 1)
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
          {isBoardView && !editorMode && (
            <>
              <FloatingActionButton
                onAddNode={() => {
                  console.log('[BoardComponent] onAddNode called (secondary FAB)')
                  try {
                    setPendingSourceNodeId(null)
                    try {
                      const center = getViewportCenter()
                      setPendingNodePosition(center)
                    } catch {
                      setPendingNodePosition(null)
                    }
                    setTimeout(() => { console.log('[BoardComponent] opening AddNodesModal now (secondary FAB)'); setShowUnifiedAddModal(true) }, 0)
                  } catch {
                    console.warn('[BoardComponent] onAddNode fallback immediate open (secondary FAB)')
                    setShowUnifiedAddModal(true)
                  }
                }}
                onAIGenerate={handleOpenAINodeGenerator}
                onUploadDocument={openUploadPicker}
          onAddTask={() => {
            // Mirror context menu Add Task behavior
            const center = getViewportCenter()
            const flowPosition = center
            pushHistory()
            const newId = `task-${Date.now()}`
            const newNode: Node = { id: newId, type: 'task', position: flowPosition, data: { title: '', content: '', completed: false, focusOnMount: true } }
            setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
            showAddToast('added', 1)
            setTimeout(() => { try { setEditNodeId(newId); centerOnNodeIds([newId], { align: 'midLeft' }) } catch {} }, 0)
          }}
          onAddHeadline={() => {
            const center = getViewportCenter()
            pushHistory()
            const newId = `headline-${Date.now()}`
            const newNode: Node = { id: newId, type: 'headline', position: center, data: { title: 'New headline', titleSize: 'sm' } as any }
            setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
            showAddToast('added', 1)
            setTimeout(() => { try { setEditNodeId(newId); centerOnNodeIds([newId], { align: 'midLeft' }) } catch {} }, 0)
                }}
                onReorganize={() => setShowReorganizeMenu(true)}
                aiInitialized={aiInitialized}
                nodeCount={nodes.length}
              />
            </>
          )}
        </>
      )}
      {/* Legacy NodeAddModal removed; using unified AddNodesModal */}

      {showUnifiedAddModal && (
        <AddNodesModal
          open={showUnifiedAddModal}
          onClose={() => setShowUnifiedAddModal(false)}
          parentNodeId={aiParentNodeId || pendingSourceNodeId || undefined}
          parentNodeTitle={(aiParentNodeId || pendingSourceNodeId) ? (nodes.find(n => n.id === (aiParentNodeId || pendingSourceNodeId))?.data as any)?.title : undefined}
          parentNodeContent={(aiParentNodeId || pendingSourceNodeId) ? (() => {
            const n = nodes.find(n => n.id === (aiParentNodeId || pendingSourceNodeId))
            const d: any = n?.data || {}
            return (d.content || d.extractedText || d.extracted_text || '') as string
          })() : undefined}
          initialAIContext={pendingBoardBrief ? { topic: pendingBoardBrief.boardTopic, description: pendingBoardBrief.description } : undefined}
          onManualSubmit={async ({ titles, description, generateDescription }) => {
            const center = pendingNodePosition || getViewportCenter()
            let desc = (description || '').trim()
            // Build per-title descriptions when needed
            const descriptionsByTitle: Record<string, string> = {}
            if (titles.length === 1) {
              if (generateDescription && !desc) {
                try {
                  const service = getOpenAIService()
                  if (service) {
                    const titleForAI = titles[0]
                    const topicForAI = (pendingBoardBrief?.boardTopic || useBoardStore.getState().topic || '').trim()
                    const prompt = topicForAI
                      ? `The board topic is "${topicForAI}". Write a concise, helpful 1-2 sentence description for a mind-map node titled "${titleForAI}" specifically in the context of "${topicForAI}". Return plain text only.`
                      : `Write a concise, helpful 1-2 sentence description for a mind-map node titled "${titleForAI}". Keep it clear and actionable. Return plain text only.`
                    const res = await service.generate({ prompt, maxTokens: 120 })
                    desc = (res.content || '').trim()
                  }
                } catch {}
              }
              if (desc) {
                descriptionsByTitle[titles[0]] = desc
              }
            } else if (generateDescription) {
              try {
                const service = getOpenAIService()
                if (service) {
                  for (const t of titles) {
                    const topicForAI = (pendingBoardBrief?.boardTopic || useBoardStore.getState().topic || '').trim()
                    const prompt = topicForAI
                      ? `The board topic is "${topicForAI}". Write a concise, helpful 1-2 sentence description for a mind-map node titled "${t}" specifically in the context of "${topicForAI}". Return plain text only.`
                      : `Write a concise, helpful 1-2 sentence description for a mind-map node titled "${t}". Keep it clear and actionable. Return plain text only.`
                    const res = await service.generate({ prompt, maxTokens: 120 })
                    const d = (res.content || '').trim()
                    if (d) descriptionsByTitle[t] = d
                  }
                }
              } catch {}
            }
            if (pendingSourceNodeId) {
              const nodesToPlace = titles.map((t) => ({ title: t, content: descriptionsByTitle[t] || '', type: 'default' as const, parentId: pendingSourceNodeId }))
              try {
                const result = await placeAINodes(nodesToPlace, pendingSourceNodeId, { preferredDirection: 'down', minDistance: 40 })
                if (result.success && result.placements.length > 0) {
                  const newNodes: Node[] = result.placements.map(p => ({ id: p.node.id, type: p.node.type, position: p.position, data: { ...p.node.data } }))
                  setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
                  if (result.connections.length > 0) {
                    const newEdges: Edge[] = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || (toVisualEdgeType(edgeTypePref) as any) }))
                    setEdges((eds) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
                  }
                  showAddToast('added', newNodes.length)
                  centerOnNodeIds(newNodes.map(n => n.id))
                } else {
                  // Fallback deterministic placement directly under parent with edges
                  const parent = (useBoardStore.getState().nodes || []).find(n => n.id === pendingSourceNodeId)
                  const baseX = parent?.position?.x ?? (pendingNodePosition?.x ?? getViewportCenter().x)
                  const baseY = (parent?.position?.y ?? (pendingNodePosition?.y ?? getViewportCenter().y)) + 360
                  const spacingX = 300
                  const created: Node[] = []
                  const edgesToAdd: Edge[] = []
                  const count = titles.length
                  const columns = Math.min(count, 4)
                  const rows = Math.ceil(count / columns)
                  const startX = baseX - ((columns - 1) * spacingX) / 2
                  let idx = 0
                  for (let r = 0; r < rows; r++) {
                    for (let c = 0; c < columns; c++) {
                      if (idx >= count) break
                      const pos = { x: startX + c * spacingX, y: baseY + r * 300 }
                      const id = `node-${Date.now()}-${idx}`
                      created.push({ id, type: 'default', position: pos, data: { title: titles[idx], content: descriptionsByTitle[titles[idx]] || '' } } as any)
                      edgesToAdd.push({ id: `edge-${Date.now()}-${id}`, source: pendingSourceNodeId, target: id, type: toVisualEdgeType(edgeTypePref) as any } as any)
                      idx++
                    }
                  }
                  setNodes((nds) => (Array.isArray(nds) ? [...nds, ...created] : [...created]))
                  setEdges((eds) => (Array.isArray(eds) ? [...eds, ...edgesToAdd] : [...edgesToAdd]))
                  showAddToast('added', created.length)
                  centerOnNodeIds(created.map(n => n.id))
                }
              } catch {}
            } else if (titles.length === 1) {
              const target = pendingNodePosition || center
              const newId = `node-${Date.now()}`
              const newNode: Node = { id: newId, type: 'default', position: target, data: { title: titles[0], content: desc } }
              setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
              showAddToast('added', 1)
              centerOnNodeIds([newId])
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
                    created.push({ id: `node-${Date.now()}-${idx}`, type: 'default', position: { x, y }, data: { title: titles[idx], content: descriptionsByTitle[titles[idx]] || '' } })
                    idx++
                  }
                }
                setNodes((nds) => (Array.isArray(nds) ? [...nds, ...created] : [...created]))
                showAddToast('added', created.length)
                centerOnNodeIds(created.map(n => n.id))
              } else {
                const nodesToPlace = titles.map(t => ({ title: t, content: descriptionsByTitle[t] || '', type: 'default' as const }))
                let placed = false
                try {
                  const placementResult = await placeBoardNodes(nodesToPlace)
                  if (placementResult.success && placementResult.placements.length > 0) {
                    const newNodes: Node[] = placementResult.placements.map(p => ({ id: p.node.id, type: p.node.type, position: p.position, data: { ...p.node.data } }))
                    setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
                    placed = true
                    showAddToast('added', newNodes.length)
                    centerOnNodeIds(newNodes.map(n => n.id))
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
                  showAddToast('added', fallbackNodes.length)
                  centerOnNodeIds(fallbackNodes.map(n => n.id))
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
                showAddToast('generated', newNodes.length)
                centerOnNodeIds(newNodes.map(n => n.id))
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
            showAddToast('added', 1)
            centerOnNodeIds([newNode.id])
          }}
          onLinkSubmit={(url) => {
            const center = pendingNodePosition || getViewportCenter()
            const newNode: Node = {
              id: `link-${Date.now()}`,
              type: 'link',
              position: center,
              data: { title: 'Link', linkUrl: url, status: 'idle' } as any,
            }
            setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
            setShowUnifiedAddModal(false)
            showAddToast('added', 1)
            centerOnNodeIds([newNode.id])
          }}
          onUploadSubmit={(file) => {
            const center = pendingNodePosition || getViewportCenter()
            handleDocumentUpload(file as File, center)
            setShowUnifiedAddModal(false)
            showAddToast('added', 1)
            centerOnPositions([{ x: center.x, y: center.y }])
          }}
        />
      )}
      
      {/* Reorganize Menu */}
      <BoardReorganizeMenu
        isOpen={showReorganizeMenu}
        onClose={() => setShowReorganizeMenu(false)}
        nodeCount={nodes.length}
      />
      {(quickAiGenerating || creatingBoard) && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center pointer-events-none">
          <div className="px-3 py-2 rounded-full bg-white/90 dark:bg-gray-900/90 shadow-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <SpinnerGap className="animate-spin" size={16} />
          <span>{creatingBoard ? 'Creating board…' : 'Generating nodes…'}</span>
          </div>
        </div>
      )}
      <Toast open={toastOpen} onClose={() => setToastOpen(false)} variant="success" position="top-center">
        {toastMessage}
      </Toast>
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
