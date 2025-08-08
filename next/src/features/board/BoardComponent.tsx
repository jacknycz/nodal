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
import { boardStorage } from '../storage/storage'
import DocumentNode from '../nodes/DocumentNode'
import NodalNode from '../nodes/nodalNode'
import { useBoardStore } from './boardSlice'
import FloatingEdge from './FloatingEdge'
import CustomConnectionLine from './CustomConnectionLine'
import FloatingActionButton from '../../components/FloatingActionButton'
import AINodeGenerator from '../../components/AINodeGenerator'
import { useAIContext } from '../ai/aiContext'
import { getOpenAIService } from '../ai/aiService'
import BokehBackground from '../../components/BokehBackground'
import ChatPanel from '../../components/ChatPanel'
import { useTheme } from '../../contexts/ThemeContext'
import TopicModal from '../../components/TopicModal'
import type { BoardBrief } from './boardTypes'
import NodeSetupModal from '../../components/NodeSetupModal'
import BoardContextMenu from '../../components/BoardContextMenu'
// import { supabase } from '../auth/supabaseClient'; // Using getSupabaseClient instead
import type { BoardNode } from './boardTypes';
import { supabaseStorage } from '../storage/supabaseStorage'
import { useRouter } from 'next/navigation'
import { useSupabaseUser } from '../auth/authUtils'
import { getSupabaseClient } from '../auth/supabaseClient'
import NodeEditModal from '../../components/NodeEditModal'
import { useFocusStore } from '../focus/focusSlice'

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
  return nodes.map(node => {
    const data = node.data as any;
    if (data.label && !data.title) {
      data.title = data.label;
      delete data.label;
    }
    return { ...node, data };
  });
};

// === XYFlow/React Flow: Stable nodeTypes/edgeTypes ===
// Define at module scope, never re-created
const stableHandlers: any = {};

