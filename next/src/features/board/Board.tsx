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

import { useBoard } from './useBoard'
import { boardStorage } from '../storage/storage'
import DocumentNode from '../nodes/DocumentNode'
import FloatingEdge from './FloatingEdge'
import CustomConnectionLine from './CustomConnectionLine'
import FloatingActionButton from '../../components/FloatingActionButton'
import AINodeGenerator from '../../components/AINodeGenerator'
import { useAIContext } from '../ai/aiContext'
import BokehBackground from '../../components/BokehBackground'
import ChatPanel from '../../components/ChatPanel'
import { useTheme } from '../../contexts/ThemeContext'
import TopicModal from '../../components/TopicModal'

const nodeTypes = {
  document: DocumentNode,
}

const edgeTypes = {
  floating: FloatingEdge,
}

interface BoardProps {
  initialBoard?: { nodes: Node[]; edges: Edge[] }
  pendingBoardBrief?: { topic: string; description?: string }
  onBoardStateChange?: (name: string, status: string, hasChanges: boolean) => void
  clearPendingBoardBrief?: () => void
  isBoardView?: boolean
}

function BoardContent({
  initialBoard,
  pendingBoardBrief,
  onBoardStateChange,
  clearPendingBoardBrief,
  isBoardView = true,
}: BoardProps) {
  const { theme } = useTheme()
  const { isInitialized: aiInitialized } = useAIContext()
  
  // Basic state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [currentBoardName, setCurrentBoardName] = useState('Untitled Board')
  const [localBoardId, setLocalBoardId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved')
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [showAINodeGenerator, setShowAINodeGenerator] = useState(false)
  
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
  
  // Board utilities
  const { addNode, addNodeToStore, getViewportCenter } = useBoard()
  
  // Initialize board
  useEffect(() => {
    if (initialBoard && initialBoard.nodes) {
      setNodes(initialBoard.nodes)
    }
    if (initialBoard && initialBoard.edges) {
      setEdges(initialBoard.edges)
    }
    if (pendingBoardBrief) {
      setCurrentBoardName(pendingBoardBrief.topic)
      if (clearPendingBoardBrief) {
        clearPendingBoardBrief()
      }
    }
  }, [initialBoard, pendingBoardBrief, setNodes, setEdges, clearPendingBoardBrief])
  
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
  const handleAddNode = useCallback((title: string, position: { x: number; y: number }) => {
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'default',
      position,
      data: { label: title },
    }
    // Use React Flow's addNode utility
    const addNode = (node: Node) => {
      setNodes((nds) => {
        if (!Array.isArray(nds)) return [node]
        return [...nds, node]
      })
    }
    addNode(newNode)
  }, [setNodes])
  
  // Handle adding nodes to store (for AI generation)
  const handleAddNodeToStore = useCallback((node: Node) => {
    setNodes((nds) => {
      if (!Array.isArray(nds)) return [node]
      return [...nds, node]
    })
  }, [setNodes])
  
  // Save board function
  const saveBoard = useCallback(async (name?: string) => {
    try {
      setSaveStatus('saving')
      
      const boardData = {
        nodes,
        edges,
        viewport: reactFlowInstance.getViewport(),
      }
      
      if (localBoardId && !name) {
        await boardStorage.updateBoard(localBoardId, boardData)
      } else {
        const boardName = name || `Board ${new Date().toLocaleDateString()}`
        const boardId = await boardStorage.saveBoard(boardName, boardData)
        setLocalBoardId(boardId)
        setCurrentBoardName(boardName)
      }
      
      setSaveStatus('saved')
      if (onBoardStateChange) {
        onBoardStateChange(currentBoardName, 'saved', false)
      }
    } catch (error) {
      console.error('Failed to save board:', error)
      setSaveStatus('error')
    }
  }, [nodes, edges, localBoardId, currentBoardName, reactFlowInstance, onBoardStateChange])
  
  // Handle document upload
  const handleDocumentUpload = useCallback(async (file: File) => {
    const position = getViewportCenter()
    
    // Create the node first with empty extracted text
    const newNode = {
      id: `document-${Date.now()}`,
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
        const response = await fetch('https://nodal-steel.vercel.app/api/extract-text', {
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
          
          // Update the node with extracted text
          setNodes((nds) => {
            const currentNodes = Array.isArray(nds) ? nds : []
            return currentNodes.map(node => 
              node.id === newNode.id 
                ? { ...node, data: { ...node.data, extractedText: result.extractedText, status: 'ready' } }
                : node
            )
          })
        } else {
          console.error('❌ Server-side text extraction failed:', response.statusText)
          // Update the node with error status
          setNodes((nds) => {
            const currentNodes = Array.isArray(nds) ? nds : []
            return currentNodes.map(node => 
              node.id === newNode.id 
                ? { ...node, data: { ...node.data, extractedText: 'Text extraction failed', status: 'error' } }
                : node
            )
          })
        }
      } catch (error) {
        console.error('❌ Text extraction failed:', error)
        // Update the node with error status
        setNodes((nds) => {
          const currentNodes = Array.isArray(nds) ? nds : []
          return currentNodes.map(node => 
            node.id === newNode.id 
              ? { ...node, data: { ...node.data, extractedText: 'Text extraction failed', status: 'error' } }
              : node
          )
        })
      }
    } else {
      // For non-extractable files, mark as ready
      setNodes((nds) => {
        const currentNodes = Array.isArray(nds) ? nds : []
        return currentNodes.map(node => 
          node.id === newNode.id 
            ? { ...node, data: { ...node.data, status: 'ready' } }
            : node
        )
      })
    }
  }, [getViewportCenter, handleAddNodeToStore, setNodes])

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
        
        <Panel position="top-left" className="z-10">
          <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
            <span className="text-sm font-medium">{currentBoardName}</span>
            <button
              onClick={() => saveBoard()}
              disabled={saveStatus === 'saving'}
              className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {saveStatus === 'saving' ? 'Saving...' : 'Save'}
            </button>
          </div>
        </Panel>
        
        <Panel position="bottom-right" className="z-10">
          <div className="p-2 bg-white/80 dark:bg-gray-800/80 rounded-lg shadow-lg backdrop-blur-sm">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              💡 Tip: Drag & drop documents and images here
            </p>
          </div>
        </Panel>
        
        {isBoardView && (
          <>
            <FloatingActionButton
              onAddNode={() => {
                const position = getViewportCenter()
                handleAddNode('New Node', position)
              }}
              onAIGenerate={() => setShowAINodeGenerator(true)}
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