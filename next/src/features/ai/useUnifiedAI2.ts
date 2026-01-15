'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAIContext } from './aiContext'
import type { AIContext as AIContextType } from './aiTypes'
import { useBoardStore } from '../board/boardSlice'

interface ChatMessage2 {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

interface UseUnifiedAI2Result {
  messages: ChatMessage2[]
  sendMessage: (content: string, context?: Partial<AIContextType>) => Promise<void>
  sendMessageStream: (content: string, context?: Partial<AIContextType>) => Promise<void>
  cancelStreaming: () => void
  clearChat: () => void
  addSystemMessage: (content: string) => void
  isLoading: boolean
  isStreaming: boolean
  error: string | null
  clearError: () => void
}

export function useUnifiedAI2(): UseUnifiedAI2Result {
  const aiContext = useAIContext()
  const CHAT_SYSTEM_PROMPT = `You are Nobot, an AI assistant for a visual mind mapping app. 
You are an expert research assistant and teacher for the board’s topic.
The app represents ideas as nodes and relationships as edges. Always ground answers in the 
provided board and node context.

Personality:
- Quiet, observant, and knowledgeable. 
- Occasionally drop in a dry, witty, or sarcastic remark — subtle, never mean-spirited. 
- Think of yourself as the calm, clever teammate who stays quiet until it really matters.

Guidelines:
- Use wit sparingly, as a surprising flourish. 
- Avoid over-cheerful “assistant” talk and corporate jargon. 
- When the user says “this” or “it,” interpret it relative to the selected nodes included in their message.`;

  const [messages, setMessages] = useState<ChatMessage2[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentContext, setCurrentContext] = useState<AIContextType>({})

  const messagesRef = useRef<ChatMessage2[]>([])
  useEffect(() => { messagesRef.current = messages }, [messages])

  const currentBoardId = useBoardStore((s) => s.currentBoardId)
  const storageKey = currentBoardId ? `nodal.chat.${currentBoardId}` : 'nodal.chat.global'

  // Board snapshot (for grounding). This stays capped in the service layer.
  const boardNodes = useBoardStore((s) => s.nodes)
  const boardEdges = useBoardStore((s) => s.edges)
  const selectedNodeIds = useBoardStore((s) => s.selectedNodeIds)
  const boardTopic = useBoardStore((s) => s.topic)
  const boardBrief = useBoardStore((s) => s.boardBrief)

  const abortControllerRef = useRef<AbortController | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const addSystemMessage = useCallback((content: string) => {
    const message: ChatMessage2 = {
      id: Date.now().toString(),
      role: 'system',
      content,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, message])
  }, [])

  // Stream content is passed through without additional sanitization

  const sendMessage = useCallback(async (content: string, context?: Partial<AIContextType>) => {
    if (!aiContext.service) {
      setError('AI service not initialized')
      return
    }

    const messageId = Date.now().toString()
    const userMessage: ChatMessage2 = { id: messageId, role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      abortControllerRef.current = new AbortController()

      const topic = (boardBrief as any)?.boardTopic || boardTopic || ''
      const summary = (boardBrief as any)?.description || ''
      const aiContextData: AIContextType = {
        ...currentContext,
        ...context,
        topic,
        board: {
          nodes: Array.isArray(boardNodes) ? (boardNodes as any) : [],
          edges: Array.isArray(boardEdges) ? (boardEdges as any) : [],
          selectedNodeId: Array.isArray(selectedNodeIds) && selectedNodeIds.length ? String(selectedNodeIds[0]) : null,
          boardSummary: summary || undefined,
        } as any,
        conversation: {
          // NOTE: OpenAIService will append the current prompt separately; do not include it here.
          messages: (messagesRef.current || []).filter(Boolean) as any,
          sessionId: 'current-session',
          startedAt: new Date(),
        },
      }

      const response = await aiContext.generate({
        prompt: content,
        systemPrompt: CHAT_SYSTEM_PROMPT,
        context: aiContextData,
        model: aiContext.selectOptimalModel('chat'),
        temperature: 0.7,
        stream: false,
      })

      const assistantMessage: ChatMessage2 = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Failed to send message')
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [aiContext, messages, currentContext])

  const sendMessageStream = useCallback(async (content: string, context?: Partial<AIContextType>) => {
    if (!aiContext.service) {
      setError('AI service not initialized')
      return
    }

    setIsLoading(false)
    setIsStreaming(true)
    setError(null)

    const messageId = Date.now().toString()
    const userMessage: ChatMessage2 = { id: messageId, role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])

    const assistantId = (Date.now() + 1).toString()
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', timestamp: new Date() }])

    try {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      abortControllerRef.current = new AbortController()

      const topic = (boardBrief as any)?.boardTopic || boardTopic || ''
      const summary = (boardBrief as any)?.description || ''
      const aiContextData: AIContextType = {
        ...currentContext,
        ...context,
        topic,
        board: {
          nodes: Array.isArray(boardNodes) ? (boardNodes as any) : [],
          edges: Array.isArray(boardEdges) ? (boardEdges as any) : [],
          selectedNodeId: Array.isArray(selectedNodeIds) && selectedNodeIds.length ? String(selectedNodeIds[0]) : null,
          boardSummary: summary || undefined,
        } as any,
        conversation: {
          messages: (messagesRef.current || []).filter(Boolean) as any,
          sessionId: 'current-session',
          startedAt: new Date(),
        },
      }

      const streamOptions: any = {
        prompt: content,
        systemPrompt: CHAT_SYSTEM_PROMPT,
        context: aiContextData,
        model: aiContext.selectOptimalModel('chat'),
        temperature: 0.7,
        stream: true,
      }

      for await (const chunk of aiContext.generateStream(streamOptions)) {
        const delta = (chunk as any)?.delta
        const contentFull = (chunk as any)?.content
        if (typeof delta === 'string' && delta.length > 0) {
          setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, content: (m.content || '') + delta } : m)))
        } else if (typeof contentFull === 'string') {
          // Some providers send the full accumulated content each tick
          setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, content: contentFull } : m)))
        }
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Failed to stream message')
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [aiContext, messages, currentContext])

  const cancelStreaming = useCallback(() => {
    try {
      aiContext.cancel?.()
    } catch { /* noop */ }
  }, [aiContext])

  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  // Load saved chat on board change/mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as any[]
        if (Array.isArray(parsed)) {
          const restored = parsed.map((m: any): ChatMessage2 => ({
            id: String(m.id ?? Date.now()),
            role: m.role === 'assistant' || m.role === 'user' || m.role === 'system' ? m.role : 'assistant',
            content: String(m.content ?? ''),
            timestamp: new Date(m.timestamp ?? Date.now())
          }))
          setMessages(restored)
        }
      } else {
        setMessages([])
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  // Persist chat on changes
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      localStorage.setItem(storageKey, JSON.stringify(messages))
      // Notify listeners (e.g., BoardComponent) that chat updated
      try {
        window.dispatchEvent(new CustomEvent('nodal:chat-updated', { detail: { boardId: currentBoardId } }))
      } catch {}
    } catch {}
  }, [messages, storageKey])

  return {
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
  }
}


