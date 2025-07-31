'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useUnifiedAI } from '../features/ai/useUnifiedAI'
import { useAIContext } from '../features/ai/aiContext'
import { useBoardStore } from '../features/board/boardSlice'
import { Send, X, Bot, Sparkles, MessageSquare, Loader2, Key, Target } from 'lucide-react'
import type { BoardNode } from '../features/board/boardTypes'

interface ChatPanelProps {
  onGenerateNode?: (nodeData: { label: string; content?: string }) => void
  nodes?: BoardNode[]
}

export default function ChatPanel({ 
  onGenerateNode,
  nodes: propNodes
}: ChatPanelProps) {
  const [isOpen, setIsOpen] = useState(true) // Keep it open by default
  const [inputValue, setInputValue] = useState('')
  const [showNodeGenerator, setShowNodeGenerator] = useState(false)
  const [nodePrompt, setNodePrompt] = useState('')
  const [nodeCount, setNodeCount] = useState(3)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  
  const {
    messages,
    sendMessage,
    generateNodes,
    isLoading,
    isGeneratingNodes,
    error,
    clearError
  } = useUnifiedAI()

  const aiContext = useAIContext()
  
  // Get selected nodes from board store
  const selectedNodeIds = useBoardStore((state) => state.selectedNodeIds)
  
  // Use only props nodes - the store nodes are empty
  const nodes = propNodes || []
  
  // Get selected node data
  const selectedNodes = nodes.filter(node => selectedNodeIds.includes(node.id))
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle send message with selected node context
  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const message = inputValue.trim()
    setInputValue('')
    
    // Add selected node context to the message
    let contextualMessage = message
    if (selectedNodes.length > 0) {
      const nodeContext = selectedNodes.map(node => {
        const title = node.data.title || 'Untitled Node'
        const content = node.data.content || ''
        return `Node: "${title}"${content ? `\nContent: ${content}` : ''}`
      }).join('\n\n')
      
      contextualMessage = `Context - Selected ${selectedNodes.length === 1 ? 'node' : 'nodes'}:\n${nodeContext}\n\nUser message: ${message}`
    }
    
    await sendMessage(contextualMessage)
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

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-16 right-4 z-40 bg-blue-600 text-white rounded-full p-3 shadow-lg hover:bg-blue-700 transition-colors"
        title="Open Chat"
      >
        <MessageSquare className="w-5 h-5" />
      </button>
    )
  }

  return (
    <div className="fixed top-12 right-0 z-40 w-96 h-[calc(100vh-48px)] bg-white dark:bg-gray-900/80 shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Nodal AI</h3>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowNodeGenerator(!showNodeGenerator)}
            className="p-1 text-gray-500 hover:text-blue-600 transition-colors"
            title="Generate Nodes"
          >
            <Sparkles className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            title="Close Chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Node Generator */}
      {showNodeGenerator && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Generate Nodes
              </label>
              <textarea
                value={nodePrompt}
                onChange={(e) => setNodePrompt(e.target.value)}
                placeholder="Describe the nodes you want to generate..."
                className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                rows={2}
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
              <button
                onClick={handleGenerateNodes}
                disabled={!nodePrompt.trim() || isGeneratingNodes}
                className="flex-1 bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGeneratingNodes ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-1" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {!aiContext.isInitialized ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <Key className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium mb-2">AI Not Configured</p>
            <p className="text-xs mb-4">Set up your OpenAI API key to start using AI features</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Start a conversation with Nodal AI</p>
            <p className="text-xs mt-1">Ask questions, generate nodes, or get help with your board</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                <div className="whitespace-pre-wrap">{message.content}</div>
                <div className={`text-xs mt-1 ${
                  message.role === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {message.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 rounded-lg text-sm">
              <div className="flex items-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>AI is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Error Display */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Selection Notification */}
      {selectedNodes.length > 0 && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <Target className="w-4 h-4" />
            <span>
              {selectedNodes.length === 1 
                ? `Selected: ${selectedNodes[0].data.title || 'Untitled Node'}`
                : `Selected: ${selectedNodes.length} nodes`
              }
            </span>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                selectedNodes.length > 0 
                  ? `Ask about ${selectedNodes.length === 1 ? 'this node' : 'these nodes'}...`
                  : "Ask Nodal AI anything..."
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={1}
              style={{ minHeight: '40px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="h-10 px-4 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}