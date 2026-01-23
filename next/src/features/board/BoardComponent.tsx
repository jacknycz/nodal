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
import SpotifyNode from '../nodes/SpotifyNode'
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
import { fetchUsageCached } from '../ai/usageClient'
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
import { ArrowLeft, ArrowRight, Info, X } from '@phosphor-icons/react'
import IconButton from '../../components/ui/IconButton'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import Range from '../../components/ui/Range'
import Toast from '../../components/ui/Toast'
import useBoardRealtime from './useBoardRealtime'
import useBoardAutosave from './useBoardAutosave'
import useNodeActions from './useNodeActions'
import useDocumentUpload from './useDocumentUpload'
import useBoardShortcuts from './useBoardShortcuts'
import NodeEditModal from '../../components/NodeEditModal'

interface BoardProps {
  initialBoard?: { nodes: Node[]; edges: Edge[] }
  initialColorgories?: any[]
  initialEdgeType?: string | null
  initialAIStyle?: any
  pendingBoardBrief?: BoardBrief // Now includes id
  onBoardStateChange?: (name: string, status: string, hasChanges: boolean) => void
  clearPendingBoardBrief?: () => void
  isBoardView?: boolean
  boardId?: string // Add board ID for existing boards
  boardName?: string // Add board name for existing boards
  screenshotMode?: boolean // Add screenshot mode
  onDeleteNode?: (nodeId: string) => void // Add delete function prop
  readOnly?: boolean
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
  spotify: (props: any) => <SpotifyNode {...props} {...stableHandlers} />,
};

export const edgeTypes = {
  floating: (props: any) => <FloatingEdge {...props} onEdgeDelete={stableHandlers.onEdgeDelete} />,
  'floating-straight': (props: any) => <FloatingStraightEdge {...props} onEdgeDelete={stableHandlers.onEdgeDelete} />,
  'floating-step': (props: any) => <FloatingStepEdge {...props} onEdgeDelete={stableHandlers.onEdgeDelete} />,
  'floating-smoothstep': (props: any) => <FloatingSmoothEdge {...props} onEdgeDelete={stableHandlers.onEdgeDelete} />,
};

