'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Node, Edge, useReactFlow } from '@xyflow/react'
import { useUnifiedAI2 } from '../features/ai/useUnifiedAI2'
import { useAIContext } from '../features/ai/aiContext'
import { useBoardStore } from '../features/board/boardSlice'
import { Send, X, MessageSquare, Loader2, Key, Target } from 'lucide-react'
import TextArea from './ui/TextArea'
import Button from './ui/Button'
import Modal from './ui/Modal'
import Checkbox from './ui/Checkbox'
import { useChatNodeGen2 } from '../features/ai/useChatNodeGen2'
import { useAIPlacement } from '../features/board/usePlacement'

export default function ChatPanel2() {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 640
  })
  const [inputValue, setInputValue] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const {
    messages,
    sendMessage,
    sendMessageStream,
    cancelStreaming,
    clearChat,
    isLoading,
    isStreaming,
    error,
    clearError,
  } = useUnifiedAI2()

  const ai = useAIContext()
  const { generateFromTopic } = useChatNodeGen2()
  const { setNodes, setEdges } = useReactFlow()
  const { placeGeneratedNodes } = useAIPlacement()

  // Selection/focus awareness
  const selectedNodeIds = useBoardStore((s) => s.selectedNodeIds)
  const focusedNodeIds = useBoardStore((s) => s.focusedNodeIds || [])
  const clearSelectedNodes = useBoardStore((s) => s.clearSelectedNodes)
  const clearFocusedNodes = useBoardStore((s) => s.clearFocusedNodes)
  const storeNodes = useBoardStore((s) => s.nodes)
  const contextIds = (focusedNodeIds && focusedNodeIds.length > 0) ? focusedNodeIds : selectedNodeIds
  const selectedNodes = (storeNodes || []).filter((n: any) => contextIds.includes(n.id))

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return
    const userText = inputValue.trim()
    setInputValue('')
    if (inputRef.current) inputRef.current.blur()

    // Build contextual message with selected/focused nodes
    let contextualMessage = userText
    if (selectedNodes.length > 0) {
      const nodeContext = selectedNodes.map((n: any) => {
        const title = n?.data?.title || 'Untitled Node'
        const content = (n?.data?.content || '').toString().trim()
        const clipped = content.length > 1000 ? content.slice(0, 1000) + '…' : content
        return `Node: "${title}"${clipped ? `\nContent: ${clipped}` : ''}`
      }).join('\n\n')

      const label = `Selected ${selectedNodes.length === 1 ? 'node' : 'nodes'}`
      contextualMessage = `Context - ${label}:\n${nodeContext}\n\nUser message: ${userText}`
    }

    await sendMessageStream(contextualMessage)
  }

  // Node creation intent + confirm modal
  const [showCreate, setShowCreate] = useState(false)
  const [pendingPoints, setPendingPoints] = useState<{ title: string; content: string; selected: boolean }[]>([])
  const [pendingParentId, setPendingParentId] = useState<string | null>(null)

  // Enhanced intent parsing
  const parseCreateIntent = (text: string) => {
    const patterns = [
      /^(create|add|generate)\b/i,
      /^(create|add)\s+\d+\s+nodes?\b/i,
      /^(create|add)\s+nodes?\s+(?:for|about|under)\b/i,
      /^(create|add)\s+nodes?\s*:\s*\w/i
    ]
    return patterns.some(pattern => pattern.test(text))
  }

  // Extract count from commands like "create 5 nodes"
  const extractCount = (text: string): number | null => {
    const match = text.match(/(?:create|add|generate)\s+(\d+)\s+nodes?/i)
    return match ? parseInt(match[1], 10) : null
  }

  // Extract topic from commands like "create nodes about <topic>"
  const extractTopic = (text: string): string | null => {
    const patterns = [
      /(?:create|add|generate)\s+nodes?\s+(?:for|about)\s+(.+?)(?:\s|$)/i,
      /(?:create|add|generate)\s+(\d+)\s+nodes?\s+(?:for|about)\s+(.+?)(?:\s|$)/i
    ]
    
    for (const pattern of patterns) {
      const match = text.match(pattern)
      if (match && match[match.length - 1]) {
        return match[match.length - 1].trim()
      }
    }
    return null
  }

  // Extract parent name from commands like "create nodes under <parent>"
  const extractParentName = (text: string): string | null => {
    const match = text.match(/(?:create|add|generate)\s+nodes?\s+under\s+(.+?)(?:\s|$)/i)
    return match ? match[1].trim() : null
  }

  // Find node by name (case-insensitive, partial match)
  const findNodeByName = (name: string): any => {
    const normalizedName = name.toLowerCase().trim()
    return storeNodes.find((node: any) => 
      node.data?.title?.toLowerCase().includes(normalizedName) ||
      normalizedName.includes(node.data?.title?.toLowerCase())
    )
  }

  const extractTitles = (text: string): string[] | null => {
    const m = text.match(/nodes?:\s*(.*)$/i)
    if (!m) return null
    return m[1].split(/[\n,]/).map(s => s.trim()).filter(Boolean)
  }

  const handleCreate = async () => {
    const msg = inputValue.trim()
    if (!msg) return
    setInputValue('')
    if (inputRef.current) inputRef.current.blur()

    // Parse command components
    const list = extractTitles(msg)
    const count = extractCount(msg)
    const topic = extractTopic(msg)
    const parentName = extractParentName(msg)
    
    // Determine parent node
    let parentId: string | null = null
    if (parentName) {
      const parentNode = findNodeByName(parentName)
      if (parentNode) {
        parentId = parentNode.id
      }
    } else if (selectedNodes.length > 0) {
      parentId = selectedNodes[0].id
    }
    
    // Determine topic for generation
    let generationTopic = topic
    if (!generationTopic && selectedNodes.length > 0) {
      generationTopic = selectedNodes[0]?.data?.title || 'topic'
    }
    if (!generationTopic && !list) {
      generationTopic = 'general ideas'
    }

    let points: { title: string; content: string }[] = []
    if (list && list.length) {
      points = list.map(t => ({ title: t, content: '' }))
    } else if (generationTopic) {
      const nodeCount = count || 5
      points = await generateFromTopic(generationTopic, nodeCount, storeNodes as any)
    }

    if (points.length) {
      setPendingParentId(parentId)
      setPendingPoints(points.slice(0, 10).map(p => ({ ...p, selected: true })))
      setShowCreate(true)
    }
  }

  return (
    <>
      {/* Toggle */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed right-4 z-40 bg-primary-600 text-white rounded-full p-3 shadow-lg hover:bg-primary-700 transition-all duration-200 ease-out bottom-4 sm:bottom-auto sm:top-16 ${
          isOpen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
        }`}
        title="Open Chat"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      {/* Panel */}
      <div
        className={`fixed top-16 right-4 rounded-4xl z-60 w-96 h-[calc(100dvh-80px)] bg-white/80 backdrop-blur-xs dark:bg-gray-900/80 shadow-xl flex flex-col transition-all duration-200 ease-out ${
          isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between py-2 px-4 shadow-lg shadow-gray-400/10 dark:shadow-none">
          <div className="flex items-center space-x-2">
            <img src="/nobot.svg" alt="Nodal" width={24} height={24} className="opacity-90" />
            <span className="text-xs px-2 py-0.5 rounded bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">Chat #2</span>
          </div>

          {/* AI Status */}
          <div className="flex items-center space-x-4">
            {ai.isInitialized ? (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-xs text-green-600 dark:text-green-400">Connected</span>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-yellow-600 dark:text-yellow-400">Connecting...</span>
              </div>
            )}

            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Init banner */}
        {!ai.isInitialized && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <p className="text-xs text-yellow-700 dark:text-yellow-300">AI is initializing... Check console for status</p>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 shadow-[inset_0_-4px_6px_-1px_rgba(156,163,175,0.1)] dark:shadow-none">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}`}>
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                  <span className="text-sm text-gray-500">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="flex justify-start">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl px-4 py-2">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                <button onClick={clearError} className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1">Dismiss</button>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Selected Nodes Banner */}
        {selectedNodes.length > 0 && (
          <div className="bg-blue-50 dark:bg-primary-900/20 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <p className="text-xs text-primary-700 dark:text-primary-300">
                  {selectedNodes.length === 1
                    ? `Selected: "${selectedNodes[0].data?.title || 'Untitled Node'}"`
                    : `Selected: ${selectedNodes.length} nodes`}
                </p>
              </div>
              <button
                onClick={() => { clearSelectedNodes(); clearFocusedNodes() }}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4">
          <div className="flex space-x-2">
            <TextArea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  if (parseCreateIntent(inputValue)) {
                    handleCreate()
                  } else {
                    handleSend()
                  }
                }
              }}
              placeholder={selectedNodes.length > 0
                ? `Ask about ${selectedNodes.length === 1 ? 'this node' : 'these nodes'}...`
                : 'Chat with Nodal...'}
              rows={1}
              fullWidth
              className="resize-none"
            />
            <Button onClick={() => (parseCreateIntent(inputValue) ? handleCreate() : handleSend())} disabled={!inputValue.trim() || isLoading || isStreaming} loading={isLoading || isStreaming} className="px-4">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <button className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" onClick={clearChat}>Clear</button>
            {isStreaming && (
              <button className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" onClick={cancelStreaming}>Stop</button>
            )}
          </div>
        </div>

        {/* Confirm Modal */}
        <Modal
          open={showCreate}
          onClose={() => { setShowCreate(false); setPendingPoints([]) }}
          title="Create nodes"
          description="Review and confirm the nodes to create."
        >
          <div className="max-h-64 overflow-auto mt-2 space-y-2">
            {pendingPoints.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={p.selected}
                    onChange={(checked) => setPendingPoints(prev => prev.map((n, i) => i === idx ? { ...n, selected: !!checked } : n))}
                    label={p.title || '(untitled)'}
                    labelTextClassName="text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => { setShowCreate(false); setPendingPoints([]) }}>Cancel</Button>
            <Button
              onClick={async () => {
                const selected = pendingPoints.filter(n => n.selected)
                if (selected.length === 0) {
                  setShowCreate(false)
                  setPendingPoints([])
                  setPendingParentId(null)
                  return
                }

                try {
                  const nodesToPlace = selected.map(p => ({ title: p.title, content: p.content || '' }))
                  // Use specific parent if provided, otherwise use placement hook's default logic
                  const result = pendingParentId 
                    ? await placeGeneratedNodes(nodesToPlace, pendingParentId, { preferredDirection: 'down', minDistance: 40 })
                    : await placeGeneratedNodes(nodesToPlace)

                  if (result && result.success && result.placements.length > 0) {
                    const newNodes: Node[] = result.placements.map(p => ({
                      id: p.node.id,
                      type: (p.node as any).type || 'default',
                      position: p.position,
                      data: { ...(p.node as any).data },
                    }))
                    setNodes((nds: any) => (Array.isArray(nds) ? [...nds, ...newNodes] : [...newNodes]))

                    if (result.connections && result.connections.length > 0) {
                      const newEdges: Edge[] = result.connections.map(c => ({
                        id: c.edge.id,
                        source: typeof c.edge.source === 'string' ? c.edge.source : (c.edge.source as any)?.id,
                        target: typeof c.edge.target === 'string' ? c.edge.target : (c.edge.target as any)?.id,
                        type: (c.edge as any).type || 'floating',
                      }))
                      setEdges((eds: any) => (Array.isArray(eds) ? [...eds, ...newEdges] : [...newEdges]))
                    }

                    sendMessage(`Created ${newNodes.length} node(s).`)
                  } else {
                    sendMessage('No nodes were created.')
                  }
                } catch (err) {
                  sendMessage('Failed to create nodes.')
                } finally {
                  setShowCreate(false)
                  setPendingPoints([])
                  setPendingParentId(null)
                }
              }}
            >
              Create {pendingPoints.filter(n => n.selected).length} nodes
            </Button>
          </div>
        </Modal>
      </div>
    </>
  )
}


