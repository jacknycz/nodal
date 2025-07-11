import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from 'pres-start-core'
import { MessageCircle, X, Minimize2, Maximize2, Send, Loader2, Plus, Sparkles, AlertCircle } from 'lucide-react'
import { useNodeAwareChat } from '../hooks/useNodeAwareChat'
import { useAIConfig } from '../features/ai/aiContext'
import type { NodeResponse, ConnectionSuggestion } from '../types'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  nodeResponses?: NodeResponse[]
  connectionSuggestions?: ConnectionSuggestion[]
  allApplied?: boolean
  metadata?: {
    tokens?: number
    processingTime?: number
  }
}

interface NodeAwareChatPanelProps {
  isOpen?: boolean
  onClose?: () => void
  onToggleMode?: () => void
  className?: string
  selectionContext?: string
  onSelectionContextUsed?: () => void
}

export default function NodeAwareChatPanel({ 
  isOpen = false, 
  onClose,
  onToggleMode,
  className = '',
  selectionContext,
  onSelectionContextUsed
}: NodeAwareChatPanelProps) {
  const { messages, sendMessage, sendMessageWithSelection, applyNode, applyAllNodes, isLoading, error } = useNodeAwareChat()
  const { getConfigurationStatus, setAPIKey } = useAIConfig()
  const [currentMessage, setCurrentMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [position, setPosition] = useState({ x: 20, y: 100 })
  const [size, setSize] = useState({ width: 450, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  // API Key setup state
  const [showAPIKeySetup, setShowAPIKeySetup] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState('')
  
  const chatRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const apiKeyInputRef = useRef<HTMLInputElement>(null)
  
  // Handle selection context
  const [hasProcessedSelection, setHasProcessedSelection] = useState(false)
  
  // Process selection context when provided
  useEffect(() => {
    if (selectionContext && isOpen && !hasProcessedSelection && !showAPIKeySetup) {
      setCurrentMessage('Tell me about these selected nodes and suggest ways to enhance or connect them.')
      setHasProcessedSelection(true)
    }
  }, [selectionContext, isOpen, hasProcessedSelection, showAPIKeySetup])
  
  // Reset selection processing when panel closes
  useEffect(() => {
    if (!isOpen) {
      setHasProcessedSelection(false)
    }
  }, [isOpen])

  // Check AI configuration status
  const configStatus = getConfigurationStatus()
  const needsSetup = !configStatus.configured || !configStatus.hasAPIKey

  // Show setup screen if needed
  useEffect(() => {
    if (isOpen && needsSetup) {
      setShowAPIKeySetup(true)
    } else {
      setShowAPIKeySetup(false)
    }
  }, [isOpen, needsSetup])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages])

  // Focus input when panel opens or selection changes
  useEffect(() => {
    if (isOpen && isExpanded && !showAPIKeySetup && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen, isExpanded, showAPIKeySetup, selectionContext])

  // Handle dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('drag-handle')) {
      setIsDragging(true)
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      })
    }
  }, [position])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }
  }, [isDragging, dragOffset])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // Handle API key setup
  const handleAPIKeySubmit = useCallback(async () => {
    if (!apiKeyInput.trim()) {
      setSetupError('Please enter your OpenAI API key')
      return
    }

    setSetupLoading(true)
    setSetupError('')

    try {
      const success = await setAPIKey(apiKeyInput.trim())
      
      if (success) {
        setApiKeyInput('')
        setShowAPIKeySetup(false)
      } else {
        setSetupError('Invalid API key format. Please check your key and try again.')
      }
    } catch (error) {
      setSetupError('Failed to configure API key. Please try again.')
      console.error('API key setup error:', error)
    } finally {
      setSetupLoading(false)
    }
  }, [apiKeyInput, setAPIKey])

  // Handle sending messages
  const handleSendMessage = useCallback(async () => {
    if (!currentMessage.trim() || isLoading) return

    try {
      // Use selection context if available
      if (selectionContext) {
        await sendMessageWithSelection(currentMessage.trim(), selectionContext)
        onSelectionContextUsed?.()
      } else {
        await sendMessage(currentMessage.trim())
      }
      setCurrentMessage('')
    } catch (error) {
      console.error('Chat error:', error)
    }
  }, [currentMessage, isLoading, sendMessage, sendMessageWithSelection, selectionContext, onSelectionContextUsed])

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  // Handle applying a node
  const handleApplyNode = useCallback(async (nodeResponse: NodeResponse, messageId: string) => {
    try {
      await applyNode(nodeResponse, messageId)
    } catch (error) {
      console.error('Failed to apply node:', error)
    }
  }, [applyNode])

  // Handle applying all nodes
  const handleApplyAllNodes = useCallback(async (messageId: string) => {
    try {
      await applyAllNodes(messageId)
    } catch (error) {
      console.error('Failed to apply all nodes:', error)
    }
  }, [applyAllNodes])

  // Format message content
  const formatMessage = useCallback((content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">$1</code>')
      .replace(/\n/g, '<br>')
  }, [])

  // Render a node response card
  const renderNodeResponse = useCallback((nodeResponse: NodeResponse, messageId: string) => {
    const typeColors = {
      note: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700',
      question: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-700',
      task: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-700',
      action: 'bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-700',
      code: 'bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-700',
      concept: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-700'
    }

    const typeIcons = {
      note: '📝',
      question: '❓',
      task: '✅',
      action: '⚡',
      code: '💻',
      concept: '💡'
    }

    return (
      <div key={`${messageId}-${nodeResponse.title}`} className={`mt-3 p-3 rounded-lg border ${typeColors[nodeResponse.type]}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{typeIcons[nodeResponse.type]}</span>
            <h4 className="font-semibold text-sm">{nodeResponse.title}</h4>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {nodeResponse.type}
            </span>
          </div>
          {!nodeResponse.apply && (
            <Button
              variant="default"
              size="sm"
              onClick={() => handleApplyNode(nodeResponse, messageId)}
              className="flex items-center gap-1 text-xs"
            >
              <Plus size={12} />
              Apply
            </Button>
          )}
          {nodeResponse.apply && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <Sparkles size={12} />
              Applied
            </span>
          )}
        </div>
        
        <div className="text-sm text-gray-700 dark:text-gray-300 mb-2">
          {nodeResponse.content}
        </div>
        
        {nodeResponse.metadata?.tags && nodeResponse.metadata.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {nodeResponse.metadata.tags.map((tag: string, index: number) => (
              <span key={index} className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    )
  }, [handleApplyNode])

  if (!isOpen) return null

  if (showAPIKeySetup) {
    return (
      <div
        className={`fixed z-50 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 ${className}`}
        style={{
          left: position.x,
          top: position.y,
          width: size.width,
          height: 400
        }}
      >
        <div className="p-6 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">🧠 Node-Aware Mode Setup</h3>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
          
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center mb-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Enter your OpenAI API key to enable conversational node creation
              </p>
            </div>
            
            <div className="space-y-4">
              <input
                ref={apiKeyInputRef}
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAPIKeySubmit()}
                placeholder="sk-..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              
              {setupError && (
                <div className="text-red-600 dark:text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={14} />
                  {setupError}
                </div>
              )}
              
              <Button
                onClick={handleAPIKeySubmit}
                disabled={setupLoading || !apiKeyInput.trim()}
                className="w-full"
              >
                {setupLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin mr-2" />
                    Configuring...
                  </>
                ) : (
                  'Configure AI'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Extract node titles from selectionContext for display
  const selectionTitles = selectionContext
    ? Array.from(selectionContext.matchAll(/\*\*(.*?)\*\*/g)).map(m => m[1])
    : []

  return (
    <div
      ref={chatRef}
      className={`fixed z-50 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 ${className}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isExpanded ? size.height : 'auto'
      }}
    >
      {/* Header */}
      <div 
        className="drag-handle flex items-center justify-between p-3 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-t-lg cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={18} />
          <span className="font-medium">🧠 Node-Aware Mode</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white hover:bg-white/20"
            title={isExpanded ? "Minimize" : "Maximize"}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </Button>
          {onToggleMode && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleMode}
              className="text-white hover:bg-white/20"
              title="Switch to Superman mode"
            >
              🦸‍♂️
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/20"
            title="Close chat"
          >
            <X size={14} />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Messages */}
          <div
            ref={messagesRef}
            className="flex-1 overflow-y-auto p-4 space-y-3"
            style={{ height: size.height - 140 }}
          >
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] ${
                  message.role === 'user' 
                    ? 'bg-blue-500 text-white rounded-lg px-3 py-2'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2'
                }`}>
                  <div 
                    className="text-sm"
                    dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                  />
                  
                  {/* Render structured node responses */}
                  {message.nodeResponses && message.nodeResponses.length > 0 && (
                    <>
                      {/* Show Apply All button for multi-node messages */}
                      {message.nodeResponses.length > 1 && !message.allApplied && (
                        <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🌟</span>
                              <span className="font-semibold text-sm">
                                {message.nodeResponses.length} Connected Nodes Ready
                              </span>
                              {message.connectionSuggestions && message.connectionSuggestions.length > 0 && (
                                <span className="text-xs bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded-full text-blue-700 dark:text-blue-300">
                                  +{message.connectionSuggestions.length} connections
                                </span>
                              )}
                            </div>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleApplyAllNodes(message.id)}
                              className="flex items-center gap-1 text-xs bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                            >
                              <Sparkles size={12} />
                              Apply All
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Show applied message for multi-node */}
                      {message.nodeResponses.length > 1 && message.allApplied && (
                        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">✨</span>
                            <span className="text-sm font-semibold text-green-700 dark:text-green-300">
                              All {message.nodeResponses.length} nodes and connections applied!
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Individual node cards */}
                      {message.nodeResponses.map((nodeResponse) =>
                        renderNodeResponse(nodeResponse, message.id)
                      )}
                    </>
                  )}
                  
                  {/* Render connection suggestions */}
                  {message.connectionSuggestions && message.connectionSuggestions.length > 0 && (
                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-700 rounded-lg">
                      <div className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1">
                        🔗 Connections Created:
                      </div>
                      {message.connectionSuggestions.map((conn, idx) => (
                        <div key={idx} className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-2 mb-1">
                          <span className="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded text-blue-800 dark:text-blue-200">
                            {conn.source}
                          </span>
                          <span>→</span>
                          <span className="font-mono bg-blue-100 dark:bg-blue-800 px-1 rounded text-blue-800 dark:text-blue-200">
                            {conn.target}
                          </span>
                          {conn.reason && (
                            <span className="text-blue-500 dark:text-blue-400 italic">
                              ({conn.reason})
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {message.metadata?.processingTime && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {message.metadata.processingTime}ms
                      {message.metadata.tokens && ` • ${message.metadata.tokens} tokens`}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Analyzing for node potential...</span>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-700">
              <div className="text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
                <AlertCircle size={14} />
                {error}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            {/* Selection notification area */}
            {selectionContext && isOpen && (
              <div className="mb-2 flex justify-between items-center bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded px-3 py-1 text-xs text-blue-800 dark:text-blue-200">
                <div className="flex items-center gap-2">
                  {selectionTitles.length === 1 ? (
                    <>
                      <span>Asking about:</span>
                      <span className="font-semibold">{selectionTitles[0]}</span>
                    </>
                  ) : (
                    <>
                      <span>Asking about {selectionTitles.length} nodes</span>
                      <span
                        className="font-mono cursor-pointer underline decoration-dotted"
                        title={selectionTitles.join(', ')}
                      >
                        (hover to see titles)
                      </span>
                    </>
                  )}
                </div>
                {/* Clear selection context button */}
                <button
                  onClick={onSelectionContextUsed}
                  className="ml-2 p-1 rounded hover:bg-blue-100 dark:hover:bg-blue-800 transition"
                  title="Remove selection context"
                  type="button"
                >
                  <span className="sr-only">Remove selection context</span>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
                    <path d="M6 6l8 8M6 14L14 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything - I'll suggest structured nodes you can apply..."
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                rows={2}
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !currentMessage.trim()}
                className="px-3"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  )
} 