'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useUnifiedAI } from '../features/ai/useUnifiedAI'
import { useAIContext } from '../features/ai/aiContext'
import { useBoardStore } from '../features/board/boardSlice'
import { useAIPlacement } from '../features/board/usePlacement'
import { Send, X, Bot, Sparkles, MessageSquare, Loader2, Key, Target } from 'lucide-react'
import TextArea from './ui/TextArea'
import Button from './ui/Button'
import Modal from './ui/Modal'
import Checkbox from './ui/Checkbox'
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
  const setSelectedNodes = useBoardStore((state) => state.setSelectedNodes)

  // Explicit create intent state
  const [showCreateConfirm, setShowCreateConfirm] = useState(false)
  const [pendingCreateNodes, setPendingCreateNodes] = useState<{ title: string; content: string; selected: boolean }[]>([])
  const [pendingParentId, setPendingParentId] = useState<string | null>(null)
  
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
    
    // Detect explicit create intent
    const intent = parseCreateIntent(message)

    if (intent) {
      // Resolve parent: selected node or by name
      let parentId: string | null = null
      if (intent.parent === 'this' && selectedNodes.length > 0) {
        parentId = selectedNodes[0].id
      } else if (intent.parentName) {
        const match = nodes.find(n => (n.data.title || '').toLowerCase() === intent.parentName!.toLowerCase())
        if (match) parentId = match.id
      } else if (selectedNodes.length > 0) {
        parentId = selectedNodes[0].id
      }

      // If still no parent, fall back to selected if available
      if (!parentId && selectedNodes.length > 0) parentId = selectedNodes[0].id

      // Build candidate nodes either from explicit list or via AI generation
      let points: { title: string; content: string }[] = []
      if (intent.titles && intent.titles.length > 0) {
        points = intent.titles.map(t => ({ title: t, content: '' }))
      } else {
        // Default topic/count if not provided: use selected node title and a sensible count
        const effectiveTopic = intent.topic || (selectedNodes[0]?.data?.title || undefined)
        const effectiveCount = intent.count || 5
        if (effectiveTopic) {
        try {
          const result = await generateNodes({
            prompt: effectiveTopic,
            count: effectiveCount,
            context: { existingNodes: nodes }
          })
          points = (result.nodes || []).map((n: any) => ({ title: n.data?.title || 'New Node', content: n.data?.content || '' }))
        } catch {
          points = []
        }
        }
      }

      if (points.length > 0 && parentId) {
        setPendingParentId(parentId)
        setPendingCreateNodes(points.slice(0, 10).map(p => ({ ...p, selected: true })))
        setShowCreateConfirm(true)
        return
      }
      // If intent but insufficient info, fall through to normal chat
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

  // Parse explicit create/add intent from user input
  function parseCreateIntent(input: string): null | {
    titles?: string[]
    count?: number
    topic?: string
    parent?: 'this'
    parentName?: string
  } {
    const text = input.trim()
    const intentRegex = /^(create|add|help\s+me\s+add)\b/i
    if (!intentRegex.test(text)) return null

    // Look for explicit list after ':' or 'nodes:'
    const listMatch = text.match(/(?:nodes?:)?\s*:(.*)$/i)
    let titles: string[] | undefined
    if (listMatch && listMatch[1]) {
      titles = listMatch[1]
        .split(/[,\n]/)
        .map(s => s.trim())
        .filter(Boolean)
        .slice(0, 20)
    }

    // Count
    const countMatch = text.match(/\b(\d{1,2})\b/)
    const count = titles ? undefined : (countMatch ? Number(countMatch[1]) : undefined)

    // Parent
    let parent: 'this' | undefined
    let parentName: string | undefined
    const underThis = /\bunder\s+(this)\b/i
    const underName = /\bunder\s+"?([^"\n]+?)"?\b/i
    if (underThis.test(text)) parent = 'this'
    const nameMatch = text.match(underName)
    if (nameMatch && nameMatch[1] && nameMatch[1].toLowerCase() !== 'this') parentName = nameMatch[1].trim()

    // Topic (fallback): try to extract phrase after 'about' or after the verb
    let topic: string | undefined
    const aboutMatch = text.match(/\babout\s+([^:]+?)(?:\s+under\b|$)/i)
    if (aboutMatch && aboutMatch[1]) topic = aboutMatch[1].trim()

    return { titles, count, topic, parent, parentName }
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
    const hasHeaders = /\*\*(.+?)\*\*\s*(\-|—|–|:)\s*/m.test(content)
    return hasNumberedList || hasBulletPoints || hasHeaders
  }

  // Extract points from content (supports inline "Title: content" on same line)
  const extractPoints = (content: string): { title: string; content: string }[] => {
    // Normalize: ensure a newline before the first numbered list if glued to previous text
    let normalized = content.replace(/([^\n])\s*(\d+\.\s)/g, '$1\n\n$2')
    // Fix glued words like "Magellanic PenguinYou" → "Magellanic Penguin You"
    normalized = normalized.replace(/([a-z])([A-Z])/g, '$1 $2')

    // Remove repeated intro lines like "Sure! Here are ..."
    normalized = normalized
      .split('\n')
      .filter(line => !/^\s*Sure!\b/i.test(line))
      .join('\n')

    const points: { title: string; content: string }[] = []
    const lines = normalized.split('\n')
    let currentPoint: { title: string; content: string } | null = null

    for (const rawLine of lines) {
      const line = rawLine.trim()
      // New point lines: "1. ..." or "* ..." or "- ..." or "• ..."
      const pointMatch = line.match(/^(\d+\.|[\*\-•])\s+(.+)/)
      if (pointMatch) {
        if (currentPoint) points.push(currentPoint)

        const restOriginal = pointMatch[2].trim()
        const rest = restOriginal.replace(/([a-z])([A-Z])/g, '$1 $2')

        // Try to split "**Title**: content" or "Title: content" or "**Title** — content"
        let title = rest.replace(/\*\*/g, '').trim()
        let inlineContent = ''

        const boldInline = rest.match(/^\*\*(.+?)\*\*\s*[:—–-]?\s*(.*)$/)
        const plainInline = !boldInline && rest.match(/^([^:—–-]+)\s*[:—–-]\s*(.*)$/)

        if (boldInline) {
          title = boldInline[1].trim()
          inlineContent = (boldInline[2] || '').trim()
        } else if (plainInline) {
          title = plainInline[1].replace(/\*\*/g, '').trim()
          inlineContent = (plainInline[2] || '').trim()
        } else {
          // If commentary begins (e.g., "You can ..."), strip it from the title
          const commentaryIdx = rest.search(/\b(You|Each|These|This|They)\b/)
          if (commentaryIdx > 0) {
            title = rest.slice(0, commentaryIdx).trim()
          }
        }

        // Remove optional Node: prefix/quotes and trailing punctuation
        title = title.replace(/^Node:\s*"?|"?$/g, '').replace(/[.,;:]+$/, '').trim()

        currentPoint = { title, content: inlineContent }
        continue
      }

      // Accumulate description lines; skip generic commentary lines
      if (currentPoint) {
        const trimmed = line.trim()
        if (/^(You can|Each of|These|This|They)\b/i.test(trimmed)) {
          continue
        }
        const cleanedLine = trimmed
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
              id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
                ? `ai-node-${crypto.randomUUID()}`
                : `ai-node-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
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
            id: (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
              ? `ai-node-${crypto.randomUUID()}`
              : `ai-node-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
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
        <div className="flex items-center justify-between py-2 px-4 shadow-lg shadow-gray-400/10 dark:shadow-none">
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4 shadow-[inset_0_-4px_6px_-1px_rgba(156,163,175,0.1)] dark:shadow-none">
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
                <p className="text-sm whitespace-pre-wrap">{message.role === 'assistant' ? sanitizeForDisplay(message.content) : message.content}</p>
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

        {/* Explicit create confirmation modal */}
        <Modal
          open={showCreateConfirm}
          onClose={() => { setShowCreateConfirm(false); setPendingCreateNodes([]); setPendingParentId(null) }}
          title="Create nodes"
          description={pendingParentId ? 'Review and confirm the nodes to create.' : 'Select a parent node and confirm.'}
        >
          <div className="max-h-64 overflow-auto mt-2 space-y-2">
            {pendingCreateNodes.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 border border-gray-200 dark:border-gray-700 rounded px-2 py-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={p.selected}
                    onChange={(checked) => {
                      setPendingCreateNodes(prev => prev.map((n, i) => i === idx ? { ...n, selected: !!checked } : n))
                    }}
                    label={p.title || '(untitled)'}
                    labelTextClassName="text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="secondary" onClick={() => { setShowCreateConfirm(false); setPendingCreateNodes([]); setPendingParentId(null) }}>Cancel</Button>
            <Button
              onClick={() => {
                const toCreate = pendingCreateNodes.filter(n => n.selected).map(n => ({ title: n.title, content: n.content }))
                if (toCreate.length > 0 && pendingParentId) {
                  // Ensure placement uses the intended parent
                  setSelectedNodes([pendingParentId])
                  handleGenerateNodesFromMessage(toCreate)
                }
                setShowCreateConfirm(false)
                setPendingCreateNodes([])
                setPendingParentId(null)
              }}
            >
              Create {pendingCreateNodes.filter(n => n.selected).length} nodes
            </Button>
          </div>
        </Modal>

        {/* Selected Nodes Banner - Moved to right above input area */}
        {selectedNodes.length > 0 && (
          <div className="bg-blue-50 dark:bg-primary-900/20 px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Target className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <p className="text-xs text-primary-700 dark:text-primary-300">
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