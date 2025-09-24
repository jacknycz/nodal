"use client"

import React, { useState, useRef, useEffect } from 'react'
import { useUnifiedAI2 } from '../features/ai/useUnifiedAI2'
import { useAIContext } from '../features/ai/aiContext'
import { useAISettingsStore } from '../features/ai/aiSettingsSlice'
import { useBoardStore } from '../features/board/boardSlice'
import { X, Chat, Spinner, Key, Target, PaperPlaneTilt, Resize, XCircle, ArrowSquareIn } from '@phosphor-icons/react'
import TextArea from './ui/TextArea'
import Button from './ui/Button'
// Node generation UI and placement imports removed
import { OpenAIModel } from '@/features/ai/aiTypes'
import Select from './ui/Select'
import { MODELS } from '../features/ai/models'

export default function ChatPanel2() {
  const currentBoardId = useBoardStore((s) => s.currentBoardId)
  const panelKey = currentBoardId ? `nodal.chatpanel.${currentBoardId}.open` : 'nodal.chatpanel.global.open'
  const modelKey = currentBoardId ? `nodal.chatpanel.${currentBoardId}.model` : 'nodal.chatpanel.global.model'

  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem(panelKey)
    if (saved === 'true' || saved === 'false') return saved === 'true'
    return window.matchMedia('(min-width: 1024px)').matches
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
    addSystemMessage,
    isLoading,
    isStreaming,
    error,
    clearError,
  } = useUnifiedAI2()



  const ai = useAIContext()
  const { model, setModel } = useAISettingsStore()

  // Selection awareness
  const selectedNodeIds = useBoardStore((s) => s.selectedNodeIds)
  const clearSelectedNodes = useBoardStore((s) => s.clearSelectedNodes)
  const storeNodes = useBoardStore((s) => s.nodes)
  const boardBrief = useBoardStore((s) => s.boardBrief)
  const boardTopic = useBoardStore((s) => s.topic)
  const selectedNodes = (storeNodes || []).filter((n: any) => selectedNodeIds.includes(n.id))

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // md+ resize state
  const [isMdUp, setIsMdUp] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(min-width: 768px)').matches
  })
  const MIN_WIDTH = 320
  const MAX_WIDTH = 640
  const MIN_HEIGHT = 240
  const getMaxHeight = () => (typeof window !== 'undefined' ? Math.max(MIN_HEIGHT, window.innerHeight - 80) : 700)
  const [panelWidth, setPanelWidth] = useState<number>(384)
  const [panelHeight, setPanelHeight] = useState<number>(() => (
    typeof window !== 'undefined'
      ? Math.max(MIN_HEIGHT, Math.min(500, getMaxHeight()))
      : 500
  ))

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = () => {
      setIsMdUp(mq.matches)
      // Clamp height on viewport changes
      setPanelHeight((h) => Math.max(MIN_HEIGHT, Math.min(h, getMaxHeight())))
      setPanelWidth((w) => Math.max(MIN_WIDTH, Math.min(w, MAX_WIDTH)))
    }
    onChange()
    mq.addEventListener('change', onChange)
    window.addEventListener('resize', onChange)
    return () => {
      mq.removeEventListener('change', onChange)
      window.removeEventListener('resize', onChange)
    }
  }, [])

  const resizingRef = useRef(false)
  const startRef = useRef<{ x: number; y: number; width: number; height: number }>({ x: 0, y: 0, width: 384, height: panelHeight })

  const onMouseMove = (e: MouseEvent) => {
    if (!resizingRef.current) return
    // From bottom-left: width grows as mouse moves left; height grows as mouse moves down
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    const nextWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startRef.current.width - dx))
    const nextHeight = Math.max(MIN_HEIGHT, Math.min(getMaxHeight(), startRef.current.height + dy))
    setPanelWidth(nextWidth)
    setPanelHeight(nextHeight)
  }

  const onMouseUp = () => {
    if (!resizingRef.current) return
    resizingRef.current = false
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  const onResizeMouseDown = (e: React.MouseEvent) => {
    if (!isMdUp) return
    e.preventDefault()
    e.stopPropagation()
    resizingRef.current = true
    startRef.current = { x: e.clientX, y: e.clientY, width: panelWidth, height: panelHeight }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  // Render assistant text as-is without additional sanitization

  // For user messages with hidden context prefix, only show the original user text
  const getUserDisplayText = (text: string): string => {
    if (!text) return ''
    if (text.startsWith('Context - ')) {
      const marker = '\n\nUser message: '
      const idx = text.indexOf(marker)
      if (idx >= 0) return text.slice(idx + marker.length)
    }
    return text
  }

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading || isStreaming) return
    const userText = inputValue.trim()
    setInputValue('')
    // Keep focus so user can continue typing
    if (inputRef.current) {
      const el = inputRef.current
      requestAnimationFrame(() => el.focus())
    }

    // Build contextual message with selected/focused nodes
    let contextualMessage = userText

    // Board context (title/topic and primer about nodes/edges)
    const boardTitle = boardBrief?.boardName || 'Untitled Board'
    const boardTopicLine = boardBrief?.boardTopic || boardTopic || ''
    const boardInfo = `Context - Board:\nTitle: ${boardTitle}${boardTopicLine ? `\nTopic: ${boardTopicLine}` : ''}\nInfo: Nodal is a visual mind map where nodes represent ideas/documents/tasks and edges represent relationships. Interpret pronouns like "this" or "it" relative to the selected nodes.`

    if (selectedNodes.length > 0) {
      const nodeContext = selectedNodes.map((n: any) => {
        const title = n?.data?.title || 'Untitled Node'
        const raw = n?.data?.content || n?.data?.extractedText || (n?.data as any)?.extracted_text || ''
        const content = (raw || '').toString()
        return `Node: "${title}"${content ? `\nContent: ${content}` : ''}`
      }).join('\n\n')

      const label = `Selected ${selectedNodes.length === 1 ? 'node' : 'nodes'}`
      contextualMessage = `${boardInfo}\n\nContext - ${label}:\n${nodeContext}\n\nUser message: ${userText}`
    } else {
      contextualMessage = `${boardInfo}\n\nUser message: ${userText}`
    }

    await sendMessageStream(contextualMessage)
  }
  // Node generation removed from ChatPanel2

  return (
    <>
      {/* Toggle */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed right-4 z-[200] p-3 bottom-4 md:bottom-auto md:top-16 cursor-pointer
          bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-all duration-200 ease-out 
          ${isOpen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
          }`}
        title="Open Chat"
      >
        <Chat className="w-5 h-5" />
      </button>

      {/* Panel */}
      <div
        className={`fixed top-12 md:top-16 right-4 left-4 md:left-auto w-auto md:w-96 rounded-4xl z-[700] md:z-[300] max-h-[calc(100dvh-80px)] bg-white/80 backdrop-blur-xs dark:bg-gray-900/80 shadow-xl flex flex-col transition-all duration-200 ease-out ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
          }`}
        style={
          (isMdUp
            ? ({ width: panelWidth, height: panelHeight, maxWidth: MAX_WIDTH, minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT, maxHeight: getMaxHeight() } as React.CSSProperties)
            : ({ height: 'calc(100dvh - 80px)' } as React.CSSProperties))
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between py-2 px-4 border-b border-gray-100 dark:border-gray-950/50">
          <div className="flex items-center space-x-2">
            <img src="/nobot.svg" alt="Nodal" width={32} height={32} />

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
          </div>

          {/* AI Status */}
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsOpen(false)} className="cursor-pointer text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-300">
            <ArrowSquareIn size={24} weight="duotone" />
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
        <div className="flex-1 overflow-y-auto p-4 space-y-4 shadow-[inset_0_-4px_6px_-1px_rgba(156,163,175,0.1)] dark:shadow-none scrollbar-themed">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${m.role === 'user' ? 'bg-primary-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'}`}>
                <p className="text-sm whitespace-pre-wrap">{m.role === 'assistant' ? m.content : getUserDisplayText(m.content)}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl px-4 py-2">
                <div className="flex items-center space-x-2">
                  <Spinner className="w-4 h-4 animate-spin text-gray-500" />
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
                onClick={() => { clearSelectedNodes() }}
                className="cursor-pointer text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200"
              >
                <XCircle className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="px-4 py-3">
          <div className="flex mb-2 justify-center">
            <Select
              size="xs"
              aria-label="AI Model"
              value={model}
              options={MODELS}
              onChange={(v) => setModel(v as OpenAIModel)}
              fullWidth
            />
          </div>

          <div className="flex space-x-2 items-end">
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
              placeholder={selectedNodes.length > 0
                ? `Ask about ${selectedNodes.length === 1 ? 'this node' : 'these nodes'}...`
                : 'Chat with Nodal...'}
              rows={1}
              fullWidth
              className="resize-none scrollbar-none text-base! md:text-sm!"
            />
            <Button onClick={() => handleSend()} disabled={!inputValue.trim() || isLoading || isStreaming} loading={isLoading || isStreaming} className="w-12! h-12! p-0! flex-none">
              <PaperPlaneTilt weight="duotone" size={32} className="w-6! h-6!" />
            </Button>
          </div>
          {/* <div className="mt-2 flex items-center justify-between">
            <button className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" onClick={clearChat}>Clear</button>
            {isStreaming && (
              <button className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300" onClick={cancelStreaming}>Stop</button>
            )}
          </div> */}
        </div>

        {/* Resize handle (md and above) */}
        {isMdUp && (
          <div
            className="hidden md:flex absolute -bottom-2 -left-2 w-6 h-6 items-center justify-center rounded-full
            bg-white dark:bg-primary-900 text-primary-600 dark:text-white 
            cursor-sw-resize shadow-lg hover:shadow-xl transition-all duration-200 ease-out"
            onMouseDown={onResizeMouseDown}
            title="Resize"
          >
            <Resize size={32} weight="duotone" className="w-4 h-4" />
          </div>
        )}

        {/* Node generation UI removed */}
      </div>
    </>
  )
}


