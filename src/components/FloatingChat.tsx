import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from 'pres-start-core'
import { MessageCircle, Minimize2, Maximize2, Send, Loader2, Command, Key, AlertCircle } from 'lucide-react'
import { useChat } from '../hooks/useChat'
import { useAIConfig } from '../features/ai/aiContext'

export default function FloatingChat() {
  const { messages, sendMessage, isLoading, error } = useChat()
  const { getConfigurationStatus, setAPIKey } = useAIConfig()
  const [currentMessage, setCurrentMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(false) // Start minimized
  const [position, setPosition] = useState({ 
    x: 20, // Top-left corner
    y: 100 // Below the topbar/logo
  })
  const [size, setSize] = useState({ width: 400, height: 600 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
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

  // Check AI configuration status
  const configStatus = getConfigurationStatus()
  const needsSetup = !configStatus.configured || !configStatus.hasAPIKey

  // Show setup screen if needed
  useEffect(() => {
    if (isExpanded && needsSetup) {
      setShowAPIKeySetup(true)
    } else {
      setShowAPIKeySetup(false)
    }
  }, [isExpanded, needsSetup])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesRef.current && isExpanded) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, isExpanded])

  // Focus input when panel opens
  useEffect(() => {
    if (isExpanded) {
      if (showAPIKeySetup && apiKeyInputRef.current) {
        apiKeyInputRef.current.focus()
      } else if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }, [isExpanded, showAPIKeySetup])

  // Handle window resize to keep chat in bounds
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => ({
        x: Math.min(prev.x, window.innerWidth - size.width),
        y: Math.min(prev.y, window.innerHeight - (isExpanded ? size.height : 80))
      }))
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [size, isExpanded])

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

  // Handle API key input key press
  const handleAPIKeyKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAPIKeySubmit()
    }
  }, [handleAPIKeySubmit])

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
    if (isResizing) {
      setSize({
        width: Math.max(300, e.clientX - dragOffset.x),
        height: Math.max(400, e.clientY - dragOffset.y)
      })
    }
  }, [isDragging, isResizing, dragOffset])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp])

  // Handle sending messages
  const handleSendMessage = useCallback(async () => {
    if (!currentMessage.trim() || isLoading) return

    try {
      await sendMessage(currentMessage.trim())
      setCurrentMessage('')
    } catch (error) {
      console.error('Chat error:', error)
    }
  }, [currentMessage, isLoading, sendMessage])

  // Handle key press
  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }, [handleSendMessage])

  // Format message content (basic markdown)
  const formatMessage = useCallback((content: string) => {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">$1</code>')
      .replace(/\n/g, '<br>')
  }, [])

  return (
    <div
      ref={chatRef}
      className="fixed z-50 bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 transition-all duration-200 ease-in-out"
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
        <div className="flex items-center space-x-2">
          <MessageCircle size={20} />
          <span className="font-semibold">
            {showAPIKeySetup ? '🔑 Setup Required' : '🦸‍♂️ Superman AI'}
          </span>
          {!isExpanded && messages.length > 0 && (
            <span className="ml-2 bg-white/20 text-xs px-2 py-1 rounded-full">
              {messages.length}
            </span>
          )}
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title={isExpanded ? 'Minimize' : 'Maximize'}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="flex flex-col relative" style={{ height: size.height - 60 }}>
          {showAPIKeySetup ? (
            /* API Key Setup */
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="text-center">
                <Key className="w-12 h-12 mx-auto text-blue-500 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  OpenAI API Key Required
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  To use Superman AI, you need to configure your OpenAI API key. Your key is stored locally and never shared.
                </p>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  OpenAI API Key
                </label>
                <input
                  ref={apiKeyInputRef}
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  onKeyPress={handleAPIKeyKeyPress}
                  placeholder="sk-..."
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={setupLoading}
                />

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

                <div className="text-xs text-gray-500 dark:text-gray-400">
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
          ) : (
            /* Chat Interface */
            <>
              <div
                ref={messagesRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0"
              >
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-blue-500 text-white'
                          : message.role === 'system'
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-l-4 border-blue-500'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      <div
                        className="text-sm"
                        dangerouslySetInnerHTML={{
                          __html: formatMessage(message.content)
                        }}
                      />
                      <div className="text-xs opacity-70 mt-1">
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
                        Superman is thinking...
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
                      placeholder="Ask me anything... (Try /help for commands)"
                      className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      rows={1}
                      style={{ minHeight: '40px', maxHeight: '120px' }}
                      disabled={isLoading}
                    />
                    <div className="absolute bottom-1 right-1 text-xs text-gray-400">
                      <Command size={12} className="inline mr-1" />
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

          {/* Resize handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-400 dark:bg-gray-600 opacity-50 hover:opacity-100 transition-opacity"
            onMouseDown={(e) => {
              e.preventDefault()
              setIsResizing(true)
              setDragOffset({
                x: e.clientX - size.width,
                y: e.clientY - size.height
              })
            }}
          />
        </div>
      )}
    </div>
  )
} 