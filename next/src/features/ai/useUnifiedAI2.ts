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
  const [messages, setMessages] = useState<ChatMessage2[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentContext, setCurrentContext] = useState<AIContextType>({})

  const currentBoardId = useBoardStore((s) => s.currentBoardId)
  const storageKey = currentBoardId ? `nodal.chat.${currentBoardId}` : 'nodal.chat.global'

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

      const aiContextData: AIContextType = {
        ...currentContext,
        ...context,
        conversation: {
          messages: [...messages, userMessage],
          sessionId: 'current-session',
          startedAt: new Date(),
        },
      }

      const response = await aiContext.generate({
        prompt: content,
        systemPrompt: `You are Nodal, an AI assistant for a visual mind mapping app. The app represents ideas as nodes and relationships as edges. Ground answers in the provided board and node context. There is no restriction on output length or format. When the user says "this" or "it", interpret it relative to the selected nodes included in the user's message.`,
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

      const aiContextData: AIContextType = {
        ...currentContext,
        ...context,
        conversation: {
          messages: [...messages, userMessage],
          sessionId: 'current-session',
          startedAt: new Date(),
        },
      }

      const streamOptions: any = {
        prompt: content,
        systemPrompt: `You are Nodal, an AI assistant for a visual mind mapping app. The app represents ideas as nodes and relationships as edges. Ground answers in the provided board and node context. There is no restriction on output length or format. When the user says "this" or "it", interpret it relative to the selected nodes included in the user's message.`,
        context: aiContextData,
        model: aiContext.selectOptimalModel('chat'),
        temperature: 0.7,
        stream: true,
      }

      if (abortControllerRef.current) {
        ;(streamOptions as any).signal = abortControllerRef.current.signal as any
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
      if (abortControllerRef.current) abortControllerRef.current.abort()
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


