'use client'

import { useState, useCallback, useRef } from 'react'
import { useAIContext } from './aiContext'
import type { AIContext as AIContextType } from './aiTypes'

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

  const sanitizeStreamContent = useCallback((text: string): string => {
    let s = text
    s = s.replace(/([^\n])(\s*)(\d+\.\s)/g, '$1\n\n$3')
    const paras = s.split(/\n\s*\n/)
    const out: string[] = []
    for (const p of paras) {
      const t = p.trim()
      if (!t) continue
      if (out.length === 0 || out[out.length - 1] !== t) out.push(t)
    }
    return out.join('\n\n')
  }, [])

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
        systemPrompt: `You are Nodal, an AI assistant for a visual thinking and knowledge management application. Be helpful and context-aware. Avoid repetition. When the user says "this" or "it", interpret it as referring to the selected node context provided in the user message.`,
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
        systemPrompt: `You are Nodal, an AI assistant for a visual thinking and knowledge management application. Be helpful and context-aware. Avoid repetition. When the user says "this" or "it", interpret it as referring to the selected node context provided in the user message.`,
        context: aiContextData,
        model: aiContext.selectOptimalModel('chat'),
        temperature: 0.7,
        stream: true,
      }

      if (abortControllerRef.current) {
        ;(streamOptions as any).signal = abortControllerRef.current.signal as any
      }

      for await (const chunk of aiContext.generateStream(streamOptions)) {
        const delta = (chunk as any).delta || (chunk as any).content || ''
        if (!delta) continue
        setMessages(prev => prev.map(m => {
          if (m.id !== assistantId) return m
          const next = sanitizeStreamContent((m.content || '') + delta)
          return { ...m, content: next }
        }))
      }
    } catch (err) {
      if (!(err instanceof Error && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Failed to stream message')
      }
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [aiContext, messages, currentContext, sanitizeStreamContent])

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