function BoardContent({
  initialBoard,
  initialColorgories,
  initialEdgeType,
  initialAIStyle,
  pendingBoardBrief,
  onBoardStateChange,
  clearPendingBoardBrief,
  isBoardView = true,
  boardId,
  boardName, // Add this parameter
  screenshotMode = false, // Add screenshotMode
  onDeleteNode, // Add delete function prop
  readOnly = false,
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
  // Grid snapping toggle (board-local)
  const [gridEnabled, setGridEnabled] = useState<boolean>(false)
  const SNAP_GRID: [number, number] = [20, 20]

  // Load grid preference from localStorage and listen for updates from Settings modal
  useEffect(() => {
    if (!boardId) return
    try {
      const key = `nodal:board:${boardId}:gridEnabled`
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
      if (raw === null) {
        // Default ON if not set
        setGridEnabled(true)
      } else {
        setGridEnabled(raw === 'true')
      }
    } catch {}
    const handler = (e: any) => {
      try {
        if (!e?.detail || e.detail.boardId !== boardId) return
        setGridEnabled(!!e.detail.enabled)
      } catch {}
    }
    try { window.addEventListener('nodal:grid-updated', handler as any) } catch {}
    return () => { try { window.removeEventListener('nodal:grid-updated', handler as any) } catch {} }
  }, [boardId])
  
  
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

  // Hydrate board-local settings from the already-loaded board payload (avoid a second loadBoard fetch)
  useEffect(() => {
    try {
      if (Array.isArray(initialColorgories)) {
        useBoardStore.getState().setColorgories(initialColorgories as any)
      }
      if (initialEdgeType) {
        useBoardStore.getState().setEdgeType?.(initialEdgeType as any)
      }
      if (initialAIStyle) {
        useBoardStore.getState().setAIStyle?.(initialAIStyle as any)
      }
    } catch {}
  }, [boardId, initialColorgories, initialEdgeType, initialAIStyle])
  
  const [currentBoardName, setCurrentBoardName] = useState('Untitled Board')
  const localBoardIdRef = useRef<string | null>(null)
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [showTips, setShowTips] = useState(false)
  const [showAINodeGenerator, setShowAINodeGenerator] = useState(false)
  const [showNodeSetupModal, setShowNodeSetupModal] = useState(false)
  const [showReorganizeMenu, setShowReorganizeMenu] = useState(false)
  const [aiParentNodeId, setAiParentNodeId] = useState<string | null>(null)
  const [leftDockActive, setLeftDockActive] = useState<'tasks' | 'colorgories' | 'tips' | 'stories' | null>(null)
  const [toastOpen, setToastOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState<string>('')
  const [toastSubMessage, setToastSubMessage] = useState<string>('')
  const [toastVariant, setToastVariant] = useState<'success' | 'info' | 'warning' | 'danger'>('success')
  const [quickAiGenerating, setQuickAiGenerating] = useState(false)
  const [summarizingSelection, setSummarizingSelection] = useState(false)
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

  // Mobile: single-tap opens context menu
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
              // Also select the node that was tapped to open the menu
              if (nodeId) {
                try {
                  useBoardStore.getState().setSelectedNodes([nodeId])
                  try { reactFlowInstance.setNodes((cur) => cur.map((n) => ({ ...n, selected: n.id === nodeId }))) } catch {}
                } catch {}
              }
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

  const showAddToast = useCallback((kind: 'added' | 'generated', count: number, subtext?: string) => {
    if (!count || count < 1) return
    const noun = count === 1 ? 'node' : 'nodes'
    const verb = kind === 'generated' ? (count === 1 ? 'Generated' : 'Generated') : (count === 1 ? 'Added' : 'Added')
    const article = count === 1 ? 'a ' : ''
    const msg = `${verb} ${article}${count === 1 ? noun : count + ' ' + noun}!`
    setToastMessage(msg)
    setToastSubMessage(subtext || '')
    setToastVariant('success')
    setToastOpen(true)
  }, [])

  const getSubtreeIds = useCallback((rootId: string, edges: any[]): Set<string> => {
    const out = new Set<string>()
    if (!rootId) return out
    out.add(rootId)
    const q: string[] = [rootId]
    const es = Array.isArray(edges) ? edges : []
    while (q.length) {
      const cur = q.shift() as string
      for (const e of es) {
        const s = e?.source
        const t = e?.target
        if (typeof s !== 'string' || typeof t !== 'string') continue
        if (s === cur && !out.has(t)) {
          out.add(t)
          q.push(t)
        }
      }
    }
    return out
  }, [])

  const getApproxDims = useCallback((node: any): { width: number; height: number } => {
    try {
      const w = Number(node?.width || 0)
      const h = Number(node?.height || 0)
      if (w > 0 && h > 0) return { width: w, height: h }
      const t = String(node?.type || node?.data?.type || 'default').toLowerCase()
      if (t.includes('image') || t.includes('video')) return { width: 320, height: 240 }
      if (t.includes('document')) return { width: 320, height: 220 }
      if (t.includes('task')) return { width: 320, height: 220 }
      if (t.includes('headline')) return { width: 320, height: 140 }
      return { width: 300, height: 180 }
    } catch {
      return { width: 300, height: 180 }
    }
  }, [])

  const ROW_GAP = 220

  // Global toast listener (used by uploads and other flows)
  useEffect(() => {
    const onToast = (ev: any) => {
      try {
        const d = (ev as CustomEvent)?.detail || {}
        const msg = String(d.message || d.text || '')
        if (!msg) return
        setToastMessage(msg)
        setToastSubMessage(String(d.subtext || d.subtitle || ''))
        setToastVariant((d.variant as any) || 'info')
        setToastOpen(true)
      } catch {}
    }
    window.addEventListener('nodal:toast', onToast as EventListener)
    return () => window.removeEventListener('nodal:toast', onToast as EventListener)
  }, [])
  
  // Close LeftDock panels on click-away / Escape / external right-click
  useEffect(() => {
    if (!isBoardView) return

    const handleGlobalPointer = (e: MouseEvent | TouchEvent) => {
      if (!leftDockActive) return
      const target = e.target as Element | null
      if (!target) return
      // Ignore clicks inside any modal portal
      if (target.closest?.('[data-modal-root]')) {
        return
      }
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
        reactFlowInstance.setViewport({ x, y, zoom }, { duration: 900, easing: 'easeInOutCubic' } as any)
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
        reactFlowInstance.setViewport({ x, y, zoom }, { duration: 900, easing: 'easeInOutCubic' } as any)
        return
      }
      reactFlowInstance.setCenter(cx, cy, { zoom: Math.max(0.8, Math.min(1.2, reactFlowInstance.getZoom())), duration: 900, easing: 'easeInOutCubic' } as any)
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
    disabled: readOnly,
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

  // Remove edges whose endpoints no longer exist
  const pruneGhostEdges = useCallback((nds: Node[], eds: Edge[]): Edge[] => {
    try {
      const idSet = new Set((Array.isArray(nds) ? nds : []).map((n: any) => n.id))
      return (Array.isArray(eds) ? eds : []).filter((e: any) => idSet.has(e?.source) && idSet.has(e?.target))
    } catch {
      return eds
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
    triggerAutosaveRef.current(nodes, pruneGhostEdges(nodes, edges))
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
      triggerAutosaveRef.current(nodes, pruneGhostEdges(nodes, edges))
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
      manualSave(nodes, pruneGhostEdges(nodes, edges)).catch(() => {})
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
      // Ensure auth session is established so Authorization header is present for API routes
      const ensureAuth = async () => {
        try {
          const supa = getSupabaseClient()
          for (let i = 0; i < 5; i++) {
            const { data } = await supa.auth.getSession()
            const token = data?.session?.access_token
            if (token) return token
            await new Promise(res => setTimeout(res, 100 + i * 100))
          }
        } catch {}
        return null
      }
      await ensureAuth()
      // Helper: server-side availability check (falls back if aiService not initialized)
      const checkAvailable = async () => {
        try {
          if (aiService?.isAvailable) {
            const ok = await aiService.isAvailable()
            return !!ok
          }
          // fallback: ping /api/usage
          const result = await fetchUsageCached({ maxAgeMs: 30_000 })
          return !!result.ok
        } catch { return false }
      }
      // Helper: text generation that works even if aiService is not initialized
      const generateText = async (prompt: string, systemPrompt?: string, maxTokens?: number) => {
        if (aiService) {
          const r = await aiService.generate({ prompt, systemPrompt, maxTokens })
          return r.content || ''
        }
        // raw call to server route using server-held key
        let authHeader: Record<string, string> = {}
        try {
          const supa = getSupabaseClient()
          const { data } = await supa.auth.getSession()
          const token = data?.session?.access_token
          if (token) authHeader = { Authorization: `Bearer ${token}` }
        } catch {}
        const baseUrl = process.env.NEXT_PUBLIC_OPENAI_BASE_URL || '/api/ai'
        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [
              ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: maxTokens ?? 512,
            stream: false
          })
        })
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}))
          throw new Error(err?.error?.message || resp.statusText)
        }
        const json = await resp.json()
        return json?.choices?.[0]?.message?.content || ''
      }
      // Ensure a topic parent node exists (via placement engine)
      const topicNodeId = `topic-${boardId}`
      const getViewportCenterForPlacement = () => {
        const vp = reactFlowInstance.getViewport()
        return {
          x: -vp.x / vp.zoom + (window.innerWidth / 2) / vp.zoom,
          y: -vp.y / vp.zoom + (window.innerHeight / 2) / vp.zoom,
        }
      }
      const ensureTopicNode = async (): Promise<any> => {
        const existing = (useBoardStore.getState().nodes || []).find((n: any) => n?.id === topicNodeId)
        if (existing) return existing
        const center = getViewportCenterForPlacement()
        const res = await placeManualNode(
          { id: topicNodeId, title: brief.boardTopic, content: '', type: 'default', preferredPosition: center } as any,
          center,
          { minDistance: 80, avoidOverlap: true, preserveExistingLayout: true },
          (useBoardStore.getState().nodes || []) as any
        )
        const placement = res.placements?.[0]
        const created = placement
          ? ({ id: placement.node.id, type: placement.node.type as any, position: placement.position, data: { ...placement.node.data } } as any)
          : ({ id: topicNodeId, type: 'default' as const, position: center, data: { title: brief.boardTopic, content: '' } } as any)
        setNodes((prev) => {
          const list = Array.isArray(prev) ? prev : []
          const exists = list.some((n: any) => n.id === topicNodeId)
          return exists ? list : [created, ...list]
        })
        return created
      }
      const topicNode = await ensureTopicNode()
      const getNodesWithTopic = () => {
        const currentNodes = useBoardStore.getState().nodes || []
        return currentNodes.some((n: any) => n?.id === topicNode.id)
          ? currentNodes
          : [...currentNodes, topicNode]
      }

      const maybeAppendMediaNodes = async (baseNodes: any[], baseEdges: any[]) => {
        if (!brief.generateMediaNodes) return { nodes: baseNodes, edges: baseEdges, mediaCount: 0 }
        try {
          const supa = getSupabaseClient()
          const { data } = await supa.auth.getSession()
          const token = data?.session?.access_token
          const res = await fetch('/api/boards/generate-media-nodes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify({ topic: brief.boardTopic, description: brief.description, maxImages: 2, maxVideos: 2 }),
          })
          if (!res.ok) return { nodes: baseNodes, edges: baseEdges, mediaCount: 0 }
          const json = await res.json().catch(() => ({}))
          const items: Array<{ type: 'image' | 'video'; title: string; url: string; content?: string }> = Array.isArray(json?.nodes) ? json.nodes : []
          if (!items.length) return { nodes: baseNodes, edges: baseEdges, mediaCount: 0 }

          // Place media nodes via placement engine (same core placement rules as everything else)
          const nodesToPlace = items.map((it) => {
            const t = String(it.type || '').toLowerCase()
            if (t === 'image') {
              return {
                title: String(it.title || 'Image'),
                content: String(it.content || ''),
                type: 'image',
                parentId: topicNode.id,
                data: { previewUrl: String(it.url || ''), type: 'image', status: 'ready', titleSize: 'sm' } as any,
              }
            }
            return {
              title: String(it.title || 'Video'),
              content: String(it.content || ''),
              type: 'video',
              parentId: topicNode.id,
              data: { videoUrl: String(it.url || ''), status: 'idle', titleSize: 'sm' } as any,
            }
          })

          const result = await placeAINodes(nodesToPlace as any, topicNode.id, { preferredDirection: 'down', minDistance: 40, avoidOverlap: true, preserveExistingLayout: true }, getNodesWithTopic() as any)
          if (!result.success || !result.placements.length) return { nodes: baseNodes, edges: baseEdges, mediaCount: 0 }

          const mediaNodes = result.placements.map((p) => ({ id: p.node.id, type: p.node.type as any, position: p.position, data: { ...p.node.data } }))
          const mediaEdges = result.connections.map((c) => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || (toVisualEdgeType(edgeTypePref) as any) }))

          const nextNodes = [...(baseNodes || []), ...mediaNodes]
          const nextEdges = [...(baseEdges || []), ...mediaEdges]
          setNodes(nextNodes)
          setEdges(nextEdges as any)
          const boardData = { nodes: nextNodes, edges: nextEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
          await boardStorage.updateBoard(boardId, boardData)
          return { nodes: nextNodes, edges: nextEdges, mediaCount: mediaNodes.length }
        } catch {
          return { nodes: baseNodes, edges: baseEdges, mediaCount: 0 }
        }
      }

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
            const allowed = await checkAvailable()
            if (allowed) {
              for (const t of brief.starterNodes) {
                const prompt = brief.boardTopic
                  ? `Given the board topic "${brief.boardTopic}", write a concise, helpful 1-2 sentence description for a mind-map node titled "${t}" in that context. Keep it clear and actionable. Return plain text only.`
                  : `Write a concise, helpful 1-2 sentence description for a mind-map node titled "${t}". Keep it clear and actionable. Return plain text only.`
                const txt = await generateText(prompt, undefined, 120)
                const d = (txt || '').trim()
                if (d) descriptionsByTitle[t] = d
              }
            } else {
              // Not allowed - skip description generation
              try { window.dispatchEvent(new CustomEvent('nodal:toast', { detail: { message: 'AI descriptions require a Pro plan.', variant: 'info' } })) } catch {}
            }
          } catch {}
        }
        const nodesToPlace = brief.starterNodes.map((title) => ({
          title: String(title || '').trim() || 'Untitled',
          content: descriptionsByTitle[title] || '',
          type: 'default' as const,
          parentId: topicNode.id,
        }))
        const result = await placeAINodes(nodesToPlace as any, topicNode.id, { preferredDirection: 'down', minDistance: 40, avoidOverlap: true, preserveExistingLayout: true }, getNodesWithTopic() as any)
        let placed: any[]
        let edgesPlaced: any[]
        if (!result.success || !result.placements.length) {
          // Fallback: simple grid placement below topic node
          console.warn('[generateStarterNodes] Manual starter nodes placement failed, using fallback grid layout', result.warnings || [])
          const cellWidth = 300
          const padding = 60
          const startX = topicNode.position.x - ((nodesToPlace.length - 1) * (cellWidth + padding)) / 2
          const startY = topicNode.position.y + 250
          placed = nodesToPlace.map((node, idx) => ({
            id: (node as any).id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: node.type || 'default',
            position: { x: startX + idx * (cellWidth + padding), y: startY },
            data: { title: node.title, content: node.content || '' }
          }))
          edgesPlaced = placed.map((node) => ({
            id: `edge-${topicNode.id}-${node.id}`,
            source: topicNode.id,
            target: node.id,
            type: toVisualEdgeType(edgeTypePref) as any
          }))
        } else {
          placed = result.placements.map((p) => ({ id: p.node.id, type: p.node.type as any, position: p.position, data: { ...p.node.data } }))
          edgesPlaced = result.connections.map((c) => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || (toVisualEdgeType(edgeTypePref) as any) }))
        }
        setNodes([topicNode, ...placed])
        setEdges(edgesPlaced as any)
        const boardData = { nodes: [topicNode, ...placed], edges: edgesPlaced as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
        await boardStorage.updateBoard(boardId, boardData)
        setHasUnsavedChanges(false)
        if (onBoardStateChange) onBoardStateChange(brief.boardName, 'saved', false)
        // Optionally add media nodes too
        await maybeAppendMediaNodes([topicNode, ...placed], edgesPlaced as any)
        router.push(`/board/${boardId}`)
        return
      }
      // Prefer server route that uses server-held key for reliability
      let responseContent = ''
      try {
        const supa = getSupabaseClient()
        const { data } = await supa.auth.getSession()
        const token = data?.session?.access_token
        const res = await fetch('/api/boards/generate-nodes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            mode: 'board_create',
            topic: brief.boardTopic,
            goal: brief.description,
            density: 'medium',
            constraints: {
              totalMin: 4,
              totalMax: 16,
              minText: 5,
              minMedia: brief.generateMediaNodes ? 1 : 0,
              maxMedia: brief.generateMediaNodes ? 4 : 0,
              maxImages: brief.generateMediaNodes ? 4 : 0,
              maxVideos: brief.generateMediaNodes ? 4 : 0,
            },
            board: {
              supportedNodeTypes: brief.generateMediaNodes ? ['text', 'image', 'video'] : ['text'],
              existingNodes: [],
            },
          })
        })
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j?.error || `Generate starters failed (${res.status})`)
        }
        const j = await res.json().catch(() => ({}))
        try {
          console.log('[generateStarterNodes] raw AI response:', j)
          console.log('[generateStarterNodes] nodes payload:', (j as any)?.nodes)
        } catch {}
        const planned: any[] = Array.isArray(j?.nodes) ? j.nodes : []
        if (planned.length > 0) {
          const textItems = planned.filter((n: any) => n?.type === 'text')
          const mediaItems = planned.filter((n: any) => n?.type === 'image' || n?.type === 'video')

          const nodesToPlace = [
            ...textItems.map((it: any) => ({
              title: String(it?.title || '').trim() || 'Untitled',
              content: String(it?.content || ''),
              type: 'default' as const,
              parentId: topicNode.id,
            })),
            ...mediaItems.map((it: any) => {
              const t = String(it?.type || '').toLowerCase()
              if (t === 'image') {
                return {
                  title: String(it?.title || 'Image'),
                  content: String(it?.content || ''),
                  type: 'image',
                  parentId: topicNode.id,
                  data: { previewUrl: String(it?.imageUrl || ''), type: 'image', status: 'ready', titleSize: 'sm' } as any,
                }
              }
              return {
                title: String(it?.title || 'Video'),
                content: String(it?.content || ''),
                type: 'video',
                parentId: topicNode.id,
                data: { videoUrl: String(it?.videoUrl || ''), status: 'idle', titleSize: 'sm' } as any,
              }
            })
          ]

          const result = await placeAINodes(nodesToPlace as any, topicNode.id, { preferredDirection: 'down', minDistance: 40, avoidOverlap: true, preserveExistingLayout: true }, getNodesWithTopic() as any)
          if (!result.success || !result.placements.length) {
            // Fallback: simple grid placement below topic node
            console.warn('[generateStarterNodes] Placement engine failed, using fallback grid layout', result.warnings || [])
            const cellWidth = 300
            const cellHeight = 200
            const padding = 60
            const startX = topicNode.position.x - ((nodesToPlace.length - 1) * (cellWidth + padding)) / 2
            const startY = topicNode.position.y + 250
            const placedNodes: any[] = nodesToPlace.map((node, idx) => ({
              id: (node as any).id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: node.type || 'default',
              position: { x: startX + idx * (cellWidth + padding), y: startY },
              data: { title: node.title, content: node.content || '', ...(node.data || {}) }
            }))
            const placedEdges: any[] = placedNodes.map((node, idx) => ({
              id: `edge-${topicNode.id}-${node.id}`,
              source: topicNode.id,
              target: node.id,
              type: toVisualEdgeType(edgeTypePref) as any
            }))
            setNodes([topicNode, ...placedNodes])
            setEdges(placedEdges as any)
            const boardData = { nodes: [topicNode, ...placedNodes], edges: placedEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
            await boardStorage.updateBoard(boardId, boardData)
            showAddToast('added', placedNodes.length)
            setHasUnsavedChanges(false)
            if (onBoardStateChange) onBoardStateChange(brief.boardName, 'saved', false)
            router.push(`/board/${boardId}`)
            return
          }
          const placedNodes: any[] = result.placements.map(p => ({ id: p.node.id, type: p.node.type as any, position: p.position, data: { ...p.node.data } }))
          const placedEdges: any[] = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || (toVisualEdgeType(edgeTypePref) as any) }))
          setNodes([topicNode, ...placedNodes])
          setEdges(placedEdges as any)
          const boardData = { nodes: [topicNode, ...placedNodes], edges: placedEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
          await boardStorage.updateBoard(boardId, boardData)
          showAddToast('added', placedNodes.length)
          setHasUnsavedChanges(false)
          if (onBoardStateChange) onBoardStateChange(brief.boardName, 'saved', false)
          router.push(`/board/${boardId}`)
          return
        }
        responseContent = JSON.stringify([])
      } catch (err: any) {
        // Surface server-provided message for 402/other issues
        const msg = err?.message || 'Failed to generate starter nodes'
        console.warn('[generateStarterNodes] AI error:', err)
        try { window.dispatchEvent(new CustomEvent('nodal:toast', { detail: { message: msg, variant: 'warning' } })) } catch {}
        // Heuristic fallback: generate 5 practical starter nodes based on the topic so it's never a no-op
        try {
          const titles = [
            `Overview: ${brief.boardTopic}`,
            `Key Ideas for ${brief.boardTopic}`,
            `Plan & Steps`,
            `Resources`,
            `Next Actions`
          ]
          const desc = (hint: string) => {
            const base = brief.description?.trim() ? `Context: ${brief.description.trim()}. ` : ''
            return `${base}${hint}`
          }
          const contentHints = [
            desc('Summarize the goals and scope.'),
            desc('List 3–6 bullet points that capture the theme.'),
            desc('Write a short step-by-step outline.'),
            desc('List tools, links, or references to consider.'),
            desc('Propose 3 immediate, concrete next steps.')
          ]
          const nodesToPlace = titles.map((title, index) => ({
            title,
            content: contentHints[index] || '',
            type: 'default' as const,
            parentId: topicNode.id,
          }))
          const result = await placeAINodes(nodesToPlace as any, topicNode.id, { preferredDirection: 'down', minDistance: 40, avoidOverlap: true, preserveExistingLayout: true }, getNodesWithTopic() as any)
          let placedNodes: any[]
          let placedEdges: any[]
          if (!result.success || !result.placements.length) {
            // Fallback: simple grid placement below topic node
            console.warn('[generateStarterNodes] Fallback placement engine failed, using simple grid layout', result.warnings || [])
            const cellWidth = 300
            const padding = 60
            const startX = topicNode.position.x - ((nodesToPlace.length - 1) * (cellWidth + padding)) / 2
            const startY = topicNode.position.y + 250
            placedNodes = nodesToPlace.map((node, idx) => ({
              id: (node as any).id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type: node.type || 'default',
              position: { x: startX + idx * (cellWidth + padding), y: startY },
              data: { title: node.title, content: node.content || '' }
            }))
            placedEdges = placedNodes.map((node) => ({
              id: `edge-${topicNode.id}-${node.id}`,
              source: topicNode.id,
              target: node.id,
              type: toVisualEdgeType(edgeTypePref) as any
            }))
          } else {
            placedNodes = result.placements.map(p => ({ id: p.node.id, type: p.node.type as any, position: p.position, data: { ...p.node.data } }))
            placedEdges = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || (toVisualEdgeType(edgeTypePref) as any) }))
          }
          setNodes([topicNode, ...placedNodes])
          setEdges(placedEdges as any)
          const boardData = { nodes: [topicNode, ...placedNodes], edges: placedEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
          await boardStorage.updateBoard(boardId, boardData)
          const appended = await maybeAppendMediaNodes([topicNode, ...placedNodes], placedEdges as any)
          showAddToast('added', placedNodes.length + (appended?.mediaCount || 0))
          setHasUnsavedChanges(false)
          if (onBoardStateChange) onBoardStateChange(brief.boardName, 'saved', false)
          router.push(`/board/${boardId}`)
        } catch {
          // As a final fallback, just continue to the board
          router.push(`/board/${boardId}`)
        }
        return
      }

      try {
        let jsonContent = (responseContent || '').trim()
        if (jsonContent.startsWith('```json')) {
          jsonContent = jsonContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
        } else if (jsonContent.startsWith('```')) {
          jsonContent = jsonContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
        }
        
        const nodeDataArray = JSON.parse(jsonContent)
        const asArray: any[] = Array.isArray(nodeDataArray) ? nodeDataArray : []

        // Always go through the core placement engine for starter node placement.
        const nodesToPlace = (asArray.length ? asArray : [{
          label: `Getting Started with ${brief.boardTopic}`,
          content: responseContent || '',
        }]).map((nodeData: any) => ({
          title: String(nodeData.label || 'Node'),
          content: String(nodeData.content || ''),
          type: 'default' as const,
          parentId: topicNode.id,
        }))

        const result = await placeAINodes(nodesToPlace as any, topicNode.id, { preferredDirection: 'down', minDistance: 40, avoidOverlap: true, preserveExistingLayout: true }, getNodesWithTopic() as any)
        if (!result.success || !result.placements.length) {
          router.push(`/board/${boardId}`)
          return
        }

        const generatedNodes: any[] = result.placements.map(p => ({ id: p.node.id, type: p.node.type, position: p.position, data: { ...p.node.data } }))
        const generatedEdges: any[] = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || (toVisualEdgeType(edgeTypePref) as any) }))
        setNodes([topicNode, ...generatedNodes])
        setEdges(generatedEdges as any)
        const boardData = { nodes: [topicNode, ...generatedNodes], edges: generatedEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
        await boardStorage.updateBoard(boardId, boardData)
        const appended = await maybeAppendMediaNodes([topicNode, ...generatedNodes], generatedEdges as any)
        showAddToast('added', generatedNodes.length + (appended?.mediaCount || 0))

        setHasUnsavedChanges(false)
        if (onBoardStateChange) onBoardStateChange(brief.boardName, 'saved', false)
        router.push(`/board/${boardId}`)
      } catch (parseError) {
        // Could not parse node list; still create a single useful node via the placement engine.
        try {
          const nodesToPlace = [{
            title: `Getting Started with ${brief.boardTopic}`,
            content: String(responseContent || '').trim(),
            type: 'default' as const,
            parentId: topicNode.id,
          }]
          const result = await placeAINodes(nodesToPlace as any, topicNode.id, { preferredDirection: 'down', minDistance: 40, avoidOverlap: true, preserveExistingLayout: true }, getNodesWithTopic() as any)
          const placed = result.placements?.[0]
          if (!placed) { router.push(`/board/${boardId}`); return }
          const newNode: any = { id: placed.node.id, type: placed.node.type, position: placed.position, data: { ...placed.node.data } }
          const newEdges: any[] = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || (toVisualEdgeType(edgeTypePref) as any) }))
          setNodes([topicNode, newNode])
          setEdges(newEdges as any)
          const boardData = { nodes: [topicNode, newNode], edges: newEdges as any, viewport: reactFlowInstance.getViewport(), topic: brief.boardTopic || null, colorgories: useBoardStore.getState().colorgories || [] }
          await boardStorage.updateBoard(boardId, boardData)
          const appended = await maybeAppendMediaNodes([topicNode, newNode], newEdges as any)
          showAddToast('added', 1 + (appended?.mediaCount || 0))
          setHasUnsavedChanges(false)
          if (onBoardStateChange) onBoardStateChange(brief.boardName, 'saved', false)
          router.push(`/board/${boardId}`)
        } catch {
          router.push(`/board/${boardId}`)
        }
      }
    } catch (error) {
      try {
        const msg = String((error as any)?.message || error || '')
        if (msg.toLowerCase().includes('token') && msg.toLowerCase().includes('limit')) {
          setToastVariant('warning')
          setToastMessage('Monthly AI token limit reached. Manage your plan in Profile → AI Tokens.')
          setToastOpen(true)
        }
      } catch {}
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
          // Place topic node via the core placement engine (avoids overlaps and keeps placement consistent)
          const center = getViewportCenter()
          let topicNode: any = { id: topicNodeId, type: 'default' as const, position: center, data: { title: pendingBoardBrief.boardTopic, content: '' } }
          try {
            const res = await placeManualNode(
              { id: topicNodeId, title: pendingBoardBrief.boardTopic, content: '', type: 'default', preferredPosition: center } as any,
              center,
              { minDistance: 80, avoidOverlap: true, preserveExistingLayout: true },
              (useBoardStore.getState().nodes || []) as any
            )
            const placement = res.placements?.[0]
            if (placement) {
              topicNode = { id: placement.node.id, type: placement.node.type as any, position: placement.position, data: { ...placement.node.data } }
            }
          } catch {}

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

  // Shared helpers: apply/remove primary blue hover ring overlay on a node element
  const applyConnectHover = useCallback((el: HTMLElement | null) => {
    if (!el) return
    try {
      const existing = el.querySelector('[data-connect-hover]') as HTMLElement | null
      if (existing) return
      // Ensure position context for overlay
      if (getComputedStyle(el).position === 'static') {
        el.style.position = 'relative'
      }
      const overlay = document.createElement('div')
      overlay.setAttribute('data-connect-hover', 'true')
      overlay.style.position = 'absolute'
      overlay.style.inset = '0'
      overlay.style.border = '2px solid #3b82f6'
      overlay.style.borderRadius = 'inherit'
      overlay.style.pointerEvents = 'none'
      overlay.style.boxShadow = '0 0 12px rgba(59,130,246,0.35)'
      overlay.style.zIndex = '2'
      el.appendChild(overlay)
    } catch {}
  }, [])

  const clearConnectHover = useCallback((el: HTMLElement | null) => {
    if (!el) return
    try {
      const overlay = el.querySelector('[data-connect-hover]') as HTMLElement | null
      if (overlay && overlay.parentElement) {
        overlay.parentElement.removeChild(overlay)
      }
      el.classList.remove('ring-2', 'ring-primary-500')
      el.style.outline = ''
      el.style.outlineOffset = ''
      el.style.boxShadow = ''
    } catch {}
  }, [])

  // Preview state for manual Shift+Drag connection
  const [manualConnectPreview, setManualConnectPreview] = useState<{
    source: { x: number; y: number }
    pointer: { x: number; y: number }
    overTarget: boolean
  } | null>(null)

  // Shift + click + drag to connect two nodes by dropping on a node surface
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (!e.shiftKey) return
      const target = e.target as HTMLElement | null
      if (!target) return
      const nodeEl = target.closest?.('.react-flow__node') as HTMLElement | null
      const sourceId = nodeEl?.getAttribute?.('data-id') || null
      if (!sourceId) return
      // Start a manual connect operation
      try { e.preventDefault(); e.stopPropagation() } catch {}
      connectingSourceRef.current = sourceId
      setConnectingSource(sourceId)

      // Compute source center relative to wrapper for preview line
      const wrapper = reactFlowWrapper.current as HTMLElement | null
      const wrapRect = wrapper?.getBoundingClientRect()
      const nodeRect = nodeEl.getBoundingClientRect()
      if (wrapRect) {
        const sx = nodeRect.left + nodeRect.width / 2 - wrapRect.left
        const sy = nodeRect.top + nodeRect.height / 2 - wrapRect.top
        setManualConnectPreview({ source: { x: sx, y: sy }, pointer: { x: sx, y: sy }, overTarget: false })
      }

      let hoveredTargetEl: HTMLElement | null = null
      const clearHover = () => {
        if (hoveredTargetEl) {
          clearConnectHover(hoveredTargetEl)
          hoveredTargetEl = null
        }
      }

      const handleMouseMove = (mv: MouseEvent) => {
        const wrapperMv = reactFlowWrapper.current as HTMLElement | null
        const rect = wrapperMv?.getBoundingClientRect()
        if (!rect) return
        const px = mv.clientX - rect.left
        const py = mv.clientY - rect.top
        // Detect if hovering over a valid target node (not the source)
        let overTarget = false
        let candidateEl: HTMLElement | null = null
        try {
          const elAt = document.elementFromPoint(mv.clientX, mv.clientY) as HTMLElement | null
          const dropNode = elAt?.closest?.('.react-flow__node, .xyflow__node') as HTMLElement | null
          const targetId = dropNode?.getAttribute?.('data-id') || null
          overTarget = !!(targetId && targetId !== sourceId)
          candidateEl = (overTarget ? dropNode : null)
        } catch {}
        if (candidateEl !== hoveredTargetEl) {
          // Remove previous highlight
          clearHover()
          // Add highlight to new target
          if (candidateEl) {
            applyConnectHover(candidateEl)
            hoveredTargetEl = candidateEl
          }
        }
        setManualConnectPreview(prev => prev ? { ...prev, pointer: { x: px, y: py }, overTarget } : prev)
      }

      const handleMouseUp = (up: MouseEvent) => {
        try { up.preventDefault(); up.stopPropagation() } catch {}
        const source = connectingSourceRef.current
        const done = () => clearConnecting()
        if (!source) { done(); cleanup(); return }
        // Find node under cursor on mouseup
        const x = up.clientX
        const y = up.clientY
        const elAt = document.elementFromPoint(x, y) as HTMLElement | null
        const dropNode = elAt?.closest?.('.react-flow__node, .xyflow__node') as HTMLElement | null
        const targetId = dropNode?.getAttribute?.('data-id') || null
        if (targetId && targetId !== source) {
          pushHistory()
          const newEdge: Edge = {
            id: `edge-${Date.now()}`,
            source: source,
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
        setManualConnectPreview(null)
        done()
        cleanup()
      }

      const cleanup = () => {
        document.removeEventListener('mouseup', handleMouseUp, true)
        document.removeEventListener('mousemove', handleMouseMove, true)
        clearHover()
      }

      document.addEventListener('mousemove', handleMouseMove, true)
      document.addEventListener('mouseup', handleMouseUp, true)
    }

    document.addEventListener('mousedown', onMouseDown, true)
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true)
    }
  }, [setEdges, setConnectingSource, clearConnecting, pushHistory, toVisualEdgeType, edgeTypePref, user?.id])

  // Show blue hover ring when connecting from a handle as well (not only Shift+Drag)
  useEffect(() => {
    let hoveredEl: HTMLElement | null = null
    const clear = () => {
      if (hoveredEl) {
        clearConnectHover(hoveredEl)
        hoveredEl = null
      }
    }
    const onMove = (e: MouseEvent) => {
      // If we are not in any connect operation, clear and exit
      if (!connectingSourceRef.current) { clear(); return }
      // Skip if manual shift-drag preview is active (handled by that logic already)
      if (manualConnectPreview) return
      let candidate: HTMLElement | null = null
      try {
        const elAt = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
        const nodeEl = elAt?.closest?.('.react-flow__node, .xyflow__node') as HTMLElement | null
        const targetId = nodeEl?.getAttribute?.('data-id') || null
        const sourceId = connectingSourceRef.current
        if (targetId && sourceId && targetId !== sourceId) candidate = nodeEl
      } catch {}
      if (candidate !== hoveredEl) {
        clear()
        if (candidate) {
          applyConnectHover(candidate)
          hoveredEl = candidate
        }
      }
    }
    const onUp = () => { clear() }
    document.addEventListener('mousemove', onMove, true)
    document.addEventListener('mouseup', onUp, true)
    return () => {
      document.removeEventListener('mousemove', onMove, true)
      document.removeEventListener('mouseup', onUp, true)
      clear()
    }
  }, [manualConnectPreview])
  
  // Handle adding nodes
  const handleAddNode = useCallback((nodeData: { title: string; content?: string }, position: { x: number; y: number }) => {
    ;(async () => {
      try {
        pushHistory()
        const title = String(nodeData.title || '').trim() || 'Untitled'
        const content = nodeData.content

        const result = await placeManualNode(
          { title, content, type: 'default', preferredPosition: position } as any,
          position,
          { minDistance: 40, avoidOverlap: true, preserveExistingLayout: true },
          (useBoardStore.getState().nodes || []) as any
        )
        const placement = result.placements?.[0]
        if (!placement) return
        const newNode: Node = { id: placement.node.id, type: placement.node.type as any, position: placement.position, data: { ...placement.node.data } as any }

        setNodes((nds) => {
          if (!Array.isArray(nds)) return [newNode]
          return [...nds, newNode]
        })
      } catch {}
    })()
  }, [setNodes, pushHistory, placeManualNode])

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
  
  // Handle nodes added from ChatPanel (Nobot node generation)
  useEffect(() => {
    const onAddNodes = (ev: Event) => {
      if (readOnly) return
      ;(async () => {
        try {
          const detail = (ev as CustomEvent<any>)?.detail
          const itemsAll: Array<{ title: string; content?: string }> = Array.isArray(detail?.nodes) ? detail.nodes : []
          const MAX_NOBOT_ADD_NODES = 25
          const items = itemsAll.slice(0, MAX_NOBOT_ADD_NODES)
          if (!items.length) return

          pushHistory()
          const selectedIds: string[] = (useBoardStore.getState().selectedNodeIds || []) as any
          const singleSelectedId = Array.isArray(selectedIds) && selectedIds.length === 1 ? selectedIds[0] : null

          const nodesToPlace = items.map((it) => ({
            title: String(it.title || '').trim() || 'Untitled',
            content: String(it.content || ''),
            type: 'default' as const,
            ...(singleSelectedId ? { parentId: singleSelectedId } : {})
          }))

          // Always go through the placement engine so behavior stays consistent across all entrypoints.
          const result = await placeAINodes(
            nodesToPlace,
            singleSelectedId || undefined,
            { preferredDirection: 'down', minDistance: 40, avoidOverlap: true, preserveExistingLayout: true }
          )

          if (!result.success || !result.placements.length) return
          const newNodes: Node[] = result.placements.map(p => ({ id: p.node.id, type: p.node.type as any, position: p.position, data: { ...p.node.data } }))
          setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
          if (result.connections.length > 0) {
            const newEdges: Edge[] = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || (toVisualEdgeType(edgeTypePref) as any) }))
            setEdges((eds) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
          }
          showAddToast('generated', newNodes.length)
          centerOnNodeIds(newNodes.map(n => n.id))
        } catch {}
      })()
    }
    window.addEventListener('nodal:add-nodes', onAddNodes as EventListener)
    return () => window.removeEventListener('nodal:add-nodes', onAddNodes as EventListener)
  }, [readOnly, pushHistory, placeAINodes, setNodes, setEdges, showAddToast, centerOnNodeIds, toVisualEdgeType, edgeTypePref])

  const saveBoard = useCallback(async (name?: string) => {
    await manualSave(nodes, pruneGhostEdges(nodes, edges), name)
  }, [manualSave, nodes, edges, pruneGhostEdges])

  


  
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

      input.addEventListener('change', async () => {
        const file = input.files?.[0]
        if (file) {
          const viewportCenter = getViewportCenter()
          const ok = await handleDocumentUpload(file, viewportCenter)
          if (ok) showAddToast('added', 1)
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

  // Allow external UI (e.g., context menu) to programmatically select nodes
  useEffect(() => {
    const onSelect = (e: Event) => {
      try {
        const idsIn: string[] = Array.isArray((e as CustomEvent<any>)?.detail?.ids) ? (e as CustomEvent<any>).detail.ids : []
        const existingIds = (useBoardStore.getState().nodes || []).map((n: any) => n.id)
        const filtered = idsIn.filter((id) => existingIds.includes(id))
        setSelectedNodes(filtered)
        useBoardStore.getState().setSelectedNodes(filtered)
        // Update XYFlow visual selection
        try {
          reactFlowInstance.setNodes((cur) => cur.map((n) => ({ ...n, selected: filtered.includes(n.id) })))
        } catch {}
      } catch {}
    }
    window.addEventListener('nodal:select-nodes', onSelect as EventListener)
    const onBulkDelete = (ev: Event) => {
      try {
        const ids: string[] = Array.isArray((ev as CustomEvent<any>)?.detail?.ids) ? (ev as CustomEvent<any>).detail.ids : []
        if (!ids || ids.length === 0) return
        pushHistory()
        setNodes((nds) => (Array.isArray(nds) ? nds.filter((n: any) => !ids.includes(n.id)) : nds))
        setEdges((eds) => (Array.isArray(eds) ? eds.filter((e: any) => !ids.includes(e.source) && !ids.includes(e.target)) : eds))
        try { useBoardStore.getState().clearSelectedNodes() } catch {}
      } catch {}
    }
    window.addEventListener('nodal:bulk-delete', onBulkDelete as EventListener)

    const stripJsonFencesLocal = (text: string) => {
      let t = (text || '').trim()
      if (t.startsWith('```json')) t = t.replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
      else if (t.startsWith('```')) t = t.replace(/^```\s*/i, '').replace(/\s*```$/i, '')
      return t.trim()
    }
    const escapeHtml = (s: string) =>
      String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')

    const onSummarizeSelection = (ev: Event) => {
      ;(async () => {
        try {
          if (readOnly) return
          if (summarizingSelection) return
          setSummarizingSelection(true)
          const idsIn: string[] = Array.isArray((ev as CustomEvent<any>)?.detail?.ids) ? (ev as CustomEvent<any>).detail.ids : []
          const ids = Array.from(new Set(idsIn)).filter(Boolean)
          if (ids.length < 2) return

          const store = useBoardStore.getState() as any
          const nodesList: any[] = Array.isArray(store.nodes) ? store.nodes : []
          const selected = nodesList.filter((n: any) => ids.includes(n.id))
          if (selected.length < 2) return

          // Place near centroid of selected cluster, offset to avoid covering.
          let minX = Number.POSITIVE_INFINITY
          let minY = Number.POSITIVE_INFINITY
          let maxX = Number.NEGATIVE_INFINITY
          let maxY = Number.NEGATIVE_INFINITY
          for (const n of selected) {
            const dims = getApproxDims(n)
            const x = Number(n?.position?.x || 0)
            const y = Number(n?.position?.y || 0)
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x + dims.width)
            maxY = Math.max(maxY, y + dims.height)
          }
          const cx = (minX + maxX) / 2
          const cy = (minY + maxY) / 2

          const topic = String(store.topic || '').trim()

          // Build compact input for the model (include non-text nodes only as brief mentions).
          const normalizeNodeForAI = (n: any) => {
            const type = String(n?.type || n?.data?.type || 'default')
            const title = String(n?.data?.title || n?.data?.label || n?.data?.name || '').trim()
            const contentRaw =
              String(
                n?.data?.content ||
                n?.data?.description ||
                ''
              )
            const urlHint =
              String(
                n?.data?.linkUrl ||
                n?.data?.videoUrl ||
                n?.data?.previewUrl ||
                n?.data?.imageUrl ||
                ''
              ).trim()

            // Keep non-text nodes short: title + (optional) 1-liner + optional hostname hint.
            const isNonText = /image|video|link|document/i.test(type)
            const content = (contentRaw || '').trim().slice(0, isNonText ? 220 : 700)
            const url = isNonText ? (urlHint ? urlHint.slice(0, 180) : '') : ''
            return { id: String(n?.id || ''), type, title: title || '(Untitled)', content, url }
          }

          const inputNodes = selected.map(normalizeNodeForAI)
          const titles = inputNodes.map(n => n.title).filter(Boolean)
          const basedOnShort = (() => {
            const uniq = Array.from(new Set(titles))
            const shown = uniq.slice(0, 4)
            const rest = uniq.length - shown.length
            return rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', ')
          })()

          const sys = [
            'You are a summarizer for a visual thinking board app.',
            'You MUST produce a succinct, structured summary that is clearly DERIVED from the provided nodes.',
            'Do NOT invent new facts; do NOT add new original content.',
            '',
            'Return STRICT JSON only (no markdown fences) with this exact shape:',
            '{ "theme": string, "keyTakeaways": string[], "openQuestions": string[], "nextSteps": string[] }',
            '',
            'Rules:',
            '- Keep it concise: keyTakeaways 3-6, openQuestions 1-3, nextSteps 2-5.',
            '- Use plain sentences or fragments (no emojis).',
            '- Treat non-text nodes (image/video/link/document) as references; mention them only briefly.',
          ].join('\n')

          const userPrompt = [
            topic ? `Board topic: ${topic}` : '',
            `Selected nodes (${inputNodes.length}):`,
            JSON.stringify(inputNodes),
          ].filter(Boolean).join('\n\n')

          // Call server proxy (uses server key and logs usage). Include auth token if available.
          let token: string | null = null
          try {
            const supa = getSupabaseClient()
            const { data } = await supa.auth.getSession()
            token = data?.session?.access_token || null
          } catch {}

          const resp = await fetch('/api/ai/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
              ...(boardId ? { 'x-board-id': String(boardId) } : {}),
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: sys },
                { role: 'user', content: userPrompt },
              ],
              temperature: 0.2,
              max_tokens: 700,
              stream: false,
            }),
          })
          if (!resp.ok) {
            const j = await resp.json().catch(() => ({}))
            throw new Error(j?.error || `Summarize failed (${resp.status})`)
          }
          const j = await resp.json().catch(() => ({}))
          const content = String(j?.choices?.[0]?.message?.content || '').trim()
          let parsed: any = null
          try { parsed = JSON.parse(stripJsonFencesLocal(content)) } catch {}

          const themeRaw = String(parsed?.theme || '').trim()
          const keyTakeaways: string[] = Array.isArray(parsed?.keyTakeaways) ? parsed.keyTakeaways.map((x: any) => String(x || '').trim()).filter(Boolean) : []
          const openQuestions: string[] = Array.isArray(parsed?.openQuestions) ? parsed.openQuestions.map((x: any) => String(x || '').trim()).filter(Boolean) : []
          const nextSteps: string[] = Array.isArray(parsed?.nextSteps) ? parsed.nextSteps.map((x: any) => String(x || '').trim()).filter(Boolean) : []

          const fallbackTheme = `Summary (${inputNodes.length} nodes)`
          const theme = themeRaw ? themeRaw.slice(0, 60) : fallbackTheme
          const title = themeRaw ? `Summary: ${theme}` : fallbackTheme

          const section = (label: string, items: string[]) => {
            if (!items.length) return ''
            const lis = items.slice(0, 8).map((it) => `<li>${escapeHtml(it)}</li>`).join('')
            return `<p><strong>${escapeHtml(label)}</strong></p><ul>${lis}</ul>`
          }

          const html = [
            section('Key takeaways', keyTakeaways),
            section('Open questions', openQuestions),
            section('Next steps', nextSteps),
            `<p class="text-xs text-gray-500 dark:text-gray-400"><em>Based on: ${escapeHtml(basedOnShort || `${inputNodes.length} selected nodes`)}</em></p>`,
          ].filter(Boolean).join('')

          const newId = `summary-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          const basePos = { x: cx + 60, y: cy + 40 }

          const placementResult = await placeManualNode(
            {
              id: newId,
              title,
              content: html,
              type: 'default',
              data: {
                title,
                content: html,
                summaryDerived: true,
                summarySourceIds: ids,
                titleSize: 'md',
                // Summary nodes are intentionally wider to fit structured content.
                width: 480,
              } as any,
              preferredPosition: basePos,
            } as any,
            basePos,
            { minDistance: 40, avoidOverlap: true, preserveExistingLayout: true },
            nodesList as any
          )

          const placement = placementResult.placements?.[0]
          if (!placement) throw new Error('No placement returned')
          const placed: any = { id: placement.node.id, type: placement.node.type, position: placement.position, data: { ...placement.node.data } }

          pushHistory()
          setNodes((nds) => {
            const cur = Array.isArray(nds) ? nds : []
            return [...cur, placed]
          })

          // Auto-select the new node
          try { store.setSelectedNodes([newId]) } catch {}
          try {
            reactFlowInstance.setNodes((cur) => cur.map((n) => ({ ...n, selected: n.id === newId })))
          } catch {}
          try { showAddToast('generated' as any, 1) } catch {}
          try { centerOnNodeIds([newId], { align: 'midLeft' }) } catch {}
        } catch (err: any) {
          try {
            window.dispatchEvent(new CustomEvent('nodal:toast', { detail: { message: String(err?.message || 'Failed to summarize selection'), variant: 'warning' } }))
          } catch {}
        } finally {
          try { setSummarizingSelection(false) } catch {}
        }
      })()
    }
    window.addEventListener('nodal:summarize-selection', onSummarizeSelection as EventListener)
    return () => {
      window.removeEventListener('nodal:select-nodes', onSelect as EventListener)
      window.removeEventListener('nodal:bulk-delete', onBulkDelete as EventListener)
      window.removeEventListener('nodal:summarize-selection', onSummarizeSelection as EventListener)
    }
  }, [reactFlowInstance, readOnly, boardId, getApproxDims, pushHistory, setNodes, showAddToast, centerOnNodeIds, summarizingSelection, placeManualNode])

  // Global drag event listener to handle files dragged from outside
  useEffect(() => {
    let isFileBeingDragged = false

    const handleGlobalDragOver = (e: DragEvent) => {
      if (readOnly) return
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const handleGlobalDrop = (e: DragEvent) => {
      if (readOnly) return
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const handleWindowDragEnter = (e: DragEvent) => {
      if (readOnly) return
      // Only activate if we have files and haven't already activated
      if (!isFileBeingDragged && e.dataTransfer?.types.includes("Files")) {
        e.preventDefault() // This is the key fix - tell browser this is a custom drop zone
        isFileBeingDragged = true
        setIsDragOver(true)
        // console.log("🔄 File drag detected - overlay ON")
      }
    }

    const handleWindowDragOver = (e: DragEvent) => {
      if (readOnly) return
      // Always prevent default for file drags
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault()
        e.stopPropagation()
        e.dataTransfer.dropEffect = "copy"
      }
    }

    // Hide overlay when pointer leaves the browser window during a drag
    const handleWindowDragLeave = (e: DragEvent) => {
      if (readOnly) return
      // Only when leaving the viewport bounds (not when moving between children)
      const x = e.clientX
      const y = e.clientY
      const leftWindow = x <= 0 || y <= 0 || x >= window.innerWidth || y >= window.innerHeight
      if (leftWindow) {
        isFileBeingDragged = false
        setIsDragOver(false)
        // console.log("↩️ Drag left window - overlay OFF")
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
      if (readOnly) return
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
                  ;(async () => { const ok = await handleDocumentUpload(file, flowPosition); if (ok) showAddToast('added', 1) })()
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
    window.addEventListener("dragleave", handleWindowDragLeave)
    window.addEventListener("dragend", handleWindowDragEnd)
    window.addEventListener("drop", handleWindowDrop)

    return () => {
      window.removeEventListener("dragenter", handleWindowDragEnter)
      window.removeEventListener("dragover", handleWindowDragOver)
      window.removeEventListener("dragleave", handleWindowDragLeave)
      window.removeEventListener("dragend", handleWindowDragEnd)
      window.removeEventListener("drop", handleWindowDrop)
    }
  }, [handleDocumentUpload, showAddToast, readOnly])
  
  // Paste handler: supports URLs (video/link) and files (image/pdf/etc.)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      try {
        if (readOnly) return
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
            ;(async () => { const ok = await handleDocumentUpload(file as File, center); if (ok) showAddToast('added', 1) })()
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
        if (!url) {
          // Try to extract a URL from arbitrary pasted text (e.g., code blocks)
          const m = trimmed.match(/https?:\/\/[\w.-]+\.[\w.-]+[^\s)"']*/i)
          if (m && m[0]) {
            try { url = new URL(m[0]) } catch { url = null }
          }
        }
        if (!url) return
        e.preventDefault()

        const href = url.toString()
        const host = url.hostname.toLowerCase()
        const isYouTube = host.includes('youtube.com') || host.includes('youtu.be')
        const isSpotify = host.includes('open.spotify.com')

        if (isYouTube) {
          const newNode: Node = {
            id: `video-${Date.now()}`,
            type: 'video',
            position: center,
            data: { title: 'Video', videoUrl: href, status: 'idle' } as any,
          }
          setNodes((nds) => (Array.isArray(nds) ? [...nds, newNode] : [newNode]))
          showAddToast('added', 1)
        } else if (isSpotify) {
          let embedUrl = ''
          try {
            const u = new URL(href)
            u.hostname = 'open.spotify.com'
            u.pathname = `/embed${u.pathname}`
            u.search = ''
            embedUrl = u.toString()
          } catch { embedUrl = href.replace('open.spotify.com/', 'open.spotify.com/embed/') }
          const newNode: Node = {
            id: `spotify-${Date.now()}`,
            type: 'spotify',
            position: center,
            data: { title: 'Spotify', spotifyUrl: href, embedUrl, status: 'loading' } as any,
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
  }, [getViewportCenter, handleDocumentUpload, setNodes, showAddToast, readOnly])
  
  // Keyboard shortcuts via hook
  useBoardShortcuts(() => { if (!readOnly) { saveBoard() } })
  
  // === Story Mode (MVP: linear flow) ===
  const [storyActive, setStoryActive] = useState(false)
  const [storyPath, setStoryPath] = useState<string[]>([])
  const [storyIndex, setStoryIndex] = useState(0)
  // Choice nodes: when a chapter has multiple children, user must choose
  const [choiceOptions, setChoiceOptions] = useState<Array<{ id: string; title: string }>>([])
  const isOnChoice = storyActive && choiceOptions.length > 0
  // Adjust this to control the zoom level when landing on a chapter in Story Mode
  const STORY_CHAPTER_ZOOM = 1.08
  const computeStoryPath = useCallback((starterId: string): string[] => {
    const idSet = new Set<string>()
    const outMap = new Map<string, string[]>()
    try {
      const eds = (useBoardStore.getState().edges || edges || []) as any[]
      for (const e of eds) {
        if (!e || typeof e.source !== 'string' || typeof e.target !== 'string') continue
        if (!outMap.has(e.source)) outMap.set(e.source, [])
        outMap.get(e.source)!.push(e.target)
      }
    } catch {}
    const path: string[] = []
    let cur: string | null = starterId
    while (cur && !idSet.has(cur)) {
      path.push(cur)
      idSet.add(cur)
      const outs = outMap.get(cur) || []
      if (outs.length === 0) break
      // MVP: choose the first child deterministically
      cur = outs[0]
    }
    return path
  }, [edges])
  // Selection updates for story mode disabled to avoid render/update loops
  // Guard to avoid feedback loops while we programmatically adjust viewport
  const recenterGuardRef = useRef(false)
  // Center on a node using its actual DOM bounds so expanded sizes are respected
  const centerOnNodeIdScreenAware = useCallback((nodeId: string, opts?: { zoom?: number; duration?: number }) => {
    try {
      const nodeEl = document.querySelector(`.react-flow__node[data-id="${nodeId}"]`) as HTMLElement | null
      if (!nodeEl) {
        centerOnNodeIds([nodeId])
        return
      }
      const nrect = nodeEl.getBoundingClientRect()
      const cxScreen = nrect.left + nrect.width / 2
      const cyScreen = nrect.top + nrect.height / 2
      const flowPoint = reactFlowInstance.screenToFlowPosition({ x: cxScreen, y: cyScreen })
      const duration = opts?.duration ?? 900
      const desiredZoom = opts?.zoom ?? (reactFlowInstance.getZoom?.() ?? 1)
      recenterGuardRef.current = true
      reactFlowInstance.setCenter(flowPoint.x, flowPoint.y, { zoom: desiredZoom, duration, easing: 'easeInOutCubic' } as any)
      setTimeout(() => { recenterGuardRef.current = false }, Math.max(0, duration))
    } catch {
      centerOnNodeIds([nodeId])
    }
  }, [reactFlowInstance, centerOnNodeIds])
  const centerOnCurrentStoryNode = useCallback((idx: number) => {
    try {
      const id = storyPath[idx]
      if (id) {
        // Screen-aware center with story zoom; selection handled in nav/start flows
        centerOnNodeIdScreenAware(id, { zoom: STORY_CHAPTER_ZOOM, duration: 900 })
      }
      // If current node is a video, signal it to expand and autoplay
      try {
        const rfNodes = reactFlowInstance.getNodes?.() || []
        const n = rfNodes.find((nn: any) => nn.id === id)
        if (n && n.type === 'video') {
          setTimeout(() => {
            try { window.dispatchEvent(new CustomEvent('nodal:video-play', { detail: { id } })) } catch {}
          }, 120)
        }
      } catch {}
    } catch {}
  }, [storyPath, centerOnNodeIdScreenAware])
  // Recenter current story node while preserving user zoom
  const recenterCurrentStoryNodeAtZoom = useCallback(() => {
    try {
      const id = storyPath[storyIndex]
      if (!id) return
      const viewport = (reactFlowInstance.getViewport?.()) as any || { x: 0, y: 0, zoom: 1 }
      const currentZoom = viewport.zoom || 1
      recenterGuardRef.current = true
      centerOnNodeIdScreenAware(id, { zoom: currentZoom, duration: 0 })
      setTimeout(() => { recenterGuardRef.current = false }, 0)
    } catch {}
  }, [storyPath, storyIndex, centerOnNodeIdScreenAware, reactFlowInstance])
  const startStoryMode = useCallback((starterId: string, startAtBeginning?: boolean) => {
    const path = computeStoryPath(starterId)
    if (!path || path.length === 0) return
    setStoryPath(path)
    ;(async () => {
      // Pre-expand any video nodes in the story so sizing/centering uses expanded dimensions
      try {
        for (const nid of path) {
          const node = (useBoardStore.getState().nodes || []).find((n: any) => n.id === nid)
          if (node && node.type === 'video') {
            try { window.dispatchEvent(new CustomEvent('nodal:video-expand', { detail: { id: nid } })) } catch {}
          }
        }
      } catch {}
      try {
        // If explicitly starting at the beginning (from node's Play), skip resume lookup
        if (startAtBeginning) {
          setStoryIndex(0)
          setStoryActive(true)
          setTimeout(() => {
            centerOnCurrentStoryNode(0)
          }, 250)
          return
        }
        // Load saved progress for this user/story if available
        let resumeIdx = 0
        try {
          const effectiveBoardId = boardId || useBoardStore.getState().currentBoardId
          if (effectiveBoardId && user?.id) {
            const { data, error } = await getSupabaseClient()
              .from('story_progress')
              .select('current_index')
              .eq('board_id', effectiveBoardId)
              .eq('starter_node_id', starterId)
              .eq('user_id', user.id)
              .maybeSingle<any>()
            if (!error && data && typeof (data as any).current_index === 'number') {
              const ci = (data as any).current_index ?? 0
              resumeIdx = Math.max(0, Math.min(ci, path.length - 1))
            } else {
              // Fallback to localStorage if RLS blocks or no row yet
              try {
                const key = `nodal:storyProgress:${user.id}:${effectiveBoardId}:${starterId}`
                const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
                if (raw !== null) {
                  const parsed = Number(raw)
                  if (Number.isFinite(parsed)) resumeIdx = Math.max(0, Math.min(parsed, path.length - 1))
                }
              } catch {}
            }
          }
        } catch {}
        setStoryIndex(resumeIdx)
        setStoryActive(true)
        // Allow layout a moment to settle after expansions, then center
        setTimeout(() => {
          centerOnCurrentStoryNode(resumeIdx)
        }, 250)
      } catch {
        setStoryIndex(0)
        setStoryActive(true)
        setTimeout(() => {
          centerOnCurrentStoryNode(0)
        }, 250)
      }
    })()
  }, [computeStoryPath, centerOnNodeIds, boardId, user?.id, centerOnCurrentStoryNode])
  const exitStoryMode = useCallback((suppressPause?: boolean) => {
    try {
      const curId = storyPath[storyIndex]
      if (curId) {
        window.dispatchEvent(new CustomEvent('nodal:video-pause', { detail: { id: curId } }))
        // Also broadcast a paused story status with title for LeftDock
        if (!suppressPause) {
          try {
            const node = (useBoardStore.getState().nodes || []).find((n: any) => n.id === storyPath[0])
            const d: any = node?.data || {}
            const title = String(d.storyTitle || d.title || d.label || 'Story')
            window.dispatchEvent(new CustomEvent('nodal:story-paused', { detail: { id: storyPath[0], title } }))
          } catch {}
        }
        // Persist last chapter index
        try {
          const starterId = storyPath[0]
          const effectiveBoardId = boardId || useBoardStore.getState().currentBoardId
          if (starterId && effectiveBoardId && user?.id) {
            void getSupabaseClient().from('story_progress')
              .upsert({ board_id: effectiveBoardId, starter_node_id: starterId, user_id: user.id, current_index: storyIndex, updated_at: new Date().toISOString() } as any,
                { onConflict: 'board_id,starter_node_id,user_id' } as any)
              .then(() => undefined)
            try { window.localStorage.setItem(`nodal:storyProgress:${user.id}:${effectiveBoardId}:${starterId}`, String(storyIndex)) } catch {}
          }
        } catch {}
      }
    } catch {}
    setStoryActive(false)
    setStoryPath([])
    setStoryIndex(0)
  }, [storyPath, storyIndex])
  const nextStory = useCallback(() => {
    setStoryIndex((i) => {
      try {
        const prevId = storyPath[i]
        if (prevId) { window.dispatchEvent(new CustomEvent('nodal:video-pause', { detail: { id: prevId } })) }
      } catch {}
      // End of story behavior
      if (i >= Math.max(0, storyPath.length - 1)) {
        try {
          const center = getViewportCenter()
          const completeId = `story-complete-${Date.now()}`
          const node = {
            id: completeId,
            type: 'default' as const,
            position: { x: center.x, y: center.y },
            data: { title: 'Story Complete!', content: 'You’ve reached the end of this story.' } as any,
          }
          // Exit without paused status
          exitStoryMode(true)
          setTimeout(() => {
            setNodes((nds) => (Array.isArray(nds) ? [...nds, node] : [node]))
            try { showAddToast('added', 1) } catch {}
            try { centerOnNodeIds([completeId]) } catch {}
          }, 10)
        } catch {
          exitStoryMode(true)
        }
        return i
      }
      const ni = Math.min(i + 1, Math.max(0, storyPath.length - 1))
      setTimeout(() => centerOnCurrentStoryNode(ni), 10)
      // Save progress
      try {
        const starterId = storyPath[0]
        const effectiveBoardId = boardId || useBoardStore.getState().currentBoardId
        if (starterId && effectiveBoardId && user?.id) {
          void getSupabaseClient().from('story_progress')
            .upsert({ board_id: effectiveBoardId, starter_node_id: starterId, user_id: user.id, current_index: ni, updated_at: new Date().toISOString() } as any,
              { onConflict: 'board_id,starter_node_id,user_id' } as any)
            .then(() => undefined)
          try { window.localStorage.setItem(`nodal:storyProgress:${user.id}:${effectiveBoardId}:${starterId}`, String(ni)) } catch {}
        }
      } catch {}
      return ni
    })
  }, [storyPath, centerOnCurrentStoryNode, boardId, user?.id])
  const prevStory = useCallback(() => {
    setStoryIndex((i) => {
      try {
        const prevId = storyPath[i]
        if (prevId) { window.dispatchEvent(new CustomEvent('nodal:video-pause', { detail: { id: prevId } })) }
      } catch {}
      const ni = Math.max(i - 1, 0)
      setTimeout(() => centerOnCurrentStoryNode(ni), 10)
      // Save progress
      try {
        const starterId = storyPath[0]
        const effectiveBoardId = boardId || useBoardStore.getState().currentBoardId
        if (starterId && effectiveBoardId && user?.id) {
          void getSupabaseClient().from('story_progress')
            .upsert({ board_id: effectiveBoardId, starter_node_id: starterId, user_id: user.id, current_index: ni, updated_at: new Date().toISOString() } as any,
              { onConflict: 'board_id,starter_node_id,user_id' } as any)
            .then(() => undefined)
          try { window.localStorage.setItem(`nodal:storyProgress:${user.id}:${effectiveBoardId}:${starterId}`, String(ni)) } catch {}
        }
      } catch {}
      return ni
    })
  }, [storyPath, centerOnCurrentStoryNode, boardId, user?.id])
  useEffect(() => {
    if (!storyActive) return
    centerOnCurrentStoryNode(storyIndex)
  }, [storyActive, storyIndex, centerOnCurrentStoryNode])
  // Detect choice nodes (multiple children) for the current chapter
  useEffect(() => {
    if (!storyActive) { setChoiceOptions([]); return }
    const curId = storyPath[storyIndex]
    if (!curId) { setChoiceOptions([]); return }
    try {
      const eds = (useBoardStore.getState().edges || edges || []) as any[]
      const childIds = eds.filter((e: any) => e?.source === curId).map((e: any) => e?.target)
      if (childIds.length > 1) {
        const ns = (useBoardStore.getState().nodes || nodes || []) as any[]
        const opts = childIds.map((cid: string) => {
          const n = ns.find((nn: any) => nn.id === cid)
          const d: any = n?.data || {}
          return { id: cid, title: String(d.storyTitle || d.title || d.label || 'Choice') }
        })
        setChoiceOptions(opts)
      } else {
        setChoiceOptions([])
      }
    } catch {
      setChoiceOptions([])
    }
  }, [storyActive, storyIndex, storyPath, edges, nodes])
  const handleChooseBranch = useCallback((chosenId: string) => {
    try {
      const prefix = storyPath.slice(0, Math.max(0, Math.min(storyIndex + 1, storyPath.length)))
      const branch = computeStoryPath(chosenId)
      const newPath = [...prefix, ...branch]
      setStoryPath(newPath)
      setChoiceOptions([])
      // Advance to the chosen child index
      const nextIdx = prefix.length
      setStoryIndex(nextIdx)
      // If chosen is a video node, expand first so measurement uses expanded size
      try {
        const node = (useBoardStore.getState().nodes || []).find((n: any) => n.id === chosenId)
        if (node && node.type === 'video') {
          try { window.dispatchEvent(new CustomEvent('nodal:video-expand', { detail: { id: chosenId } })) } catch {}
        }
      } catch {}
      // Center directly on chosen id
      setTimeout(() => centerOnNodeIdScreenAware(chosenId, { zoom: STORY_CHAPTER_ZOOM, duration: 900 }), 30)
    } catch {}
  }, [storyPath, storyIndex, computeStoryPath, centerOnNodeIdScreenAware])
  // Dim non-active nodes via node.className
  useEffect(() => {
    if (!storyActive) {
      setNodes((nds) => (Array.isArray(nds) ? nds.map(n => ({ ...n, className: undefined })) : nds))
      return
    }
    setNodes((nds) => {
      const list = Array.isArray(nds) ? nds : []
      const activeId = storyPath[storyIndex]
      return list.map((n: any) => {
        const isActive = n.id === activeId
        return {
          ...n,
          className: isActive ? undefined : 'opacity-80'
        }
      })
    })
  }, [storyActive, storyPath, storyIndex])
  // Removed position-shift loop; we recenter viewport instead of moving nodes
  // Global: start story from LeftDock
  useEffect(() => {
    const onStartStory = (e: Event) => {
      try {
        const d = (e as CustomEvent<any>)?.detail as any
        const id = d?.id as string
        const startAtBeginning = !!d?.startAtBeginning
        if (!id) return
        startStoryMode(id, startAtBeginning)
      } catch {}
    }
    window.addEventListener('nodal:start-story', onStartStory as EventListener)
    const onVideoExpanded = (e: Event) => {
      try {
        if (!storyActive) return
        const nid = (e as CustomEvent<any>)?.detail?.id as string
        const currentId = storyPath[storyIndex]
        if (nid && currentId && nid === currentId) {
          // Recenter on the now-expanded node using its screen bounds
          setTimeout(() => centerOnNodeIdScreenAware(nid, { zoom: STORY_CHAPTER_ZOOM, duration: 200 }), 0)
        }
      } catch {}
    }
    window.addEventListener('nodal:video-expanded', onVideoExpanded as EventListener)
    return () => {
      window.removeEventListener('nodal:start-story', onStartStory as EventListener)
      window.removeEventListener('nodal:video-expanded', onVideoExpanded as EventListener)
    }
  }, [startStoryMode, storyActive, storyIndex, storyPath, centerOnNodeIdScreenAware])
  
  // Handler functions
  const handleNodeDelete = useCallback((nodeId: string) => {
    if (isEditingRef.current) { console.log('[BoardComponent] ignore delete while editing'); return }
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

  // Keyboard navigation in Story Mode: ArrowLeft/ArrowRight
  useEffect(() => {
    if (!storyActive) return
    const onKeyDown = (e: KeyboardEvent) => {
      try {
        if (e.defaultPrevented) return
        if (e.metaKey || e.ctrlKey || e.altKey) return
        const target = e.target as HTMLElement | null
        const tag = target?.tagName?.toLowerCase()
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return
        if (target?.isContentEditable) return
        if (e.key === 'ArrowRight') {
          e.preventDefault()
          // Block advancing if a choice is required on this chapter
          const eds = (useBoardStore.getState().edges || edges || []) as any[]
          const curId = storyPath[storyIndex]
          const childCount = eds.filter((ed: any) => ed?.source === curId).length
          const isChoice = childCount > 1
          if (!isChoice && storyIndex < Math.max(0, storyPath.length - 1)) {
            nextStory()
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          if (storyIndex > 0) {
            prevStory()
          }
        }
      } catch {}
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [storyActive, storyIndex, storyPath, nextStory, prevStory, edges])

  // Fallback: respond to global delete events
  useEffect(() => {
    const handler = (e: Event) => {
      if (isEditingRef.current) { console.log('[BoardComponent] ignore global delete while editing'); return }
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

  // Intercept Delete key to confirm before deleting (disabled in read-only)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return
      if (isEditingRef.current) return
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
  }, [readOnly])

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
      if (readOnly) return
      if (!isSelectionOverlay(e)) return
      e.preventDefault()
      e.stopPropagation()
      setPendingSourceNodeId(null)
      setContextMenu({ isOpen: true, position: { x: e.clientX, y: e.clientY } })
    }
    const onMouseDown = (e: MouseEvent) => {
      if (readOnly) return
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
  }, [readOnly])

  const handleNodeUpdate = useCallback(async (nodeId: string, updates: Partial<{ label: string; title: string; content: string }>) => {
    pushHistory()
    // Update local nodes immediately
    setNodes((nds) => nds.map((node) => 
      node.id === nodeId ? { ...node, data: { ...node.data, ...updates } } : node
    ))

    // Broadcast the update to other users via Supabase
    if (boardId && user?.id) {
      try {
        const { error } = await (supabase.from('board_updates') as any)
          .insert({
            board_id: boardId,
            node_id: nodeId,
            update_type: 'content',
            data: updates,
            user_id: user.id
          } as any)
        
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
    if (readOnly) return
    pushHistory()
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId))
    try { channelRef.current?.send({ type: 'broadcast', event: 'edge:remove', payload: { edgeId, userId: user?.id || null, ts: Date.now() } }) } catch {}
  }, [setEdges, pushHistory, boardId, user?.id, readOnly])

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
      readOnly,
      onStartStoryMode: (nodeId: string) => {
        // Start from the beginning when launched from the Story Starter Node button
        try { window.dispatchEvent(new CustomEvent('nodal:start-story', { detail: { id: nodeId, startAtBeginning: true } })) } catch {}
      },
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
    readOnly,
    // startStoryMode will be defined below; include via dependency to avoid stale closure
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
  const isEditingRef = useRef<boolean>(false)
  useEffect(() => { isEditingRef.current = editorMode }, [editorMode])
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
                  const opts = json.members.map((m: any) => ({ value: String(m.user_id), label: String(m.username || m.email || m.user_id) }))
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
    // Guard against programmatic viewport/selection adjustments causing feedback loops
    if (recenterGuardRef.current) return
    if (storyActive) {
      // In story mode, nodes shouldn't move; ignore node changes
      return
    }
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
  }, [onNodesChange, boardId, user?.id, storyActive])
  
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
    const saveNow = async (e: Event) => {
      if (!localBoardIdRef.current) return
      try {
        const edgeType = useBoardStore.getState().edgeType
        const colorgories = useBoardStore.getState().colorgories || []
        const viewport = reactFlowInstance.getViewport()
        await boardStorage.updateBoard(localBoardIdRef.current, { nodes, edges, viewport, colorgories, meta: ({ edgeType } as any) })
      } catch {}
    }
    window.addEventListener('nodal:save-now', saveNow as EventListener)
    return () => {
      window.removeEventListener('nodal:chat-updated', handler as EventListener)
      window.removeEventListener('nodal:undo', onUndo as EventListener)
      window.removeEventListener('nodal:redo', onRedo as EventListener)
      window.removeEventListener('nodal:save-now', saveNow as EventListener)
    }
  }, [saveStatus, currentBoardName, nodes, edges, manualSave, undo, redo])

  // Global Undo/Redo hotkeys: Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod) return
      const key = (e.key || '').toLowerCase()
      if (key !== 'z') return
      // Ignore when typing in inputs/contenteditable
      const active = document.activeElement as HTMLElement | null
      if (active) {
        const tag = active.tagName
        if (active.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      }
      e.preventDefault()
      e.stopPropagation()
      if (e.shiftKey) {
        redo()
      } else {
        undo()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [undo, redo])

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

  // Story settings global events
  useEffect(() => {
    const onStoryUpdate = (ev: any) => {
      try {
        const nodeId: string = ev?.detail?.id
        const title: string = ev?.detail?.title
        if (!nodeId) return
        pushHistory()
        setNodes((nds) => {
          const list = Array.isArray(nds) ? nds : []
          return list.map((n: any) => {
            if (n.id !== nodeId) return n
            const d: any = n.data || {}
            if (!d.storyStarter) return n
            return { ...n, data: { ...d, storyTitle: String(title || '').trim() || (d.storyTitle || d.title || d.label || 'Story') } }
          })
        })
      } catch {}
    }
    const onStoryDelete = (ev: any) => {
      try {
        const nodeId: string = ev?.detail?.id
        if (!nodeId) return
        pushHistory()
        setNodes((nds) => {
          const list = Array.isArray(nds) ? nds : []
          return list.map((n: any) => {
            if (n.id !== nodeId) return n
            const d: any = n.data || {}
            const next = { ...d }
            delete (next as any).storyStarter
            delete (next as any).storyTitle
            return { ...n, data: next }
          })
        })
      } catch {}
    }
    window.addEventListener('nodal:story-update', onStoryUpdate as EventListener)
    window.addEventListener('nodal:story-delete', onStoryDelete as EventListener)
    return () => {
      window.removeEventListener('nodal:story-update', onStoryUpdate as EventListener)
      window.removeEventListener('nodal:story-delete', onStoryDelete as EventListener)
    }
  }, [pushHistory, setNodes])

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
      {/* Bokeh moved inside ReactFlow for guaranteed visibility */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        snapToGrid={gridEnabled}
        snapGrid={SNAP_GRID}
        nodesDraggable={!readOnly && !storyActive}
        nodesConnectable={!readOnly && !storyActive}
        onNodesChange={(readOnly || storyActive) ? undefined : handleNodesChange}
        onEdgesChange={(readOnly || storyActive) ? undefined : onEdgesChange}
        onConnect={(readOnly || storyActive) ? undefined : onConnect}
        elementsSelectable={!storyActive}
        panOnDrag={!storyActive}
        // Use mouse wheel for zooming instead of vertical panning
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        onNodeDoubleClick={(event: React.MouseEvent, node: any) => {
          // Disable double-click editing while in Story Mode or when the edit modal is already open.
          if (storyActive || editorMode) {
            try { event.preventDefault(); event.stopPropagation() } catch {}
            return
          }
          try { event.preventDefault(); event.stopPropagation() } catch {}
          if (readOnly) return
          try { window.dispatchEvent(new CustomEvent('nodal:edit-node', { detail: { id: node?.id } })) } catch {}
        }}
        onNodeClick={(event: React.MouseEvent, node: any) => {
          if (storyActive) { return }
          if (readOnly) return
          const id = node?.id as string | undefined
          if (!id) return

          // Shift+click: connect from the single selected node to this node.
          if (event.shiftKey) {
            try {
              handleShiftClickConnect(id)
            } catch {}
            try {
              event.preventDefault()
              event.stopPropagation()
            } catch {}
            return
          }

          // Cmd/Ctrl+click: toggle selection; plain click: single-select.
          const store = useBoardStore.getState() as any
          const current: string[] = Array.isArray(store.selectedNodeIds) ? store.selectedNodeIds : []
          let next: string[]
          const isToggle = event.metaKey || event.ctrlKey

          if (isToggle) {
            const already = current.includes(id)
            next = already ? current.filter((x) => x !== id) : [...current, id]
          } else {
            next = [id]
          }

          try {
            store.setSelectedNodes(next)
          } catch {}

          // Sync XYFlow visual selection
          try {
            reactFlowInstance.setNodes((cur) => cur.map((n) => ({
              ...n,
              selected: next.includes(n.id),
            })))
          } catch {}

          try {
            event.preventDefault()
            event.stopPropagation()
          } catch {}
        }}
          onNodeContextMenu={(event: React.MouseEvent, node: any) => {
            if (editorMode || storyActive) { event.preventDefault(); return }
            event.preventDefault()
            event.stopPropagation()
            if (readOnly) return
            // Preserve multi-selection when right-clicking within the current selection.
            try {
              const id = node?.id
              if (id) {
                const store = useBoardStore.getState() as any
                const current: string[] = Array.isArray(store.selectedNodeIds) ? store.selectedNodeIds : []
                const keepSelection = current.length > 1 && current.includes(id)
                const next = keepSelection ? current : [id]
                store.setSelectedNodes(next)
                try {
                  reactFlowInstance.setNodes((cur) => cur.map((n) => ({ ...n, selected: next.includes(n.id) })))
                } catch {}
              }
            } catch {}
            setPendingSourceNodeId(node?.id || null)
            setContextMenu({
              isOpen: true,
              position: { x: event.clientX, y: event.clientY }
            })
          }}
        onConnectStart={readOnly ? undefined : onConnectStart}
        onConnectEnd={readOnly ? undefined : onConnectEnd}
        onSelectionChange={handleSelectionChange}
        onMoveEnd={() => {
          // Only auto-recenter after user zoom/pan when NOT in story mode
          if (storyActive) return
          if (recenterGuardRef.current) return
          recenterCurrentStoryNodeAtZoom()
        }}
        onPaneClick={(event) => {
          if (storyActive) { return }
          // If we're awaiting a placement click (triggered by FAB), capture this click and open the modal
          if (awaitingNodePlacement) {
            if (readOnly) { setAwaitingNodePlacement(false); return }
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
          if (editorMode || storyActive) { event.preventDefault(); return }
          if (readOnly) { event.preventDefault(); return }
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
        className={`${theme === 'dark' ? 'dark !bg-transparent' : '!bg-transparent'}`}
        style={{ background: 'transparent' }} // Make ReactFlow background transparent
        multiSelectionKeyCode="Meta"
        // Disable built-in Delete behavior; we show a confirm modal instead
      >
        {/* Grid overlay (when enabled) */}
        {gridEnabled && (
          <Background
            gap={SNAP_GRID[0]}
            color={theme === 'dark' ? 'rgba(148,163,184,0.3)' : 'rgba(148,163,184,0.6)'}
          />
        )}
        <div className="hidden sm:block">
          <Controls showInteractive={false} showFitView={true} showZoom={true} />
        </div>
        {/* Bokeh background behind nodes (z-0), always visible */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <BokehBackground />
        </div>
        {/* Story tint inside ReactFlow so it appears above pane but below nodes */}
        {storyActive && (
          <div className={`pointer-events-none absolute inset-0 z-[1] ${theme === 'dark' ? 'bg-black/90' : 'bg-primary-400/50'}`} />
        )}
        {/* Place MiniMap bottom-left next to Controls */}
        <MiniMap
          className="hidden sm:block !bg-white/80 dark:!bg-gray-900/70 !rounded-md !shadow-lg"
          style={{ position: 'absolute', left: 30, bottom: 0, right: 'auto', top: 'auto', width: 160, height: 104 }}
        />
        
        {/* (cursor presence paused) */}
        
        {/** Removed FAB and ChatPanel from inside ReactFlow to avoid stacking context issues */}
        {/* Manual shift-drag preview line */}
        {manualConnectPreview && (
          <div className="pointer-events-none absolute inset-0 z-[10]">
            <svg className="w-full h-full" viewBox={`0 0 ${reactFlowWrapper.current?.clientWidth || 0} ${reactFlowWrapper.current?.clientHeight || 0}`}
              preserveAspectRatio="none">
              {/* Glow/halo */}
              <line x1={manualConnectPreview.source.x} y1={manualConnectPreview.source.y}
                    x2={manualConnectPreview.pointer.x} y2={manualConnectPreview.pointer.y}
                    stroke="var(--edge-default-color)" strokeWidth="8" strokeOpacity="0.18" strokeLinecap="round" strokeLinejoin="round"
                    style={{ filter: 'drop-shadow(0 0 8px var(--edge-default-glow))' }} />
              {/* Main line (always default edge color); no arrow; marker switches to primary ring when connectable */}
              <line x1={manualConnectPreview.source.x} y1={manualConnectPreview.source.y}
                    x2={manualConnectPreview.pointer.x} y2={manualConnectPreview.pointer.y}
                    stroke="var(--edge-default-color)"
                    strokeWidth="3" strokeOpacity="1" strokeLinecap="round" strokeLinejoin="round"
                    markerEnd={manualConnectPreview.overTarget ? 'url(#edge-circle-blue)' : undefined} />
            </svg>
          </div>
        )}
      </ReactFlow>
      
      {isBoardView && (
        <LeftDock
          active={leftDockActive}
          onToggle={(key) => setLeftDockActive(prev => (prev === key ? null : key))}
          disabled={readOnly}
        />
      )}
      {/* Story Mode HUD */}
      {storyActive && (
        <>
          {isOnChoice && (
            <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-95">
              <div className="px-4 py-3 rounded-xl bg-white/95 dark:bg-gray-900/95 shadow-lg border border-gray-200 dark:border-gray-700 min-w-[280px]">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-100">Choose one of the following:</div>
                <div className="mt-2 space-y-2">
                  {choiceOptions.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer">
                      <input
                        type="radio"
                        name="story-choice"
                        value={opt.id}
                        onChange={() => handleChooseBranch(opt.id)}
                        className="accent-primary-500"
                      />
                      <span className="truncate max-w-[360px]">{opt.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="fixed left-1/2 -translate-x-1/2 bottom-6 z-90">
            <div className="px-3 py-2 rounded-full bg-white/90 dark:bg-gray-900/90 shadow-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2">
              <IconButton
                className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                onClick={prevStory}
                disabled={storyIndex <= 0}
                aria-label="Previous"
              >
                <ArrowLeft size={24} weight="duotone" />
              </IconButton>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-700 dark:text-gray-200">Step {storyIndex + 1}</span>
                <div className="w-28">
                  <Range
                    value={storyPath.length > 0 ? (storyIndex + 1) / storyPath.length : 0}
                    onChange={() => {}}
                    min={0}
                    max={1}
                    step={0.01}
                    size="sm"
                    aria-label="Story progress"
                  />
                </div>
              </div>
              <IconButton
                className="px-2 py-1 text-sm rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700"
                onClick={nextStory}
                disabled={isOnChoice}
                aria-label="Next"
              >
                <ArrowRight size={24} weight="duotone" />
              </IconButton>
              <div className="mx-2 h-4 w-px bg-gray-300 dark:bg-gray-700" />
              <Button
                className="px-2 py-1 text-sm rounded bg-red-500 text-white hover:bg-red-600"
                onClick={() => exitStoryMode(false)}
                aria-label="Exit story mode"
              >
                Close
              </Button>
            </div>
          </div>
        </>
      )}
      {isBoardView && !editorMode && !readOnly && (
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
        onStartStory={(nodeId: string) => {
          try {
            pushHistory()
            setNodes((nds) => {
              const list = Array.isArray(nds) ? nds : []
              return list.map((n: any) => {
                if (n.id !== nodeId) return n
                const d: any = n.data || {}
                const title = String(d.title || d.label || 'Story')
                return { ...n, data: { ...d, storyStarter: true, storyTitle: d.storyTitle || title } }
              })
            })
            setToastVariant('success')
            setToastMessage('Story created from this node')
            setToastOpen(true)
          } catch {}
        }}
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
          // Open edit modal and align view to the right of the node (like Task)
          setTimeout(() => {
            try {
              setEditNodeId(newId)
              centerOnNodeIds([newId], { align: 'midLeft' })
            } catch {}
          }, 0)
          // If we were adding as a child of a pending source node, connect them
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
        onGenerateAINode={() => {
          handleOpenAINodeGenerator()
          setContextMenu({ isOpen: false, position: null })
        }}
        onQuickAIGenerateNodes={async (nodeId?: string | null) => {
          const run = async (withMedia: boolean) => {
            try {
              setQuickAiGenerating?.(true)
              const store = useBoardStore.getState()
              const nodesList = store.nodes || []
              const edgesList = store.edges || []
              const topic = store.topic || pendingBoardBrief?.boardTopic || ''
              const selectedId = nodeId || (store.selectedNodeIds?.[0] ?? null)
              const selectedNode = nodesList.find(n => n.id === selectedId)
              const parentId = selectedNode ? selectedNode.id : undefined
              const contextTitle = selectedNode?.data?.title || ''
              const contextContent = (selectedNode?.data?.content || '') as string

              const supa = getSupabaseClient()
              const { data } = await supa.auth.getSession()
              const token = data?.session?.access_token

              const sanitizeSnippet = (input: any, maxLen: number) => {
                const s = String(input || '')
                  .replace(/https?:\/\/\S+/gi, '')
                  .replace(/\s+/g, ' ')
                  .trim()
                if (!s) return ''
                return s.length > maxLen ? s.slice(0, maxLen).trim() : s
              }

              const getNodeSnippet = (n: any) => {
                try {
                  const t = String(n?.type || '').trim()
                  const d: any = n?.data || {}
                  // Prefer human-written / extracted text, but keep it short.
                  let raw = ''
                  raw = d?.content || ''
                  if (!raw) {
                    // Non-text nodes: include a short mention only (no URLs).
                    if (t === 'link') {
                      try { raw = d?.linkUrl ? `Link (${new URL(String(d.linkUrl)).hostname})` : '' } catch { raw = d?.linkUrl ? 'Link' : '' }
                    } else if (t === 'video') {
                      raw = d?.title ? `Video: ${String(d.title)}` : 'Video'
                    } else if (t === 'image') {
                      raw = d?.title ? `Image: ${String(d.title)}` : (d?.fileName ? `Image: ${String(d.fileName)}` : 'Image')
                    }
                  }
                  return sanitizeSnippet(raw, 300)
                } catch {
                  return ''
                }
              }

              const existingNodesPayload = (nodesList || []).slice(0, 30).map((n: any) => ({
                title: n?.data?.title,
                type: n?.type,
                contentSnippet: getNodeSnippet(n),
              }))

              const plannedResp = await fetch('/api/boards/generate-nodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                  mode: 'quick_generate',
                  topic: topic || contextTitle || '',
                  goal: 'Generate related nodes for the selected node and board topic.',
                  density: 'medium',
                  constraints: {
                    totalMin: 4,
                    totalMax: 16,
                    minText: 5,
                    minMedia: withMedia ? 1 : 0,
                    maxMedia: withMedia ? 4 : 0,
                    maxImages: withMedia ? 4 : 0,
                    maxVideos: withMedia ? 4 : 0,
                  },
                  board: {
                    supportedNodeTypes: withMedia ? ['text', 'image', 'video'] : ['text'],
                    existingNodes: existingNodesPayload,
                  },
                  selected: { title: contextTitle, content: contextContent },
                })
              })
              if (!plannedResp.ok) return
              const plannedJson = await plannedResp.json().catch(() => ({}))
              const planned: any[] = Array.isArray(plannedJson?.nodes) ? plannedJson.nodes : []
              const textItems = planned.filter((n: any) => n?.type === 'text')
              const mediaItems = planned.filter((n: any) => n?.type === 'image' || n?.type === 'video')
              if (!textItems.length && !mediaItems.length) return

              const nodesToPlace = [
                ...textItems.map((it: any) => ({
                  title: String(it?.title || '').trim() || 'Untitled',
                  content: String(it?.content || ''),
                  type: 'default' as const,
                  ...(parentId ? { parentId } : {})
                })),
                ...(withMedia ? mediaItems.map((it: any) => {
                  const t = String(it?.type || '').toLowerCase()
                  if (t === 'image') {
                    return {
                      title: String(it?.title || 'Image'),
                      content: String(it?.content || ''),
                      type: 'image' as const,
                      ...(parentId ? { parentId } : {}),
                      data: { previewUrl: String(it?.imageUrl || ''), type: 'image', status: 'ready', titleSize: 'sm' } as any
                    }
                  }
                  return {
                    title: String(it?.title || 'Video'),
                    content: String(it?.content || ''),
                    type: 'video' as const,
                    ...(parentId ? { parentId } : {}),
                    data: { videoUrl: String(it?.videoUrl || ''), status: 'idle', titleSize: 'sm' } as any
                  }
                }) : [])
              ]

              const result = await placeAINodes(nodesToPlace as any, parentId, { preferredDirection: 'down', minDistance: 40, avoidOverlap: true, preserveExistingLayout: true })
              if (result.success && result.placements.length > 0) {
                const newNodes: Node[] = result.placements.map(p => ({ id: p.node.id, type: p.node.type as any, position: p.position, data: { ...p.node.data } }))
                setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
                if (result.connections.length > 0) {
                  const newEdges: Edge[] = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || (toVisualEdgeType(edgeTypePref) as any) }))
                  setEdges((eds) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
                }
                showAddToast('added', newNodes.length)
                centerOnNodeIds(newNodes.map(n => n.id))
              }
            } catch {}
            finally { try { setQuickAiGenerating?.(false) } catch {} }
          }
          await run(false)
        }}
        onQuickAIGenerateNodesWithMedia={async (nodeId?: string | null) => {
          const run = async () => {
            // Same as above, but withMedia=true
            try {
              setQuickAiGenerating?.(true)
              const store = useBoardStore.getState()
              const nodesList = store.nodes || []
              const edgesList = store.edges || []
              const topic = store.topic || pendingBoardBrief?.boardTopic || ''
              const selectedId = nodeId || (store.selectedNodeIds?.[0] ?? null)
              const selectedNode = nodesList.find(n => n.id === selectedId)
              const parentId = selectedNode ? selectedNode.id : undefined
              const contextTitle = selectedNode?.data?.title || ''
              const contextContent = (selectedNode?.data?.content || '') as string

              const supa = getSupabaseClient()
              const { data } = await supa.auth.getSession()
              const token = data?.session?.access_token

              const sanitizeSnippet = (input: any, maxLen: number) => {
                const s = String(input || '')
                  .replace(/https?:\/\/\S+/gi, '')
                  .replace(/\s+/g, ' ')
                  .trim()
                if (!s) return ''
                return s.length > maxLen ? s.slice(0, maxLen).trim() : s
              }

              const getNodeSnippet = (n: any) => {
                try {
                  const t = String(n?.type || '').trim()
                  const d: any = n?.data || {}
                  let raw = ''
                  raw = d?.content || ''
                  if (!raw) {
                    if (t === 'link') {
                      try { raw = d?.linkUrl ? `Link (${new URL(String(d.linkUrl)).hostname})` : '' } catch { raw = d?.linkUrl ? 'Link' : '' }
                    } else if (t === 'video') {
                      raw = d?.title ? `Video: ${String(d.title)}` : 'Video'
                    } else if (t === 'image') {
                      raw = d?.title ? `Image: ${String(d.title)}` : (d?.fileName ? `Image: ${String(d.fileName)}` : 'Image')
                    }
                  }
                  return sanitizeSnippet(raw, 300)
                } catch {
                  return ''
                }
              }

              const existingNodesPayload = (nodesList || []).slice(0, 30).map((n: any) => ({
                title: n?.data?.title,
                type: n?.type,
                contentSnippet: getNodeSnippet(n),
              }))

              const plannedResp = await fetch('/api/boards/generate-nodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                body: JSON.stringify({
                  mode: 'quick_generate',
                  topic: topic || contextTitle || '',
                  goal: 'Generate related nodes for the selected node and board topic.',
                  density: 'medium',
                  constraints: {
                    totalMin: 4,
                    totalMax: 16,
                    minText: 5,
                    minMedia: 1,
                    maxMedia: 4,
                    maxImages: 4,
                    maxVideos: 4,
                  },
                  board: {
                    supportedNodeTypes: ['text', 'image', 'video'],
                    existingNodes: existingNodesPayload,
                  },
                  selected: { title: contextTitle, content: contextContent },
                })
              })
              if (!plannedResp.ok) return
              const plannedJson = await plannedResp.json().catch(() => ({}))
              const planned: any[] = Array.isArray(plannedJson?.nodes) ? plannedJson.nodes : []
              const textItems = planned.filter((n: any) => n?.type === 'text')
              const mediaItems = planned.filter((n: any) => n?.type === 'image' || n?.type === 'video')
              if (!textItems.length && !mediaItems.length) return

              const nodesToPlace = [
                ...textItems.map((it: any) => ({
                  title: String(it?.title || '').trim() || 'Untitled',
                  content: String(it?.content || ''),
                  type: 'default' as const,
                  ...(parentId ? { parentId } : {})
                })),
                ...mediaItems.map((it: any) => {
                  const t = String(it?.type || '').toLowerCase()
                  if (t === 'image') {
                    return {
                      title: String(it?.title || 'Image'),
                      content: String(it?.content || ''),
                      type: 'image' as const,
                      ...(parentId ? { parentId } : {}),
                      data: { previewUrl: String(it?.imageUrl || ''), type: 'image', status: 'ready', titleSize: 'sm' } as any
                    }
                  }
                  return {
                    title: String(it?.title || 'Video'),
                    content: String(it?.content || ''),
                    type: 'video' as const,
                    ...(parentId ? { parentId } : {}),
                    data: { videoUrl: String(it?.videoUrl || ''), status: 'idle', titleSize: 'sm' } as any
                  }
                })
              ]

              const result = await placeAINodes(nodesToPlace as any, parentId, { preferredDirection: 'down', minDistance: 40, avoidOverlap: true, preserveExistingLayout: true })
              if (result.success && result.placements.length > 0) {
                const newNodes: Node[] = result.placements.map(p => ({ id: p.node.id, type: p.node.type as any, position: p.position, data: { ...p.node.data } }))
                setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
                if (result.connections.length > 0) {
                  const newEdges: Edge[] = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || (toVisualEdgeType(edgeTypePref) as any) }))
                  setEdges((eds) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
                }
                showAddToast('added', newNodes.length)
                centerOnNodeIds(newNodes.map(n => n.id))
              }
            } catch {}
            finally { try { setQuickAiGenerating?.(false) } catch {} }
          }
          await run()
        }}
        onOrganizeSubtree={async (nodeId: string) => {
          try {
            // Capture history before layout mutation
            pushHistory()
            await reorganizeSubtree(nodeId)
            // Persist immediately after reorg completes
            try {
              const st = useBoardStore.getState()
              await manualSave(st.nodes || [], pruneGhostEdges(st.nodes || [], st.edges || []))
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
                // Capture history before deleting selection
                pushHistory()
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
              initialTitleSize={(d.titleSize as any) || 'sm'}
              onLocate={() => { if (editNodeId) centerOnNodeIds([editNodeId], { align: 'midLeft' }) }}
              onSave={(title, content, colorgoryIds, titleSize) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? {
                  ...nn,
                  data: { ...(nn.data as any), title, description: content, colorgoryIds, titleSize }
                } : nn) : nds))
                centerOnNodeIds([editNodeId!])
              }}
              onLiveChange={(title, content, colorgoryIds, titleSize) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? {
                  ...nn,
                  data: { ...(nn.data as any), title, description: content, colorgoryIds, titleSize }
                } : nn) : nds))
                if (editNodeId) sendLivePatch(editNodeId, { title, description: content, colorgoryIds, titleSize })
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
              initialTitleSize={(d.titleSize as any) || 'sm'}
              onLocate={() => { if (editNodeId) centerOnNodeIds([editNodeId], { align: 'midLeft' }) }}
              onSave={(title, content, colorgoryIds, titleSize) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? {
                  ...nn,
                  data: { ...(nn.data as any), title, content, colorgoryIds, titleSize }
                } : nn) : nds))
                centerOnNodeIds([editNodeId!])
              }}
              onLiveChange={(title, content, colorgoryIds, titleSize) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? {
                  ...nn,
                  data: { ...(nn.data as any), title, content, colorgoryIds, titleSize }
                } : nn) : nds))
                if (editNodeId) sendLivePatch(editNodeId, { title, content, colorgoryIds, titleSize })
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
                const safeTitle = (title || '').trim() || 'Untitled Task'
                const nextContent = content || ''
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn =>
                  nn.id === editNodeId
                    ? { ...nn, data: { ...(nn.data as any), title: safeTitle, content: nextContent, assigneeId: assignee || null } }
                    : nn
                ) : nds))
                // Persist assignment to DB (board_updates row; durable storage handled by autosave elsewhere)
                try {
                  const bid = useBoardStore.getState().currentBoardId
                  if (bid) {
                    await fetch('/api/board/updates', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        boardId: bid,
                        nodeId: editNodeId,
                        updateType: 'content',
                        data: { title: safeTitle, content: nextContent, assigneeId: assignee || null },
                      }),
                    })
                  }
                } catch {}
                centerOnNodeIds([editNodeId!])
              }}
              onLiveChange={(title, content) => {
                const nextContent = content || ''
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn =>
                  nn.id === editNodeId
                    ? { ...nn, data: { ...(nn.data as any), title, content: nextContent, assigneeId: assignee || null } }
                    : nn
                ) : nds))
                if (editNodeId) {
                  sendLivePatch(editNodeId, { title, content: nextContent, assigneeId: assignee || null })
                }
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
              initialTitleSize={(d.titleSize as any) || 'sm'}
              onLocate={() => { if (editNodeId) centerOnNodeIds([editNodeId], { align: 'midLeft' }) }}
              onSave={(title, content, colorgoryIds, titleSize) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? {
                  ...nn,
                  data: { ...(nn.data as any), title, content, colorgoryIds, titleSize }
                } : nn) : nds))
                centerOnNodeIds([editNodeId!])
              }}
              onLiveChange={(title, content, colorgoryIds, titleSize) => {
                setNodes((nds) => (Array.isArray(nds) ? nds.map(nn => nn.id === editNodeId ? {
                  ...nn,
                  data: { ...(nn.data as any), title, content, colorgoryIds, titleSize }
                } : nn) : nds))
                if (editNodeId) sendLivePatch(editNodeId, { title, content, colorgoryIds, titleSize })
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
          {isBoardView && !editorMode && !readOnly && (
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
            ;(async () => {
              const center = getViewportCenter()
              pushHistory()
              const newId = `task-${Date.now()}`
              try {
                const res = await placeManualNode(
                  { id: newId, title: '', content: '', type: 'task', preferredPosition: center, data: { title: '', content: '', completed: false, focusOnMount: true, aiGenerated: false } } as any,
                  center,
                  { minDistance: 40, avoidOverlap: true, preserveExistingLayout: true },
                  (useBoardStore.getState().nodes || []) as any
                )
                const placed = res.placements?.[0]
                const node: Node = placed
                  ? ({ id: placed.node.id, type: placed.node.type as any, position: placed.position, data: { ...placed.node.data } } as any)
                  : ({ id: newId, type: 'task', position: center, data: { title: '', content: '', completed: false, focusOnMount: true, aiGenerated: false } } as any)
                setNodes((nds) => (Array.isArray(nds) ? [...nds, node] : [node]))
                showAddToast('added', 1)
                setTimeout(() => { try { setEditNodeId(node.id); centerOnNodeIds([node.id], { align: 'midLeft' }) } catch {} }, 0)
              } catch {}
            })()
          }}
          onAddHeadline={() => {
            ;(async () => {
              const center = getViewportCenter()
              pushHistory()
              const newId = `headline-${Date.now()}`
              try {
                const res = await placeManualNode(
                  { id: newId, title: 'New headline', content: '', type: 'headline', preferredPosition: center, data: { title: 'New headline', titleSize: 'sm', aiGenerated: false } } as any,
                  center,
                  { minDistance: 40, avoidOverlap: true, preserveExistingLayout: true },
                  (useBoardStore.getState().nodes || []) as any
                )
                const placed = res.placements?.[0]
                const node: Node = placed
                  ? ({ id: placed.node.id, type: placed.node.type as any, position: placed.position, data: { ...placed.node.data } } as any)
                  : ({ id: newId, type: 'headline', position: center, data: { title: 'New headline', titleSize: 'sm', aiGenerated: false } as any } as any)
                setNodes((nds) => (Array.isArray(nds) ? [...nds, node] : [node]))
                showAddToast('added', 1)
                setTimeout(() => { try { setEditNodeId(node.id); centerOnNodeIds([node.id], { align: 'midLeft' }) } catch {} }, 0)
              } catch {}
            })()
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

      {showUnifiedAddModal && !readOnly && (
        <AddNodesModal
          open={showUnifiedAddModal}
          onClose={() => setShowUnifiedAddModal(false)}
          parentNodeId={aiParentNodeId || pendingSourceNodeId || undefined}
          parentNodeTitle={(aiParentNodeId || pendingSourceNodeId) ? (nodes.find(n => n.id === (aiParentNodeId || pendingSourceNodeId))?.data as any)?.title : undefined}
          parentNodeContent={(aiParentNodeId || pendingSourceNodeId) ? (() => {
            const n = nodes.find(n => n.id === (aiParentNodeId || pendingSourceNodeId))
            const d: any = n?.data || {}
            return (d.content || '') as string
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
                  const titleForAI = titles[0]
                  const topicForAI = (pendingBoardBrief?.boardTopic || useBoardStore.getState().topic || '').trim()
                  const supa = getSupabaseClient()
                  const { data } = await supa.auth.getSession()
                  const token = data?.session?.access_token
                  const res = await fetch('/api/boards/generate-starters', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      ...(token ? { Authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ type: 'describe', topic: topicForAI || undefined, titles: [titleForAI] })
                  })
                  if (res.ok) {
                    const j = await res.json()
                    const d = String((j?.descriptions?.[0] || '')).trim()
                    if (d) desc = d
                  }
                } catch {}
              }
              if (desc) {
                descriptionsByTitle[titles[0]] = desc
              }
            } else if (generateDescription) {
              try {
                const topicForAI = (pendingBoardBrief?.boardTopic || useBoardStore.getState().topic || '').trim()
                const supa = getSupabaseClient()
                const { data } = await supa.auth.getSession()
                const token = data?.session?.access_token
                const res = await fetch('/api/boards/generate-starters', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {})
                  },
                  body: JSON.stringify({ type: 'describe', topic: topicForAI || undefined, titles })
                })
                if (res.ok) {
                  const j = await res.json()
                  const arr: string[] = Array.isArray(j?.descriptions) ? j.descriptions : []
                  titles.forEach((t, idx) => {
                    const d = String(arr[idx] || '').trim()
                    if (d) descriptionsByTitle[t] = d
                  })
                }
              } catch {}
            }
            if (pendingSourceNodeId) {
              const nodesToPlace = titles.map((t) => ({ title: t, content: descriptionsByTitle[t] || '', type: 'default' as const, parentId: pendingSourceNodeId }))
              try {
                pushHistory()
                const result = await placeAINodes(nodesToPlace as any, pendingSourceNodeId, { preferredDirection: 'down', minDistance: 40, avoidOverlap: true, preserveExistingLayout: true })
                if (!result.success || result.placements.length === 0) return
                const newNodes: Node[] = result.placements.map(p => ({ id: p.node.id, type: p.node.type as any, position: p.position, data: { ...p.node.data } }))
                setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
                if (result.connections.length > 0) {
                  const newEdges: Edge[] = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || (toVisualEdgeType(edgeTypePref) as any) }))
                  setEdges((eds) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
                }
                showAddToast('added', newNodes.length)
                centerOnNodeIds(newNodes.map(n => n.id))
              } catch {}
            } else if (titles.length === 1) {
              const target = pendingNodePosition || center
              pushHistory()
              try {
                const newId = `node-${Date.now()}`
                const res = await placeManualNode(
                  { id: newId, title: titles[0], content: desc, type: 'default', preferredPosition: target, data: { aiGenerated: false } } as any,
                  target,
                  { minDistance: 40, avoidOverlap: true, preserveExistingLayout: true },
                  (useBoardStore.getState().nodes || []) as any
                )
                const placed = res.placements?.[0]
                const node: Node = placed
                  ? ({ id: placed.node.id, type: placed.node.type as any, position: placed.position, data: { ...placed.node.data } } as any)
                  : ({ id: newId, type: 'default', position: target, data: { title: titles[0], content: desc, aiGenerated: false } } as any)
                setNodes((nds) => (Array.isArray(nds) ? [...nds, node] : [node]))
                showAddToast('added', 1)
                centerOnNodeIds([node.id])
              } catch {}
            } else {
              pushHistory()
              try {
                const nodesToPlace = titles.map(t => ({ title: t, content: descriptionsByTitle[t] || '', type: 'default' as const, data: { aiGenerated: false } as any }))
                const placementResult = await placeBoardNodes(nodesToPlace as any, { minDistance: 40, avoidOverlap: true, preserveExistingLayout: true })
                if (!placementResult.success || placementResult.placements.length === 0) return
                const newNodes: Node[] = placementResult.placements.map(p => ({ id: p.node.id, type: p.node.type as any, position: p.position, data: { ...p.node.data } }))
                setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
                showAddToast('added', newNodes.length)
                centerOnNodeIds(newNodes.map(n => n.id))
              } catch {}
            }
            setShowUnifiedAddModal(false)
          }}
          onAIConfirm={async (items) => {
            try {
              pushHistory()
              const nodesToPlace = items.map(p => ({ title: p.title, content: p.content || '', parentId: aiParentNodeId || pendingSourceNodeId }))
              const result = await placeAINodes(nodesToPlace as any, aiParentNodeId || pendingSourceNodeId || undefined, { preferredDirection: 'down', minDistance: 40, avoidOverlap: true, preserveExistingLayout: true })
              if (result.success && result.placements.length > 0) {
                const newNodes: Node[] = result.placements.map(p => ({ id: p.node.id, type: p.node.type as any, position: p.position, data: { ...p.node.data } }))
                setNodes((nds) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))
                if (result.connections.length > 0) {
                  const newEdges: Edge[] = result.connections.map(c => ({ id: c.edge.id, source: c.edge.source, target: c.edge.target, type: c.edge.type || 'floating' }))
                  setEdges((eds) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
                }
                showAddToast('generated', newNodes.length)
                centerOnNodeIds(newNodes.map(n => n.id))
              } else {
                try { window.dispatchEvent(new CustomEvent('nodal:toast', { detail: { message: 'No nodes were placed. Please try again.', variant: 'warning' } })) } catch {}
              }
            } catch {
              try { window.dispatchEvent(new CustomEvent('nodal:toast', { detail: { message: 'Failed to generate nodes. Please try again.', variant: 'warning' } })) } catch {}
            }
            setShowUnifiedAddModal(false)
          }}
          onVideoSubmit={(url) => {
            ;(async () => {
              const center = pendingNodePosition || getViewportCenter()
              pushHistory()
              const newId = `video-${Date.now()}`
              try {
                const res = await placeManualNode(
                  { id: newId, title: 'Video', content: '', type: 'video', preferredPosition: center, data: { videoUrl: url, status: 'idle', aiGenerated: false } } as any,
                  center,
                  { minDistance: 40, avoidOverlap: true, preserveExistingLayout: true },
                  (useBoardStore.getState().nodes || []) as any
                )
                const placed = res.placements?.[0]
                const node: Node = placed
                  ? ({ id: placed.node.id, type: placed.node.type as any, position: placed.position, data: { ...placed.node.data } } as any)
                  : ({ id: newId, type: 'video', position: center, data: { title: 'Video', videoUrl: url, status: 'idle', aiGenerated: false } } as any)
                setNodes((nds) => (Array.isArray(nds) ? [...nds, node] : [node]))
                setShowUnifiedAddModal(false)
                showAddToast('added', 1)
                centerOnNodeIds([node.id])
              } catch {}
            })()
          }}
          onLinkSubmit={(url) => {
            ;(async () => {
              const center = pendingNodePosition || getViewportCenter()
              pushHistory()
              const newId = `link-${Date.now()}`
              try {
                const res = await placeManualNode(
                  { id: newId, title: 'Link', content: '', type: 'link', preferredPosition: center, data: { linkUrl: url, status: 'idle', aiGenerated: false } } as any,
                  center,
                  { minDistance: 40, avoidOverlap: true, preserveExistingLayout: true },
                  (useBoardStore.getState().nodes || []) as any
                )
                const placed = res.placements?.[0]
                const node: Node = placed
                  ? ({ id: placed.node.id, type: placed.node.type as any, position: placed.position, data: { ...placed.node.data } } as any)
                  : ({ id: newId, type: 'link', position: center, data: { title: 'Link', linkUrl: url, status: 'idle', aiGenerated: false } } as any)
                setNodes((nds) => (Array.isArray(nds) ? [...nds, node] : [node]))
                setShowUnifiedAddModal(false)
                showAddToast('added', 1)
                centerOnNodeIds([node.id])
              } catch {}
            })()
          }}
          onUploadSubmit={async (file) => {
            const center = pendingNodePosition || getViewportCenter()
            const ok = await handleDocumentUpload(file as File, center)
            setShowUnifiedAddModal(false)
            if (ok) showAddToast('added', 1)
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
      {(quickAiGenerating || creatingBoard || summarizingSelection) && (
        <div className="fixed inset-0 z-[900] flex items-center justify-center pointer-events-none">
          <div className="px-3 py-2 rounded-full bg-white/90 dark:bg-gray-900/90 shadow-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
          <SpinnerGap className="animate-spin" size={16} />
          <span>{creatingBoard ? 'Creating board…' : (summarizingSelection ? 'Summarizing selection…' : 'Generating nodes…')}</span>
          </div>
        </div>
      )}
      <Toast open={toastOpen} onClose={() => setToastOpen(false)} variant={toastVariant} position="top-center">
        <div className="flex flex-col">
          <div className="leading-tight">{toastMessage}</div>
          {toastSubMessage && (
            <div className="mt-0.5 text-[11px] opacity-90 leading-tight">{toastSubMessage}</div>
          )}
        </div>
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
