'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useUnifiedAI } from '../features/ai/useUnifiedAI'
import { useAIContext } from '../features/ai/aiContext'
import { useBoardStore } from '../features/board/boardSlice'
import { useAIPlacement } from '../features/board/usePlacement'
import { Send, X, Bot, Sparkles, MessageSquare, Loader2, Key, Target } from 'lucide-react'
import TextArea from './ui/TextArea'
import Button from './ui/Button'
import type { BoardNode } from '../features/board/boardTypes'
import type { NodeToPlace } from '../features/board/placementTypes'

interface ChatPanelProps {
  onGenerateNode?: (nodeData: { 
    id?: string
    label: string; 
    content?: string 
    position?: { x: number; y: number }
    referenceNode?: { id: string; title: string }
  }) => void
  nodes?: BoardNode[]
}

export default function ChatPanel({ 
  onGenerateNode,
  nodes: propNodes
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return true
    return window.innerWidth >= 640 // open by default on >= sm, closed on mobile
  })
  const [inputValue, setInputValue] = useState('')
  const [showNodeGenerator, setShowNodeGenerator] = useState(false)
  const [nodePrompt, setNodePrompt] = useState('')
  const [nodeCount, setNodeCount] = useState(3)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  const {
    messages,
    sendMessage,
    sendMessageStream,
    cancelStreaming,
    generateNodes,
    isLoading,
    isGeneratingNodes,
    isStreaming,
    error,
    clearError
  } = useUnifiedAI()

  // Add AI status to the context
  const aiContext = useAIContext()
  const { isInitialized: aiInitialized } = aiContext
  
  // Get selection and focus from board store
  const selectedNodeIds = useBoardStore((state) => state.selectedNodeIds)
  const focusedNodeIds = useBoardStore((state) => state.focusedNodeIds || [])
  const clearSelectedNodes = useBoardStore((state) => state.clearSelectedNodes)
  const clearFocusedNodes = useBoardStore((state) => state.clearFocusedNodes)
  
  // Use only props nodes - the store nodes are empty
  const nodes = propNodes || []
  
  // Get context nodes: prefer focus if present, else selection
  const contextIds = (focusedNodeIds && focusedNodeIds.length > 0) ? focusedNodeIds : selectedNodeIds
  const selectedNodes = nodes.filter(node => contextIds.includes(node.id))
  
  // Use the new AI placement system
  const { placeGeneratedNodes } = useAIPlacement()
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle send message with selected node context
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return

    const message = inputValue.trim()
    setInputValue('')
    // Close mobile keyboard by blurring the textarea
    if (inputRef.current) {
      inputRef.current.blur()
    } else if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    
    // Add selected node context to the message
    let contextualMessage = message
    const contextNodes = selectedNodes
    if (contextNodes.length > 0) {
      const nodeContext = contextNodes.map(node => {
        const title = node.data.title || 'Untitled Node'
        const content = node.data.content || ''
        return `Node: "${title}"${content ? `\nContent: ${content}` : ''}`
      }).join('\n\n')
      
      const label = `Selected ${contextNodes.length === 1 ? 'node' : 'nodes'}`

      contextualMessage = `Context - ${label}:\n${nodeContext}\n\nUser message: ${message}`
    }
    
    await sendMessageStream(contextualMessage)
  }

  // Handle node generation
  const handleGenerateNodes = async () => {
    if (!nodePrompt.trim() || isGeneratingNodes) return

    try {
      const result = await generateNodes({
        prompt: nodePrompt,
        count: nodeCount
      })

      if (onGenerateNode && result.nodes.length > 0) {
        // Generate a simple node from the first result
        const firstNode = result.nodes[0]
        onGenerateNode({
          label: firstNode.data.title || 'Generated Node',
          content: firstNode.data.content
        })
      }

      setNodePrompt('')
      setShowNodeGenerator(false)
      
      // Add a system message about the generation
      await sendMessage(`Generated ${result.nodes.length} nodes`)
    } catch (err) {
      console.error('Failed to generate nodes:', err)
    }
  }

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Detect structured content (numbered or bullet list lines)
  const hasStructuredContent = (content: string): boolean => {
    // Use multiline anchors to detect list markers at the beginning of lines
    const hasNumberedList = /^\s*\d+\.\s+/m.test(content)
    const hasBulletPoints = /^\s*[•\-*]\s+/m.test(content)
    return hasNumberedList || hasBulletPoints
  }

  // Extract points from content (supports inline "Title: content" on same line)
  const extractPoints = (content: string): { title: string; content: string }[] => {
    // Normalize: ensure a newline before the first numbered list if glued to text
    const normalized = content.replace(/([^\n])\s*(\d+\.\s)/g, '$1\n\n$2')
    const points: { title: string; content: string }[] = []
    const lines = normalized.split('\n')
    let currentPoint: { title: string; content: string } | null = null

    for (const line of lines) {
      // New point lines: "1. ..." or "* ..." or "- ..." or "• ..."
      const pointMatch = line.match(/^(\d+\.|[\*\-•])\s+(.+)/)
      if (pointMatch) {
        // Push previous accumulated point
        if (currentPoint) points.push(currentPoint)

        const rest = pointMatch[2].trim()

        // Try to split "**Title**: content" or "Title: content"
        let title = rest.replace(/\*\*/g, '').trim()
        let inlineContent = ''

        const boldInline = rest.match(/^\*\*(.+?)\*\*\s*:?\s*(.*)$/)
        const plainInline = !boldInline && rest.match(/^([^:]+):\s*(.*)$/)

        if (boldInline) {
          title = boldInline[1].trim()
          inlineContent = (boldInline[2] || '').trim()
        } else if (plainInline) {
          title = plainInline[1].replace(/\*\*/g, '').trim()
          inlineContent = (plainInline[2] || '').trim()
        }

        // Remove optional Node: prefix and quotes
        title = title.replace(/^Node:\s*"?|"?$/g, '').trim()

        currentPoint = { title, content: inlineContent }
        continue
      }

      // Accumulate additional description lines for the current point
      if (currentPoint) {
        const cleanedLine = line
          .replace(/^\s*-\s*\*\*Connection:\*\*.*$/i, '')
          .replace(/^\s*-\s*\*\*Content:\*\*\s*/i, '')
          .replace(/\*\*/g, '')
          .trim()

        if (cleanedLine) {
          currentPoint.content += (currentPoint.content ? '\n' : '') + cleanedLine
        }
      }
    }

    if (currentPoint) points.push(currentPoint)

    // De-duplicate by normalized title
    const seen = new Set<string>()
    const unique: { title: string; content: string }[] = []
    for (const p of points) {
      const key = p.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      if (key && !seen.has(key)) {
        seen.add(key)
        unique.push(p)
      }
    }
    return unique
  }

  // Sanitize assistant text for display: add missing line breaks and collapse duplicates
  const sanitizeForDisplay = (text: string): string => {
    let s = text
    // Ensure numbered lists start on a new paragraph when glued to previous sentence
    s = s.replace(/([^\n])(\s*)(\d+\.\s)/g, '$1\n\n$3')

    // Collapse full-body repeats (common model hiccup)
    if (s.length >= 120) {
      const third = Math.floor(s.length / 3)
      const head = s.slice(0, third)
      const tail = s.slice(third)
      if (tail.startsWith(head)) {
        // Strip subsequent repeats of the head
        while (s.endsWith(head + head)) {
          s = s.slice(0, s.length - head.length)
        }
      }
    }

    // De-duplicate adjacent paragraphs
    const paras = s.split(/\n\s*\n/)
    const out: string[] = []
    for (const p of paras) {
      const t = p.trim()
      if (!t) continue
      if (out.length === 0 || out[out.length - 1] !== t) {
        out.push(t)
      }
    }
    return out.join('\n\n')
  }

  // Generate nodes using our new intelligent placement system
  const handleGenerateNodesFromMessage = async (points: { title: string; content: string }[]) => {
    if (!selectedNodes.length) {
      console.warn('No selected node for AI generation')
      return
    }

    try {
      // Convert points to NodeToPlace format
      const nodesToPlace: NodeToPlace[] = points.map(point => ({
        title: point.title,
        content: point.content,
        type: 'default'
      }))

      // Use our intelligent placement system
      const result = await placeGeneratedNodes(nodesToPlace)
      
      if (result.success && result.placements.length > 0) {
        // Create nodes using the callback with intelligent positioning
        result.placements.forEach((placement, index) => {
          setTimeout(() => {
            onGenerateNode?.({
              id: placement.node.id,
              label: placement.node.data.title || 'Generated Node',
              content: placement.node.data.content,
              position: placement.position,
              referenceNode: {
                id: selectedNodes[0].id,
                title: selectedNodes[0].data.title || 'Reference Node'
              }
            })
          }, index * 50) // Stagger creation for smooth animation
        })
        
        console.log(`✨ Placed ${result.placements.length} nodes using ${result.metadata.algorithm} algorithm`)
        if (result.warnings.length > 0) {
          console.warn('Placement warnings:', result.warnings)
        }
      } else {
        console.error('Failed to place nodes:', result.warnings)
        // Fallback to basic placement
        points.forEach((point, index) => {
          setTimeout(() => {
            onGenerateNode?.({
              id: `ai-node-${Date.now()}-${index}`,
              label: point.title,
              content: point.content,
              position: { 
                x: selectedNodes[0].position.x + (index - points.length/2) * 200, 
                y: selectedNodes[0].position.y + 300 
              },
              referenceNode: {
                id: selectedNodes[0].id,
                title: selectedNodes[0].data.title || 'Reference Node'
              }
            })
          }, index * 50)
        })
      }
    } catch (error) {
      console.error('Error in intelligent node placement:', error)
      // Fallback to simple placement
      points.forEach((point, index) => {
        setTimeout(() => {
          onGenerateNode?.({
            id: `ai-node-${Date.now()}-${index}`,
            label: point.title,
            content: point.content,
            position: { 
              x: selectedNodes[0].position.x + (index - points.length/2) * 200, 
              y: selectedNodes[0].position.y + 300 
            },
            referenceNode: {
              id: selectedNodes[0].id,
              title: selectedNodes[0].data.title || 'Reference Node'
            }
          })
        }, index * 50)
      })
    }
  }

  return (
    <>
      {/* Toggle Button - Always rendered */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed right-4 z-40 bg-primary-600 text-white rounded-full p-3 shadow-lg hover:bg-primary-700 transition-all duration-200 ease-out bottom-4 sm:bottom-auto sm:top-16 ${
          isOpen 
            ? 'opacity-0 scale-95 pointer-events-none' 
            : 'opacity-100 scale-100'
        }`}
        title="Open Chat"
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      {/* Chat Panel - Always rendered with animation */}
      <div 
        className={`fixed top-16 right-4 rounded-4xl z-60 w-96 h-[calc(100dvh-80px)] bg-white/80 backdrop-blur-xs dark:bg-gray-900/80 shadow-xl flex flex-col transition-all duration-200 ease-out ${
          isOpen 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between py-2 px-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-2">
            <img src="/nobot.svg" alt="Nodal" width={24} height={24} className="opacity-90" />
            {/* <h3 className="font-semibold text-gray-900 dark:text-gray-100">Nodal AI</h3> */}
          </div>
          
          {/* AI Status Indicator */}
          <div className="flex items-center space-x-4">
            {aiInitialized ? (
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
            
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* AI Status Banner (when not initialized) */}
        {!aiInitialized && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 px-4 py-2">
            <div className="flex items-center space-x-2">
              <Key className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <p className="text-xs text-yellow-700 dark:text-yellow-300">
                AI is initializing... Check console for status
              </p>
            </div>
          </div>
        )}

        {/* Node Generator */}
        {showNodeGenerator && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Generate Nodes
                </label>
                <TextArea
                  value={nodePrompt}
                  onChange={(e) => setNodePrompt(e.target.value)}
                  placeholder="Describe the nodes you want to generate..."
                  rows={2}
                  fullWidth
                  className="resize-none"
                />
              </div>
              <div className="flex items-center space-x-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Count
                  </label>
                  <select
                    value={nodeCount}
                    onChange={(e) => setNodeCount(Number(e.target.value))}
                    className="p-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {[1, 2, 3, 4, 5].map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </div>
                <Button
                  onClick={handleGenerateNodes}
                  disabled={!nodePrompt.trim() || isGeneratingNodes}
                  loading={isGeneratingNodes}
                  className="flex-1 h-10"
                >
                  <Sparkles className="w-4 h-4 mr-1" />
                  Generate
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
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
                <button
                  onClick={clearError}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Selected Nodes Banner - Moved to right above input area */}
        {selectedNodes.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-t border-blue-200 dark:border-blue-800 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  {selectedNodes.length === 1 
                    ? `Selected: "${selectedNodes[0].data.title || 'Untitled Node'}"`
                    : `Selected: ${selectedNodes.length} nodes`
                  }
                </p>
              </div>
              <button
                onClick={() => {
                  clearSelectedNodes()
                  clearFocusedNodes()
                }}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex space-x-2">
            <TextArea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder={
                selectedNodes.length > 0
                  ? `Ask about ${selectedNodes.length === 1 ? 'this node' : 'these nodes'}...`
                  : "Ask me anything about your board..."
              }
              rows={1}
              fullWidth
              className="resize-none"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading || isStreaming}
              loading={isLoading || isStreaming}
              className="px-4"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Node Generator Toggle */}
          <div className="mt-2 flex justify-center">
            <button
              onClick={() => setShowNodeGenerator(!showNodeGenerator)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              {showNodeGenerator ? 'Hide' : 'Show'} Node Generator
            </button>
          </div>
        </div>
      </div>
    </>
  )
}