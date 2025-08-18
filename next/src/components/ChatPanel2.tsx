'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useUnifiedAI2 } from '../features/ai/useUnifiedAI2'
import { useAIContext } from '../features/ai/aiContext'
import { Send, X, MessageSquare, Loader2, Key } from 'lucide-react'
import TextArea from './ui/TextArea'
import Button from './ui/Button'

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return
    const msg = inputValue.trim()
    setInputValue('')
    if (inputRef.current) inputRef.current.blur()
    await sendMessageStream(msg)
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
                  handleSend()
                }
              }}
              placeholder={"Chat with Nodal..."}
              rows={1}
              fullWidth
              className="resize-none"
            />
            <Button onClick={handleSend} disabled={!inputValue.trim() || isLoading || isStreaming} loading={isLoading || isStreaming} className="px-4">
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
      </div>
    </>
  )
}