export const nodeTypes = {
  default: (props: any) => <NodalNode {...props} {...stableHandlers} />,
  document: (props: any) => <DocumentNode {...props} {...stableHandlers} />,
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
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const prevSaveStatus = useRef(saveStatus);
  
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
  const focusMode = useFocusStore((s) => s.mode)
  const focusNeighborhood = useFocusStore((s) => s.focusNeighborhood)
  const focusGroup = useFocusStore((s) => s.focusGroup)
  const clearFocus = useFocusStore((s) => s.clearFocus)
  
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
            // console.error('[Cursor] Upsert error:', error)
          } else {
            // console.log('[Cursor] Upsert success:', data)
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

  // Add screenshot capture function (current Canvas API implementation)
  const captureBoardScreenshot = async (boardId: string) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      canvas.width = 1200;
      canvas.height = 800;

      ctx.fillStyle = theme === 'dark' ? '#1f2937' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000';
      ctx.font = 'bold 24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(currentBoardName || 'Untitled Board', canvas.width / 2, 40);

      ctx.font = '16px system-ui';
      ctx.fillText(`${nodes.length} nodes, ${edges.length} connections`, canvas.width / 2, 70);

      const nodeRadius = 8;
      const spacing = 100;
      const startX = 100;
      const startY = 150;

      nodes.forEach((node, index) => {
        const x = startX + (index % 8) * spacing;
        const y = startY + Math.floor(index / 8) * spacing;

        ctx.fillStyle = theme === 'dark' ? '#3b82f6' : '#2563eb';
        ctx.beginPath();
        ctx.arc(x, y, nodeRadius, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle = theme === 'dark' ? '#ffffff' : '#000000';
        ctx.font = '12px system-ui';
        ctx.textAlign = 'center';
        const label = (node.data?.title || node.data?.label || `Node ${index + 1}`) as string;
        ctx.fillText(label.substring(0, 15), x, y + 25);
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob!);
        }, 'image/jpeg', 0.8);
      });

      // Upload directly to Supabase storage - save at root path to match BoardRoom expectations
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // console.error('User not authenticated for thumbnail upload');
        return;
      }

      const fileName = `thumbnail-${boardId}.jpg`;
      // Save at root path instead of user subfolder to match BoardRoom expectations
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('thumbnails')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        // console.error('Supabase upload error:', uploadError);
        // console.error('Upload details:', {
        //   bucket: 'thumbnails',
        //   path: fileName,
        //   userId: user.id,
        //   boardId: boardId,
        //   fileName: fileName
        // });
        return;
      }

      // console.log('Thumbnail saved successfully to Supabase storage');
    } catch (error) {
      // console.error('Screenshot capture failed:', error);
    }
  };

  useEffect(() => {
    // Only trigger on transition from 'saving' to 'saved'
    if (prevSaveStatus.current === 'saving' && saveStatus === 'saved' && localBoardIdRef.current) {
      // Trigger thumbnail generation
      setThumbnailLoading(true);
      // Dispatch event for BoardRoom
      window.dispatchEvent(new CustomEvent('thumbnail-generation', { detail: localBoardIdRef.current }));
      
      // Capture and save thumbnail
      captureBoardScreenshot(localBoardIdRef.current);
      
      setThumbnailLoading(false);
    }
    prevSaveStatus.current = saveStatus;
  }, [saveStatus]);
  
  // Board utilities
  // Generate starter nodes using AI
  const generateStarterNodes = async (brief: BoardBrief, boardId: string) => {
    // console.log('🚀 generateStarterNodes called with boardId:', boardId, 'for brief:', brief.boardName)
    try {
      const aiService = getOpenAIService()
      if (!aiService) {
        // console.error('AI service not available')
        // Navigate to the board even if AI fails
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
          // Create all nodes at once
          const generatedNodes = nodeDataArray.map((nodeData, index) => {
            const position = { x: 200 + (index * 300), y: 200 + (index * 100) }
            return {
              id: `starter-node-${Date.now()}-${index}`,
              type: 'default',
              position,
              data: { label: nodeData.label, content: nodeData.content },
            }
          })
          
          // Set all nodes at once
          setNodes(generatedNodes)
          // console.log('📝 Set generated nodes in state:', generatedNodes.length)
          
          // Save immediately to database
          const boardData = {
            nodes: generatedNodes,
            edges: [],
            viewport: reactFlowInstance.getViewport(),
          }
          
          // console.log('💾 Saving generated nodes immediately...')
          await boardStorage.updateBoard(boardId, boardData)
          // console.log('✅ Generated nodes saved successfully')
          
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
        const newNode = {
          id: `starter-node-${Date.now()}`,
          type: 'default',
          position: { x: 200, y: 200 },
          data: { label: `Getting Started with ${brief.boardTopic}`, content: response.content },
        }
        setNodes([newNode])
        
        // Save the single node immediately
        const boardData = {
          nodes: [newNode],
          edges: [],
          viewport: reactFlowInstance.getViewport(),
        }
        
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
      if (!Array.isArray(nds)) return [node]
      return [...nds, node]
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
      const newNode = {
        id: nodeId,
        type: 'document' as const,
        position: dropPosition,
        data: {
          title: file.name,
          type: 'document',
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
      const newNode = {
        id: nodeId,
        type: 'document' as const,
        position: dropPosition,
        data: {
          title: file.name,
          type: 'document',
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

  // Keyboard shortcuts for focus
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (selectedNodes.length === 0) return
      if (e.key.toLowerCase() === 'f' && !e.shiftKey) {
        e.preventDefault()
        focusNeighborhood(selectedNodes, edges.map(e => ({ source: e.source as string, target: e.target as string })))
      } else if (e.key.toLowerCase() === 'f' && e.shiftKey) {
        e.preventDefault()
        focusGroup(selectedNodes, edges.map(e => ({ source: e.source as string, target: e.target as string })))
      } else if (e.key === 'Escape') {
        if (focusMode) {
          e.preventDefault()
          clearFocus()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedNodes, edges, focusMode, focusNeighborhood, focusGroup, clearFocus])

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
            const position = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top
            }
            
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
                // Convert screen coordinates to flow coordinates
                const flowPosition = reactFlowInstance.screenToFlowPosition({
                  x: position.x,
                  y: position.y,
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

  const handleOpenAINodeGenerator = useCallback(() => {
    setShowAINodeGenerator(true)
  }, [])

  const [showAddNodeModal, setShowAddNodeModal] = useState(false)
  const [pendingNodePosition, setPendingNodePosition] = useState<{ x: number; y: number } | null>(null)

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
        onSelectionChange={handleSelectionChange}
        onPaneClick={() => setContextMenu({ isOpen: false, position: null })}
        onPaneContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({ 
            isOpen: true, 
            position: { x: event.clientX, y: event.clientY } 
          });
        }}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineComponent={CustomConnectionLine}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 2 }}
        proOptions={{ hideAttribution: true }}
        className={`${theme === 'dark' ? 'dark' : ''}`}
        multiSelectionKeyCode="Meta"
        deleteKeyCode="Delete"
      >
        {renderRemoteCursors()}
        <Background />
        <Controls />
        <MiniMap />
        
        {/* Focus chip */}
        {focusMode && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
            <div className="px-3 py-1 rounded-full bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 shadow flex items-center gap-3 text-xs">
              <span className="font-medium text-gray-700 dark:text-gray-200">Focus: {focusMode === 'neighbors' ? 'Neighborhood' : 'Group'}</span>
              <button
                onClick={() => clearFocus()}
                className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-16 z-10">
          <div className="p-2 bg-white/80 dark:bg-gray-800/80 rounded-lg shadow-lg backdrop-blur-sm">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              💡 Tip: Drag & drop documents and images here
            </p>
          </div>
        </div>
        
        {isBoardView && (
          <>
            <FloatingActionButton
              onAddNode={() => {
                setShowNodeSetupModal(true)
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
              aiInitialized={aiInitialized}
            />
            
            <ChatPanel
              nodes={nodes} // Add this line to pass the nodes
              onGenerateNode={(nodeData: { 
                id: string,
                label: string, 
                content?: string, 
                position: { x: number, y: number }, // Now required since it's absolute
                referenceNode?: { id: string, title: string }
              }) => {
                // Create the new node with the absolute position
                const newNode = {
                  id: nodeData.id,
                  type: 'default',
                  position: nodeData.position, // Use the absolute position directly
                  data: { 
                    title: nodeData.label,
                    content: nodeData.content,
                    aiGenerated: true
                  },
                }
                
                // Add the node
                handleAddNodeToStore(newNode)
                
                // If we have a reference node, create an edge
                if (nodeData.referenceNode) {
                  const newEdge: Edge = {
                    id: `edge-${Date.now()}`,
                    source: nodeData.referenceNode.id,
                    target: nodeData.id,
                    type: 'floating',
                  }
                  
                  // Add the edge
                  setEdges(eds => [...eds, newEdge])
                }
              }}
            />
          </>
        )}
      </ReactFlow>
      
      {/* Context Menu */}
      <BoardContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        onClose={() => setContextMenu({ isOpen: false, position: null })}
        onAddBlankNode={() => {
          // Store the position and show the modal instead of creating a blank node
          if (contextMenu.position) {
            const flowPosition = reactFlowInstance.screenToFlowPosition({
              x: contextMenu.position.x,
              y: contextMenu.position.y,
            });
            setPendingNodePosition(flowPosition);
            setShowAddNodeModal(true);
          }
          setContextMenu({ isOpen: false, position: null });
        }}
        onGenerateAINode={handleOpenAINodeGenerator}
        onFocusNeighborhood={() => {
          if (selectedNodes.length === 0) return
          focusNeighborhood(selectedNodes, edges.map(e => ({ source: e.source as string, target: e.target as string })))
        }}
        onFocusGroup={() => {
          if (selectedNodes.length === 0) return
          focusGroup(selectedNodes, edges.map(e => ({ source: e.source as string, target: e.target as string })))
        }}
        onClearFocus={() => clearFocus()}
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
                  id: `ai-node-${Date.now()}`,
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
          {showNodeSetupModal && (
            <NodeSetupModal
              isOpen={showNodeSetupModal}
              onComplete={handleNodeSetupComplete}
              onClose={() => setShowNodeSetupModal(false)}
            />
          )}
          {isBoardView && (
            <>
              <FloatingActionButton
                onAddNode={() => {
                  setShowNodeSetupModal(true)
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
                aiInitialized={aiInitialized}
              />
            </>
          )}
        </>
      )}
      {showAddNodeModal && (
        <NodeEditModal
          open={showAddNodeModal}
          onClose={() => {
            setShowAddNodeModal(false);
            setPendingNodePosition(null);
          }}
          onSave={(title: string, content: string) => {
            if (pendingNodePosition) {
              const newNode: Node = {
                id: `node-${Date.now()}`,
                type: 'default',
                position: pendingNodePosition,
                data: { 
                  title: title || 'New Node',
                  content: content
                },
              };
              setNodes((nds) => {
                if (!Array.isArray(nds)) return [newNode];
                return [...nds, newNode];
              });
            }
            setShowAddNodeModal(false);
            setPendingNodePosition(null);
          }}
          initialTitle=""
          initialContent=""
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
