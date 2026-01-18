"use client"

import React, { useState, useRef, useEffect } from 'react'
import { useUnifiedAI2 } from '../features/ai/useUnifiedAI2'
import { useAIContext } from '../features/ai/aiContext'
import { useAISettingsStore } from '../features/ai/aiSettingsSlice'
import { useBoardStore } from '../features/board/boardSlice'
import { X, Chat, Spinner, Key, Target, PaperPlaneTilt, Resize, XCircle, ArrowSquareIn, ArrowsInSimple } from '@phosphor-icons/react'
import TextArea from './ui/TextArea'
import IconButton from './ui/IconButton'
// Node generation UI and placement imports removed
import { OpenAIModel } from '@/features/ai/aiTypes'
import Select from './ui/Select'
import { MODELS } from '../features/ai/models'
import Toast from './ui/Toast'

export default function ChatPanel2() {
  const currentBoardId = useBoardStore((s) => s.currentBoardId)
  const panelKey = currentBoardId ? `nodal.chatpanel.${currentBoardId}.open` : 'nodal.chatpanel.global.open'
  const modelKey = currentBoardId ? `nodal.chatpanel.${currentBoardId}.model` : 'nodal.chatpanel.global.model'

  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    const saved = localStorage.getItem(panelKey)
    const isMdUpLocal = window.matchMedia('(min-width: 768px)').matches
    if (saved === 'true' || saved === 'false') {
      // On mobile, default to closed even if a previous session saved it as open
      return isMdUpLocal ? (saved === 'true') : false
    }
    return false
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
  const [quotaToastOpen, setQuotaToastOpen] = useState(false)
  useEffect(() => {
    if (!error) return
    const msg = String(error).toLowerCase()
    if (msg.includes('token') && msg.includes('limit')) {
      setQuotaToastOpen(true)
    }
  }, [error])



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

  // Persist open state per-board; ensures consistent behavior across navigations
  useEffect(() => {
    try { localStorage.setItem(panelKey, String(isOpen)) } catch {}
  }, [isOpen, panelKey])

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
    // Always try to show only the original user input (hide any injected context/directives)
    const marker = '\n\nUser message: '
    const idx = text.indexOf(marker)
    if (idx >= 0) return text.slice(idx + marker.length)
    return text
  }

  const getPlainText = (htmlOrText: string): string => {
    if (!htmlOrText) return ''
    try {
      const tmp = document.createElement('div')
      tmp.innerHTML = htmlOrText
      return (tmp.textContent || tmp.innerText || '').trim()
    } catch {
      return htmlOrText
    }
  }

  // Reduce markdown artifacts while streaming (e.g., **bold** markers mid-stream)
  const formatAssistantForDisplay = (text: string, streaming: boolean): string => {
    if (!text) return ''
    if (streaming) {
      try {
        return text
          .replace(/\*\*/g, '') // strip bold markers
          .replace(/__+/g, '') // strip double underscores
          .replace(/(?<!\w)\*(?!\w)/g, '') // singleton asterisks
          .replace(/(?<!\w)_(?!\w)/g, '') // singleton underscores
          .replace(/`/g, '') // strip backticks
      } catch {
        return text
      }
    }
    try {
      // If assistant echoed our directive/context, trim everything before the first NODE TITLE
      const firstNodeIdx = text.indexOf('NODE TITLE:')
      const hasNodeBlocks = firstNodeIdx >= 0 && text.indexOf('NODE CONTENT:') >= 0
      if (hasNodeBlocks) {
        return text.slice(firstNodeIdx)
      }
      return text
    } catch { return text }
  }

  // Node-generation intent detection
  const isNodeCreationIntent = (text: string): boolean => {
    const t = (text || '').toLowerCase().trim()
    if (!t) return false
    if (t.startsWith('/nodes')) return true
    const s = t.replace(/\s+/g, ' ')
    const patterns = [
      /\b(make|create|add|generate)\s+(?:some|a few|several|more|new)?\s*[^\n]{0,80}?\s*nodes?\b/i,
      /\b(turn|convert)\s+[^\n]{0,80}?\s+into\s+nodes?\b/i,
      /\b(make|create|add|generate)\s+[^\n]{0,80}?\s+into\s+nodes?\b/i,
      /\b(make|create|add|generate)\s+[^\n]{0,80}?\s+as\s+nodes?\b/i,
      /\b(suggest|propose|brainstorm|draft)\s+[^\n]{0,80}?\s*nodes?\b/i,
      /\bnodes?\s+(please|plz)\b/i,
    ]
    return patterns.some((re) => re.test(s))
  }

  const NODE_FORMAT_DIRECTIVE = `You are Nobot, the AI assistant inside Nodal — a mind-mapping and idea-building app where users organize thoughts as "Nodes" on "Boards."

When the user asks you to "make nodes," "add nodes," or a similar request, respond only with nodes relevant to the current context.

Use this structured format for your entire response:

NODE TITLE: [A short, clear title for the node]
NODE CONTENT: [Any relevant content, formatted in plain text or HTML if needed]

Each node should represent a distinct idea, insight, or action related to:
- The current conversation,
- The topic or goal of the active Board,
- The currently selected Node (if provided).

If the user specifies how many nodes to create, follow that exactly. If not specified, create the number of nodes that feels most appropriate (up to 10).
The tone and style of the node content should match the user’s board context (e.g., brainstorming → creative; project planning → structured; research → factual).

Do not include explanations, lists, or conversational text outside of the node format.

Only output in the following pattern:
NODE TITLE: [Title 1]
NODE CONTENT: [Body 1]

NODE TITLE: [Title 2]
NODE CONTENT: [Body 2]`

  const awaitingNodesRef = useRef<boolean>(false)
  const [pendingNodes, setPendingNodes] = useState<{ assistantId: string; nodes: Array<{ title: string; content: string }> } | null>(null)

  const parseNodesFromAssistant = (text: string): Array<{ title: string; content: string }> => {
    const results: Array<{ title: string; content: string }> = []
    if (!text) return results
    try {
      const pattern = /NODE TITLE:\s*(.+?)\s*\n+NODE CONTENT:\s*([\s\S]*?)(?=\n+NODE TITLE:|$)/g
      let match: RegExpExecArray | null
      while ((match = pattern.exec(text)) !== null) {
        const title = (match[1] || '').trim()
        const content = (match[2] || '').trim()
        if (title) results.push({ title, content })
      }
    } catch {}
    return results
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
    const wantsNodes = isNodeCreationIntent(userText)
    awaitingNodesRef.current = wantsNodes

    if (selectedNodes.length > 0) {
      const nodeContext = (await Promise.all(selectedNodes.map(async (n: any) => {
        const title = n?.data?.title || 'Untitled Node'
        let raw = n?.data?.content || ''

        // Phase A: if this is a document node and it has a documentId, pull extracted text from documents table (on-demand).
        try {
          const type = String(n?.type || n?.data?.type || '').toLowerCase()
          const docId = String(n?.data?.documentId || '')
          if (type === 'document' && docId) {
            const getText = async () => {
              const mod = await import('../features/storage/supabaseStorage')
              return await mod.supabaseStorage.getDocumentExtractedText(docId)
            }
            const timeout = new Promise<string>((res) => setTimeout(() => res(''), 900))
            const extracted = await Promise.race([getText(), timeout])
            if (extracted) raw = extracted
          }
        } catch {}

        let content = getPlainText(String(raw || ''))
        const MAX = 4000 // trim long docs to keep prompts efficient
        if (content.length > MAX) content = content.slice(0, MAX)
        return `Node: "${title}"${content ? `\nContent: ${content}` : ''}`
      }))).join('\n\n')

      const label = `Selected ${selectedNodes.length === 1 ? 'node' : 'nodes'}`
      const base = `Context - ${label}:\n${nodeContext}\n\nUser message: ${userText}`
      contextualMessage = wantsNodes ? `${NODE_FORMAT_DIRECTIVE}\n\n${base}` : base
    } else {
      const base = `${userText}`
      contextualMessage = wantsNodes ? `${NODE_FORMAT_DIRECTIVE}\n\n${base}` : base
    }

    await sendMessageStream(contextualMessage)
  }
  // Node generation removed from ChatPanel2

  // After streaming completes, if we requested nodes, parse and add them to the board
  useEffect(() => {
    if (isStreaming) return
    if (!awaitingNodesRef.current) return
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')
    if (!lastAssistant || !lastAssistant.content) {
      awaitingNodesRef.current = false
      return
    }
    const nodes = parseNodesFromAssistant(lastAssistant.content).slice(0, 10)
    awaitingNodesRef.current = false
    if (!nodes.length) return
    // Hold for user confirmation instead of auto-adding
    setPendingNodes({ assistantId: lastAssistant.id, nodes })
  }, [isStreaming, messages])

  return (
    <>
      <Toast open={quotaToastOpen} onClose={() => setQuotaToastOpen(false)} variant="warning" autoHideMs={4000}>
        Monthly AI token limit reached. <a href="/profile" className="underline font-semibold">Manage plan</a>
      </Toast>
      {/* Toggle */}
      <IconButton
        onClick={() => setIsOpen(true)}
        className={`fixed right-2 z-200 bottom-2 md:bottom-auto md:top-16 cursor-pointer bg-white dark:bg-gray-900
          ${isOpen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
          }`}
        aria-label="Open Chat"
        variant="primaryOutline"
        size="lg"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <Chat className="w-5 h-5" />
      </IconButton>

      {/* Panel */}
      <div
        className={`fixed top-12 md:top-16 right-4 left-4 md:left-auto w-auto md:w-96 
          rounded-3xl z-[700] md:z-[300] max-h-[calc(100dvh-80px)] 
          bg-linear-to-b from-white/90 to-white/50 backdrop-blur-xs dark:from-gray-900/90 dark:to-gray-900/70 shadow-xl shadow-orange-950/5 flex flex-col transition-all duration-200 ease-out ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'
          }`}
        style={
          (isMdUp
            ? ({ width: panelWidth, height: panelHeight, maxWidth: MAX_WIDTH, minWidth: MIN_WIDTH, minHeight: MIN_HEIGHT, maxHeight: getMaxHeight() } as React.CSSProperties)
            : ({ height: 'calc(100dvh - 80px)' } as React.CSSProperties))
        }
      >
        {/* Header */}
        <div className="flex items-center justify-between py-2 px-4">
          <div className="flex items-center space-x-1">
            <img src="/nobot.svg" alt="Nodal" width={32} height={32} />

            {ai.isInitialized ? (
              <div className="flex items-center space-x-4">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>

                <Select
                  size="xs"
                  aria-label="AI Model"
                  value={model}
                  options={MODELS as any}
                  onChange={(v) => setModel(v as OpenAIModel)}
                  fullWidth
                />
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
              <ArrowsInSimple size={24} />
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
        <div className="flex-1 overflow-y-auto p-4 space-y-6 dark:shadow-none scrollbar-themed">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${m.role === 'user' ? 'bg-gray-200 text-gray-900 dark:text-gray-100 dark:bg-gray-800 font-medium' : 'text-gray-900 bg-white dark:bg-gray-900 text-base font-medium dark:text-gray-100'}`}>
                <p className="text-sm whitespace-pre-wrap">{
                  m.role === 'assistant'
                    ? formatAssistantForDisplay(m.content, isStreaming && i === messages.length - 1)
                    : getUserDisplayText(m.content)
                }</p>
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
              <div className="flex items-center space-x-2 min-w-0">
                <Target className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                {selectedNodes.length === 1 ? (
                  <p className="text-xs text-primary-700 dark:text-primary-300 truncate">
                    {(() => {
                      const n: any = selectedNodes[0]
                      const t = n?.data?.title || 'Untitled Node'
                      const raw = n?.data?.content || ''
                      const plain = getPlainText(String(raw))
                      return plain ? `Selected: "${t}" — ${plain}` : `Selected: "${t}"`
                    })()}
                  </p>
                ) : (
                  <p className="text-xs text-primary-700 dark:text-primary-300">
                    {`Selected: ${selectedNodes.length} nodes`}
                  </p>
                )}
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
        <div className="px-4 py-4">
          <div className="flex relative">
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
                : 'Chat with Nobot...'}
              rows={1}
              fullWidth
              className="resize-none scrollbar-none text-base! md:text-sm! pr-10 h-12"
              bgClassName="rounded-full bg-white shadow-2xl! shadow-gray-400/20! dark:shadow-2xl! dark:shadow-gray-800/20!"
              // bgClassName="bg-[#F6F1EE]!"
            />
            <IconButton
              aria-label="Send"
              onClick={() => handleSend()}
              disabled={!inputValue.trim() || isLoading || isStreaming}
              aria-busy={isLoading || isStreaming}
              className="absolute right-3 top-3 flex-none"
              size="sm"
            >
              <PaperPlaneTilt weight="duotone" size={32} className="w-4! h-4!" />
            </IconButton>
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


