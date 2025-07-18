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

interface ChatPanelProps {
  isOpen?: boolean
  onClose?: () => void
  className?: string
  selectionContext?: string
  onSelectionContextUsed?: () => void
}

export default function ChatPanel({ 
  isOpen = false, 
  onClose,
  className = '',
  selectionContext,
  onSelectionContextUsed
}: ChatPanelProps) {
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

  // Minimized state: show only chat icon button
  if (!isExpanded) {
    return (
      <button
        className="fixed z-50 bg-primary-500 rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-center p-3  transition-colors"
        style={{ left: position.x, top: position.y }}
        aria-label="Open chat"
        onClick={() => setIsExpanded(true)}
      >
        <MessageCircle size={28} className="text-white" />
      </button>
    )
  }

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
        className="drag-handle flex items-center justify-between p-3 bg-primary-500 text-white rounded-t-lg cursor-move"
        onMouseDown={handleMouseDown} 
      >
        <div className="flex items-center gap-2">
          <MessageCircle size={18} />
          <span className="font-medium">🧠 AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="custom"
            onClick={() => setIsExpanded(false)}
            className="text-white hover:bg-white/20"
            title="Close chat"
          >
            <Minimize2 size={14} />
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
                    <div className="mt-3 space-y-2">
                      {message.nodeResponses.map((nodeResponse) => 
                        renderNodeResponse(nodeResponse, message.id)
                      )}
                      
                      {/* Apply all button */}
                      {message.nodeResponses.length > 1 && !message.allApplied && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyAllNodes(message.id)}
                          className="mt-2 w-full text-xs"
                        >
                          <Plus size={12} className="mr-1" />
                          Apply All ({message.nodeResponses.length})
                        </Button>
                      )}
                    </div>
                  )}
                  
                  <div className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-lg flex items-center space-x-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    AI is thinking...
                  </span>
                </div>
              </div>
            )}
            
            {error && (
              <div className="flex justify-start">
                <div className="bg-red-100 dark:bg-red-900 border border-red-400 p-3 rounded-lg flex items-center space-x-2">
                  <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
                  <span className="text-sm text-red-600 dark:text-red-400">
                    {error}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-end space-x-2">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={currentMessage}
                  onChange={(e) => setCurrentMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Hey! Ask me anything..."
                  className="w-full placeholder:text-gray-500 min-h-12 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  rows={1}
                  // style={{ minHeight: '40px', maxHeight: '120px' }}
                  disabled={isLoading}
                />
                <div className="absolute bottom-1 right-3 text-xs text-gray-400">
                  Enter to send
                </div>
              </div>
              
              <Button
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || isLoading}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg disabled:opacity-50"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </>
      )}

      {/* API Key Setup Modal */}
      {showAPIKeySetup && (
        <div className="absolute inset-0 bg-white dark:bg-gray-900 rounded-lg p-6 flex flex-col justify-center">
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              OpenAI API Key Required
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              To use the AI assistant, you need to configure your OpenAI API key. Your key is stored locally and never shared.
            </p>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                OpenAI API Key
              </label>
              <input
                ref={apiKeyInputRef}
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAPIKeySubmit()}
                placeholder="sk-..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={setupLoading}
              />
            </div>

            {setupError && (
              <div className="flex items-center space-x-2 text-red-600 dark:text-red-400 text-sm">
                <AlertCircle size={16} />
                <span>{setupError}</span>
              </div>
            )}

            <Button
              onClick={handleAPIKeySubmit}
              disabled={!apiKeyInput.trim() || setupLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50"
            >
              {setupLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Configuring...</span>
                </div>
              ) : (
                'Configure API Key'
              )}
            </Button>

            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              <p className="mb-2">🔒 Your API key is stored securely in your browser and never sent to our servers.</p>
              <p>
                Need an API key? Get one from{' '}
                <a 
                  href="https://platform.openai.com/api-keys" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-600 underline"
                >
                  OpenAI Platform
                </a>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 