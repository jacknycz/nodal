'use client'

import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  ReactFlowProvider,
  useReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useStore,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import html2canvas from 'html2canvas'

import { useBoard } from './useBoard'
import { boardStorage } from '../storage/storage'
import DocumentNode from '../nodes/DocumentNode'
import NodalNode from '../nodes/nodalNode'
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
import { supabase } from '../auth/supabaseClient';

const nodeTypes = {
  default: NodalNode,
  document: DocumentNode,
}

const edgeTypes = {
  floating: FloatingEdge,
}

interface BoardProps {
  initialBoard?: { nodes: Node[]; edges: Edge[] }
  pendingBoardBrief?: BoardBrief // Now includes id
  onBoardStateChange?: (name: string, status: string, hasChanges: boolean) => void
  clearPendingBoardBrief?: () => void
  isBoardView?: boolean
  boardId?: string // Add board ID for existing boards
  boardName?: string // Add board name for existing boards
  screenshotMode?: boolean // Add screenshot mode
}

function BoardContent({
  initialBoard,
  pendingBoardBrief,
  onBoardStateChange,
  clearPendingBoardBrief,
  isBoardView = true,
  boardId,
  boardName, // Add this parameter
  screenshotMode = false, // Add screenshotMode
}: BoardProps) {
  const { theme } = useTheme()
  const { isInitialized: aiInitialized } = useAIContext()
  
  // Basic state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [currentBoardName, setCurrentBoardName] = useState('Untitled Board')
  const localBoardIdRef = useRef<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [showAINodeGenerator, setShowAINodeGenerator] = useState(false)
  const [showNodeSetupModal, setShowNodeSetupModal] = useState(false)
  const [thumbnailLoading, setThumbnailLoading] = useState(false);
  const prevSaveStatus = useRef(saveStatus);
  
  // Autosave state - simplified
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const autosaveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isInitializedRef = useRef(false)
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const reactFlowInstance = useReactFlow()
  
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
        console.log('⏭️ Autosave skipped - no board ID')
        return
      }
      
      try {
        console.log('🚀 Starting autosave...')
        setSaveStatus('saving')
        
        const boardData = {
          nodes,
          edges,
          viewport: reactFlowInstance.getViewport(),
        }
        
        console.log('💾 Saving board data:', {
          boardId: localBoardIdRef.current,
          nodesCount: boardData.nodes.length,
          edgesCount: boardData.edges.length
        })
        
        await boardStorage.updateBoard(localBoardIdRef.current, boardData)
        
        console.log('✅ Autosave completed successfully')
        setSaveStatus('saved')
        setHasUnsavedChanges(false)
        
        if (onBoardStateChange) {
          onBoardStateChange(currentBoardName, 'saved', false)
        }
      } catch (error) {
        console.error('❌ Autosave failed:', error)
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
      console.log('📝 Changes detected, triggering autosave...')
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

      // Upload directly to Supabase storage using the same client as documents
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.error('User not authenticated for thumbnail upload');
        return;
      }

      const fileName = `thumbnail-${boardId}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        return;
      }

      console.log('Thumbnail saved successfully to Supabase storage');
    } catch (error) {
      console.error('Screenshot capture failed:', error);
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
    console.log('🚀 generateStarterNodes called with boardId:', boardId, 'for brief:', brief.boardName)
    try {
      const aiService = getOpenAIService()
      if (!aiService) {
        console.error('AI service not available')
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
          console.log('📝 Set generated nodes in state:', generatedNodes.length)
          
          // Save immediately to database
          const boardData = {
            nodes: generatedNodes,
            edges: [],
            viewport: reactFlowInstance.getViewport(),
          }
          
          console.log('💾 Saving generated nodes immediately...')
          await boardStorage.updateBoard(boardId, boardData)
          console.log('✅ Generated nodes saved successfully')
          
          // Update save status
          setSaveStatus('saved')
          setHasUnsavedChanges(false)
          
          if (onBoardStateChange) {
            onBoardStateChange(brief.boardName, 'saved', false)
          }
        }
      } catch (parseError) {
        console.error('Failed to parse AI response:', parseError)
        console.log('Raw response content:', response.content)
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
        
        console.log('💾 Saving single generated node immediately...')
        await boardStorage.updateBoard(boardId, boardData)
        console.log('✅ Single generated node saved successfully')
        
        // Update save status
        setSaveStatus('saved')
        setHasUnsavedChanges(false)
        
        if (onBoardStateChange) {
          onBoardStateChange(brief.boardName, 'saved', false)
        }
      }
    } catch (error) {
      console.error('Failed to generate starter nodes:', error)
    }
  }
  const { addNode, addNodeToStore, getViewportCenter } = useBoard()
  
  // Initialize board
  useEffect(() => {
    // Prevent multiple initializations
    if (isInitializedRef.current) {
      console.log('⏭️ Skipping initialization - already initialized')
      return
    }
    
    console.log('🔄 Board initialization effect triggered:', {
      hasInitialBoard: !!initialBoard,
      hasPendingBoardBrief: !!pendingBoardBrief,
      hasLocalBoardId: !!localBoardIdRef.current,
      boardId,
      boardName
    })
    
    // Set board ID for existing boards
    if (boardId && !localBoardIdRef.current) {
      console.log('🆔 Setting board ID for existing board:', boardId)
      localBoardIdRef.current = boardId
    }
    
    // Set board name for existing boards
    if (boardName && !pendingBoardBrief) {
      console.log('📝 Setting board name for existing board:', boardName)
      setCurrentBoardName(boardName)
      if (onBoardStateChange) {
        onBoardStateChange(boardName, 'saved', false)
      }
    }
    
    if (initialBoard && initialBoard.nodes) {
      console.log('📥 Loading initial board nodes:', initialBoard.nodes.length)
      setNodes(initialBoard.nodes)
    }
    if (initialBoard && initialBoard.edges) {
      console.log('📥 Loading initial board edges:', initialBoard.edges.length)
      setEdges(initialBoard.edges)
    }
    if (pendingBoardBrief && !localBoardIdRef.current) { // Only run if we don't already have a localBoardId
      console.log('🔄 useEffect triggered for pendingBoardBrief:', pendingBoardBrief.boardName)
      setCurrentBoardName(pendingBoardBrief.boardName)
      if (onBoardStateChange) {
        onBoardStateChange(pendingBoardBrief.boardName, 'saved', false)
      }
      console.log('pendingBoardBrief:', pendingBoardBrief, 'typeof id:', typeof pendingBoardBrief.id)
      localBoardIdRef.current = pendingBoardBrief.id;
      console.log('AFTER ASSIGNMENT:', localBoardIdRef.current, typeof localBoardIdRef.current);
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
          console.log('🔵 CREATING BLANK BOARD with ID:', boardId, 'for name:', boardName)
          setCurrentBoardName(boardName)
          setSaveStatus('saved')
          if (onBoardStateChange) {
            onBoardStateChange(boardName, 'saved', false)
          }
          console.log('✅ Blank board created and saved:', boardName)
          // If startWithAI is true, now generate AI nodes to update the same board
          if (pendingBoardBrief.startWithAI) {
            console.log('🤖 Starting AI generation for board ID:', boardId)
            generateStarterNodes(pendingBoardBrief, boardId)
          }
        } catch (error) {
          console.error('Failed to create blank board:', error)
          setSaveStatus('error')
          if (onBoardStateChange) {
            onBoardStateChange(boardName, 'error', false)
          }
        }
      })()
      if (clearPendingBoardBrief) {
        clearPendingBoardBrief()
      }
    }
    
    // Mark as initialized
    isInitializedRef.current = true
  }, [initialBoard, pendingBoardBrief, setNodes, setEdges, clearPendingBoardBrief, boardId, boardName])
  
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
    console.log('➕ Adding new node:', { nodeData, position })
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'default',
      position,
      data: { 
        label: nodeData.title,
        content: nodeData.content 
      },
    }
    // Use React Flow's addNode utility
    const addNode = (node: Node) => {
      console.log('📝 Adding node to state:', node.id)
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
    console.log('💾 saveBoard called with name:', name, 'localBoardId:', localBoardIdRef.current)
    try {
      console.log('🚀 Starting manual save...')
      setSaveStatus('saving')
      setHasUnsavedChanges(false)
      
      const boardData = {
        nodes,
        edges,
        viewport: reactFlowInstance.getViewport(),
      }
      
      console.log('💾 Manual save data:', {
        nodesCount: boardData.nodes.length,
        edgesCount: boardData.edges.length,
        boardId: localBoardIdRef.current
      })
      
      if (localBoardIdRef.current && !name) {
        await boardStorage.updateBoard(localBoardIdRef.current, boardData)
        console.log('✅ Updated existing board:', localBoardIdRef.current)
      } else {
        const boardName = name || `Board ${new Date().toLocaleDateString()}`
        const boardId = await boardStorage.saveBoard(boardName, boardData)
        console.log('🆕 Created new board:', boardId, 'with name:', boardName)
        localBoardIdRef.current = boardId
        setCurrentBoardName(boardName)
      }
      
      console.log('✅ Manual save completed successfully')
      setSaveStatus('saved')
      
      if (onBoardStateChange) {
        console.log('🔄 Updating board state: saved, false')
        onBoardStateChange(currentBoardName, 'saved', false)
      }
    } catch (error) {
      console.error('❌ Manual save failed:', error)
      setSaveStatus('error')
      setHasUnsavedChanges(true)
      
      if (onBoardStateChange) {
        console.log('🔄 Updating board state: error, true')
        onBoardStateChange(currentBoardName, 'error', true)
      }
    }
  }, [nodes, edges, localBoardIdRef.current, currentBoardName, reactFlowInstance, onBoardStateChange])


  
  // Handle document upload
  const handleDocumentUpload = useCallback(async (file: File) => {
    const position = getViewportCenter()
    const nodeId = `document-${Date.now()}`
    
    // Create the node first with empty extracted text
    const newNode = {
      id: nodeId,
      type: 'document' as const,
      position,
      data: {
        label: file.name,
        file,
        type: 'document',
        fileName: file.name,
        fileType: file.type || 'unknown',
        fileSize: file.size,
        status: 'processing' as const,
        extractedText: '',
      },
    }
    handleAddNodeToStore(newNode)
    
    // Extract text if the file type supports it
    if (isTextExtractable(file.type, file.name)) {
      try {
        console.log('🔍 Starting server-side text extraction for:', file.name)
        
        // Convert file to base64
        const arrayBuffer = await file.arrayBuffer()
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
        
        // Call server-side API
        const response = await fetch('/api/extract-text', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: base64,
            fileName: file.name,
            fileType: file.type
          })
        })
        
        if (response.ok) {
          const result = await response.json()
          console.log('✅ Server-side text extraction completed:', result.characterCount, 'characters')
          
          // Update the specific node
          setNodes((currentNodes) => {
            if (!Array.isArray(currentNodes)) return currentNodes
            return currentNodes.map(node => 
              node.id === nodeId 
                ? { ...node, data: { ...node.data, extractedText: result.extractedText, status: 'ready' } }
                : node
            )
          })
        } else {
          console.error('❌ Server-side text extraction failed:', response.statusText)
          setNodes((currentNodes) => {
            if (!Array.isArray(currentNodes)) return currentNodes
            return currentNodes.map(node => 
              node.id === nodeId 
                ? { ...node, data: { ...node.data, extractedText: 'Text extraction failed', status: 'error' } }
                : node
            )
          })
        }
      } catch (error) {
        console.error('❌ Text extraction failed:', error)
        setNodes((currentNodes) => {
          if (!Array.isArray(currentNodes)) return currentNodes
          return currentNodes.map(node => 
            node.id === nodeId 
              ? { ...node, data: { ...node.data, extractedText: 'Text extraction failed', status: 'error' } }
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
  }, [getViewportCenter, handleAddNodeToStore])

  // Drag and drop handlers
  const [isDragOver, setIsDragOver] = useState(false)

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
              handleDocumentUpload(file)
            })
          }
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
      
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionLineComponent={CustomConnectionLine}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 2 }}
        proOptions={{ hideAttribution: true }}
        className={`${theme === 'dark' ? 'dark' : ''}`}
      >
        <Background />
        <Controls />
        <MiniMap />
        
        <div className="absolute bottom-4 right-1 z-10">
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
              onAIGenerate={() => {
                // Manual AI generation - open the AI node generator modal
                setShowAINodeGenerator(true)
              }}
              onUploadDocument={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp'
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0]
                  if (file) handleDocumentUpload(file)
                }
                input.click()
              }}
              aiInitialized={aiInitialized}
            />
            
            {aiInitialized && (
              <ChatPanel
                onGenerateNode={(nodeData: { label: string; content?: string }) => {
                  const position = getViewportCenter()
                  const newNode = {
                    id: `ai-node-${Date.now()}`,
                    type: 'default',
                    position,
                    data: { ...nodeData },
                  }
                  handleAddNodeToStore(newNode)
                }}
              />
            )}
          </>
        )}
      </ReactFlow>
      
      <BokehBackground />
      
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
                onAIGenerate={() => {
                  setShowAINodeGenerator(true)
                }}
                onUploadDocument={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.gif,.webp'
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) handleDocumentUpload(file)
                  }
                  input.click()
                }}
                aiInitialized={aiInitialized}
              />
              {aiInitialized && (
                <ChatPanel
                  onGenerateNode={(nodeData: { label: string; content?: string }) => {
                    const position = getViewportCenter()
                    const newNode = {
                      id: `ai-node-${Date.now()}`,
                      type: 'default',
                      position,
                      data: { ...nodeData },
                    }
                    handleAddNodeToStore(newNode)
                  }}
                />
              )}
            </>
          )}
        </>
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
