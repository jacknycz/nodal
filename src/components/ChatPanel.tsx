import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from 'pres-start-core'
import { MessageCircle, Minimize2, Send, Loader2, Plus, Sparkles, AlertCircle, GripVertical, StickyNote, HelpCircle, CheckCircle2, Zap, Code2, Lightbulb, X } from 'lucide-react'
import { useNodeAwareChat } from '../hooks/useNodeAwareChat'
import { useAIConfig } from '../features/ai/aiContext'
import type { NodeResponse } from '../types'
import nodalBlackLogo from '../assets/nodal-black.svg'
import { useBoardStore } from '../features/board/boardSlice';

interface ChatPanelProps {
  className?: string
  selectionContext?: string
  onSelectionContextUsed?: () => void
}

export default function ChatPanel({
  className = '',
  selectionContext,
  onSelectionContextUsed
}: ChatPanelProps) {
  const freeChatMode = useBoardStore(state => state.freeChatMode);
  const setFreeChatMode = useBoardStore(state => state.setFreeChatMode);
  const { messages, sendMessage, sendMessageWithSelection, applyNode, applyAllNodes, isLoading, error } = useNodeAwareChat({ freeChatMode });
  const { getConfigurationStatus, setAPIKey } = useAIConfig()
  const [currentMessage, setCurrentMessage] = useState('')
  const [isExpanded, setIsExpanded] = useState(true)
  const [panelHeight, setPanelHeight] = useState(384) // Default height: 384px (h-96)
  // For docked panel: top bar height (px)
  const topbarHeight = useBoardStore(state => state.topbarHeight || 48);
  // Panel width constraints
  const PANEL_MIN_WIDTH = 260;
  const PANEL_MAX_WIDTH = 800;
  const PANEL_DEFAULT_WIDTH = Math.min(window.innerWidth * 0.25, PANEL_MAX_WIDTH);
  const [panelWidth, setPanelWidth] = useState(Math.max(PANEL_MIN_WIDTH, Math.min(PANEL_DEFAULT_WIDTH, PANEL_MAX_WIDTH)));
  const [isOpen, setIsOpen] = useState(true); // manage open/minimized state internally

  // API Key setup state
  const [showAPIKeySetup, setShowAPIKeySetup] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState('')

  const chatRef = useRef<HTMLDivElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const apiKeyInputRef = useRef<HTMLInputElement>(null)
  const resizeRef = useRef<HTMLDivElement>(null)

  // Handle selection context
  const [hasProcessedSelection, setHasProcessedSelection] = useState(false)

  // Add local state to manage selection context if needed
  const [localSelectionContext, setLocalSelectionContext] = useState(selectionContext);
  useEffect(() => {
    setLocalSelectionContext(selectionContext);
  }, [selectionContext]);

  // Helper to remove a node from selection context
  const removeSelectionTitle = (title: string) => {
    if (!localSelectionContext) return;
    // Remove the node title from the markdown context string
    const regex = new RegExp(`\\*\\*${title.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\*\\*`, 'g');
    const updated = localSelectionContext.replace(regex, '').replace(/,\s*,/g, ',').replace(/^,|,$/g, '').replace(/\s+,/g, ',').replace(/,\s+/g, ',').replace(/\s{2,}/g, ' ').trim();
    if (updated.replace(/,/g, '').trim() === '') {
      // If no nodes left, clear selection
      onSelectionContextUsed?.();
      setLocalSelectionContext(undefined);
    } else {
      setLocalSelectionContext(updated);
    }
  };

  // Extract node titles from selectionContext for display and for apply logic
  const selectionTitles = localSelectionContext
    ? Array.from(localSelectionContext.matchAll(/\*\*(.*?)\*\*/g)).map(m => m[1])
    : [];

  // Process selection context when provided
  useEffect(() => {
    if (selectionContext && isOpen && !hasProcessedSelection && !showAPIKeySetup) {
      // setCurrentMessage('Tell me about these selected nodes and suggest ways to enhance or connect them.')
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
  }, [isOpen, isExpanded, showAPIKeySetup])

  // Handle resize functionality
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()

    const startY = e.clientY
    const startHeight = panelHeight

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY // Changed: removed the negative sign
      const newHeight = Math.max(200, Math.min(600, startHeight + deltaY)) // Min 200px, max 600px
      setPanelHeight(newHeight)
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [panelHeight])

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

  // Handle applying a node
  const handleApplyNode: (nodeResponse: NodeResponse, messageId: string, referencedNodeTitles?: string[]) => Promise<void> = useCallback(async (nodeResponse, messageId, referencedNodeTitles) => {
    try {
      await applyNode(nodeResponse, messageId, referencedNodeTitles)
    } catch (error) {
      console.error('Failed to apply node:', error)
    }
  }, [applyNode])

  // Handle applying all nodes
  const handleApplyAllNodes: (messageId: string, referencedNodeTitles?: string[]) => Promise<void> = useCallback(async (messageId, referencedNodeTitles) => {
    try {
      await applyAllNodes(messageId, referencedNodeTitles)
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
      note: <span title="Note"><StickyNote className="w-4 h-4" /></span>,
      question: <span title="Question"><HelpCircle className="w-4 h-4" /></span>,
      task: <span title="Task"><CheckCircle2 className="w-4 h-4" /></span>,
      action: <span title="Action"><Zap className="w-4 h-4" /></span>,
      code: <span title="Code"><Code2 className="w-4 h-4" /></span>,
      concept: <span title="Concept"><Lightbulb className="w-4 h-4" /></span>,
    };

    return (
      <div key={`${messageId}-${nodeResponse.title}`} className={`mt-3 p-2 rounded-lg border ${typeColors[nodeResponse.type]}`}>
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1">
            <span>{typeIcons[nodeResponse.type]}</span>
            <h4 className="font-semibold text-xs">{nodeResponse.title}</h4>
          </div>
          {!nodeResponse.apply && (
            <Button
              variant="default"
              size="sm"
              onClick={() => handleApplyNode(nodeResponse, messageId, selectionTitles)}
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

        <div className="text-xs text-gray-700 dark:text-gray-300">
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
  }, [handleApplyNode, selectionTitles])

  // Horizontal resize handle
  const handleHorizontalResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelWidth;
    function onMouseMove(moveEvent: MouseEvent) {
      const deltaX = startX - moveEvent.clientX;
      let newWidth = startWidth + deltaX;
      newWidth = Math.max(PANEL_MIN_WIDTH, Math.min(newWidth, PANEL_MAX_WIDTH));
      setPanelWidth(newWidth);
    }
    function onMouseUp() {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [panelWidth]);

  if (!isOpen) {
    // Minimized: show floating button
    return (
      <button
        className="fixed z-50 right-4 bg-primary-500 dark:bg-primary-500/80 rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-center p-3 transition-all duration-300 ease-in-out opacity-100 scale-100 hover:scale-110"
        style={{ top: `${topbarHeight + 8}px` }}
        aria-label="Open chat"
        onClick={() => setIsOpen(true)}
      >
        {/* <img src={nodalBlackLogo} alt="Nodal Logo" className="h-7 w-auto" /> */}
        <MessageCircle className="h-6 w-auto text-white" />
      </button>
    );
  }

  return (
    <div
      className={`fixed right-0 z-40 flex flex-col bg-white/90 dark:bg-gray-950/95 border-l border-gray-200 dark:border-gray-700 shadow-2xl transition-all duration-300 ease-in-out ${className}`}
      style={{
        top: `${topbarHeight}px`,
        height: `calc(100vh - ${topbarHeight}px)`,
        width: `${panelWidth}px`,
      }}
    >
      {/* Horizontal resize handle on the left edge */}
      <div
        className="absolute left-0 top-0 h-full w-2 cursor-ew-resize z-50 bg-primary-500 dark:bg-primary-500/20 flex items-center justify-center"
        onMouseDown={handleHorizontalResizeStart}
        style={{ transform: 'translateX(-100%)' }}
        aria-label="Resize chat panel"
      >
        <GripVertical className="text-primary-900 dark:text-primary-200 h-5 w-5" />
      </div>
      {/* Main flex column: messages area (flex-1) + input (flex-none) */}
      <div className="flex flex-col flex-1 min-h-0">

        {/* Messages area with floating minimize button */}
        <div className="relative flex-1 min-h-0 overflow-y-auto">
          <button
            className="absolute top-2 right-2 bg-gray-200 dark:bg-gray-700 rounded-full p-1 hover:bg-gray-300 dark:hover:bg-gray-600 z-50"
            aria-label="Minimize chat"
            onClick={() => setIsOpen(false)}
          >
            <svg width="20" height="20" fill="none" viewBox="0 0 20 20"><path d="M5 10h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
          {/* Messages */}
          <div
            ref={messagesRef}
            className="p-4 space-y-3"
          >
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] text-sm ${message.role === 'user'
                  ? 'bg-primary-600 dark:bg-primary-800 text-white rounded-lg px-3 py-2'
                  : 'bg-gray-100 dark:bg-gray-900/80 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2'
                  }`}>
                  <div
                    className="text-xs"
                    dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                  />
                  {/* Render structured node responses */}
                  {message.nodeResponses && message.nodeResponses.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {/* Apply all button */}
                      {message.nodeResponses.length > 1 && !message.allApplied && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyAllNodes(message.id, selectionTitles)}
                          className="mt-2 w-full text-xs"
                        >
                          <Plus size={12} className="mr-1" />
                          Apply All ({message.nodeResponses.length})
                        </Button>
                      )}
                      {message.nodeResponses.map((nodeResponse) =>
                        renderNodeResponse(nodeResponse, message.id)
                      )}
                      {/* Apply all button */}
                      {message.nodeResponses.length > 1 && !message.allApplied && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApplyAllNodes(message.id, selectionTitles)}
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
        </div>
        {/* Input area always at the bottom */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 flex-none">
         
          {/* Selection notification area */}
          {selectionTitles.length > 0 && isOpen && (
            <div className="mb-2 relative flex justify-between items-center bg-secondary-50 dark:bg-primary-900/20 border border-secondary-200 dark:border-primary-900 rounded px-3 py-1 text-xs text-secondary-800 dark:text-primary-200">
              <div className="flex items-center gap-2 w-full">
                {selectionTitles.length === 1 ? (
                  <div className="flex items-center gap-2 w-full">
                    <span>Selected:</span>
                    <span className="font-semibold relative w-full">
                      {selectionTitles[0]}
                      <button
                        className="ml-1 absolute -top-2 -right-4 w-4 h-4 flex items-center justify-center text-xs text-secondary-800 hover:text-red-500 bg-white dark:bg-primary-900/40 rounded-full border border-secondary-600 dark:border-primary-700 shadow"
                        style={{ fontSize: '10px', lineHeight: 1 }}
                        aria-label={`Remove ${selectionTitles[0]}`}
                        onClick={() => removeSelectionTitle(selectionTitles[0])}
                      >
                        <X className="w-2 h-2" />
                      </button>
                    </span>
                  </div>
                ) : selectionTitles.length === 2 ? (
                  <div className="flex items-center gap-2 w-full">
                    <span>Selected:</span>
                    <span className="font-semibold relative w-full">
                      {selectionTitles[0]}
                      <button
                        className="ml-1 absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center text-xs text-primary-400 hover:text-red-500 bg-white dark:bg-primary-900/40 rounded-full border border-primary-200 dark:border-primary-700 shadow"
                        style={{ fontSize: '10px', lineHeight: 1 }}
                        aria-label={`Remove ${selectionTitles[0]}`}
                        onClick={() => removeSelectionTitle(selectionTitles[0])}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                    <span>and</span>
                    <span className="font-semibold relative w-full">
                      {selectionTitles[1]}
                      <button
                        className="ml-1 absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center text-xs text-primary-400 hover:text-red-500 bg-white dark:bg-primary-900/40 rounded-full border border-primary-200 dark:border-primary-700 shadow"
                        style={{ fontSize: '10px', lineHeight: 1 }}
                        aria-label={`Remove ${selectionTitles[1]}`}
                        onClick={() => removeSelectionTitle(selectionTitles[1])}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 w-full">
                    <span>{selectionTitles.length} nodes selected</span>
                    <span
                      className="font-mono cursor-pointer underline decoration-dotted"
                      title={selectionTitles.join(', ')}
                    >
                      (hover to see titles)
                    </span>
                    {selectionTitles.map((title, idx) => (
                      <span key={title} className="font-semibold relative ml-2">
                        {title}
                        <button
                          className="ml-1 absolute -top-2 -right-2 w-4 h-4 flex items-center justify-center text-xs text-primary-400 hover:text-red-500 bg-white dark:bg-primary-900/40 rounded-full border border-primary-200 dark:border-primary-700 shadow"
                          style={{ fontSize: '10px', lineHeight: 1 }}
                          aria-label={`Remove ${title}`}
                          onClick={() => removeSelectionTitle(title)}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Free Chat Mode Toggle */}
           <div className="flex items-center gap-2 pb-2 justify-end group relative">
             <span className="text-xs font-medium text-gray-500 dark:text-primary-100 cursor-pointer">Free Chat Mode</span>
             <button
               onClick={() => setFreeChatMode(!freeChatMode)}
               className={`relative cursor-pointer inline-flex h-4 w-6 items-center rounded-full transition-all duration-300 focus:outline-none ${freeChatMode
                   ? 'bg-primary-700 hover:bg-primary-500'
                   : 'bg-gray-300 hover:bg-gray-200'
                 }`}
               aria-label={`Free Chat Mode is ${freeChatMode ? 'on' : 'off'}. Click to toggle.`}
               type="button"
             >
               <span
                 className={`inline-block h-2 w-2 transform rounded-full bg-white dark:bg-black transition-all duration-300 ease-in-out ${freeChatMode ? 'translate-x-3' : 'translate-x-1'
                   }`}
               />
             </button>
             {/* Tooltip */}
             <span className="absolute bottom-full right-0 mb-2 w-64 bg-gray-900 text-white text-xs rounded px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50 shadow-lg">
               Free chat mode is just that - chat about the board without a focus on creating nodes.
             </span>
           </div>

          {/* Input area always at the bottom */}
          <div className="flex items-end space-x-2 h-auto">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                placeholder="Hey! Ask me anything..."
                className="w-full z-20 relative text-xs placeholder:text-gray-500 min-h-12 dark:placeholder:text-gray-500 text-gray-900 dark:text-gray-100 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                rows={3}
                disabled={isLoading}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!currentMessage.trim() || isLoading}
              variant="custom"
              className="bg-primary-500 dark:bg-primary-600 text-white px-4 py-2 mb-1.5 rounded-lg disabled:opacity-50 self-stretch"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>
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
                placeholder="sk-..."
                className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
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
              className="w-full bg-primary-500 hover:bg-primary-600 text-white disabled:opacity-50"
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