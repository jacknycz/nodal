'use client'

import { useState, useCallback, useRef } from 'react'
import { useAIContext } from './aiContext'
import type { 
  AIRequest, 
  AIResponse, 
  StreamingAIResponse, 
  AIContext as AIContextType,
  AIActionType
} from './aiTypes'
import type { BoardNode, BoardEdge } from '../board/boardTypes'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
  metadata?: {
    nodeId?: string
    actionType?: string
    generatedNodes?: BoardNode[]
  }
}

interface NodeGenerationRequest {
  prompt: string
  count?: number
  position?: { x: number; y: number }
  context?: {
    existingNodes?: BoardNode[]
    topic?: string
    focus?: string[]
  }
}

interface NodeGenerationResult {
  nodes: BoardNode[]
  connections?: BoardEdge[]
  explanation?: string
}

interface UseUnifiedAIResult {
  // Chat functionality
  messages: ChatMessage[]
  sendMessage: (content: string, context?: Partial<AIContextType>) => Promise<void>
  sendMessageStream: (content: string, context?: Partial<AIContextType>) => Promise<void>
  cancelStreaming: () => void
  clearChat: () => void
  
  // Node generation
  generateNodes: (request: NodeGenerationRequest) => Promise<NodeGenerationResult>
  
  // General AI operations
  generate: (prompt: string, options?: Partial<AIRequest>) => Promise<AIResponse>
  generateStream: (prompt: string, options?: Partial<AIRequest>) => AsyncGenerator<StreamingAIResponse>
  
  // State
  isLoading: boolean
  isGeneratingNodes: boolean
  isStreaming: boolean
  error: string | null
  clearError: () => void
  
  // Context management
  updateContext: (context: Partial<AIContextType>) => void
  getContext: () => AIContextType
}

export function useUnifiedAI(): UseUnifiedAIResult {
  const aiContext = useAIContext()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingNodes, setIsGeneratingNodes] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentContext, setCurrentContext] = useState<AIContextType>({})
  
  const abortControllerRef = useRef<AbortController | null>(null)

  // Sanitize streamed assistant content to reduce duplicated paragraphs/blocks
  const sanitizeStreamContent = useCallback((text: string): string => {
    let s = text
    // Fix missing spaces between words and numbers (e.g., "has15")
    s = s.replace(/([A-Za-z])(\d)/g, '$1 $2')
    // Insert paragraph breaks before capitalized sentences glued after a period
    s = s.replace(/([a-z])\.(?=[A-Z][a-z])/g, '$1.\n\n')
    // Ensure numbered lists start on a new paragraph
    s = s.replace(/([^\n])(\s*)(\d+\.\s)/g, '$1\n\n$3')

    // Collapse consecutive identical sentences
    const sentenceSplit = s.split(/(?<=[.!?])\s+/)
    const sentenceOut: string[] = []
    for (const sent of sentenceSplit) {
      const t = sent.trim()
      if (!t) continue
      if (sentenceOut.length === 0 || sentenceOut[sentenceOut.length - 1] !== t) {
        sentenceOut.push(t)
      }
    }
    s = sentenceOut.join(' ')

    // Collapse adjacent duplicate paragraphs
    const paras = s.split(/\n\s*\n/)
    const out: string[] = []
    for (const p of paras) {
      const t = p.trim()
      if (!t) continue
      if (out.length === 0 || out[out.length - 1] !== t) out.push(t)
    }
    s = out.join('\n\n')

    // If exact half duplicate, collapse
    if (s.length >= 60) {
      const half = Math.floor(s.length / 2)
      const a = s.slice(0, half)
      const b = s.slice(half)
      if (b.startsWith(a)) s = a
    }
    // If exact third duplicate pattern (A A A or A A tail), collapse
    if (s.length >= 90) {
      const third = Math.floor(s.length / 3)
      const head = s.slice(0, third)
      const tail = s.slice(third)
      if (tail.startsWith(head)) {
        while (s.endsWith(head + head)) s = s.slice(0, s.length - head.length)
      }
    }
    // If last N paragraphs equal previous N, drop the last N
    const ps = s.split(/\n\s*\n/)
    for (let n = Math.min(8, Math.floor(ps.length / 2)); n >= 2; n--) {
      const a = ps.slice(ps.length - 2 * n, ps.length - n)
      const b = ps.slice(ps.length - n)
      if (a.length === n && b.length === n && a.join('\n') === b.join('\n')) {
        s = ps.slice(0, ps.length - n).join('\n\n')
        break
      }
    }
    return s
  }, [])

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Update context
  const updateContext = useCallback((context: Partial<AIContextType>) => {
    setCurrentContext(prev => ({ ...prev, ...context }))
  }, [])

  // Get current context
  const getContext = useCallback(() => {
    return currentContext
  }, [currentContext])

  // Send chat message
  const sendMessage = useCallback(async (content: string, context?: Partial<AIContextType>) => {
    if (!aiContext.service) {
      setError('AI service not initialized')
      return
    }

    const messageId = Date.now().toString()
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)
    setError(null)

    try {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      // Build AI context
      const aiContextData: AIContextType = {
        ...currentContext,
        ...context,
        conversation: {
          messages: [...messages, userMessage],
          sessionId: 'current-session',
          startedAt: new Date()
        }
      }

      // Generate response
      const response = await aiContext.generate({
        prompt: content,
        systemPrompt: `You are Nodal, an AI assistant for a visual thinking and knowledge management application.

Be helpful and context-aware. Do not repeat sentences or phrases. Answer once, clearly and concisely. When the user asks to create or add nodes, return structured, non-repetitive content. Do not include sentinel tokens or artificial endings.`,
        context: aiContextData,
        model: aiContext.selectOptimalModel('chat'),
        temperature: 0.7,
        stream: false
      })

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.content,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return // Request was cancelled
      }
      setError(err instanceof Error ? err.message : 'Failed to send message')
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }, [aiContext, messages, currentContext])

  // Streaming chat message
  const sendMessageStream = useCallback(async (content: string, context?: Partial<AIContextType>) => {
    if (!aiContext.service) {
      setError('AI service not initialized')
      return
    }

    setIsLoading(false)
    setIsStreaming(true)
    setError(null)

    const messageId = Date.now().toString()
    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content,
      timestamp: new Date()
    }
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
          startedAt: new Date()
        }
      }

      const streamOptions: any = {
        prompt: content,
        systemPrompt: `You are Nodal, an AI assistant for a visual thinking and knowledge management application.\n\nBe helpful and context-aware. Do not repeat sentences or phrases. Answer once, clearly and concisely. Do not include sentinel tokens or artificial endings.`,
        context: aiContextData,
        model: aiContext.selectOptimalModel('chat'),
        temperature: 0.7,
        stream: true
      }

      // Pass abort signal only if the underlying implementation supports it via aiContext
      if ((streamOptions as any) && abortControllerRef.current) {
        ;(streamOptions as any).signal = abortControllerRef.current.signal as any
      }

      for await (const chunk of aiContext.generateStream(streamOptions)) {
        const delta = (chunk as any).delta || (chunk as any).content || ''
        if (!delta) continue
        setMessages(prev => prev.map(m => {
          if (m.id !== assistantId) return m
          let next = (m.content + delta)
          // Strip sentinel if present during stream
          if (next.includes('END_OF_RESPONSE')) {
            next = next.replace(/END_OF_RESPONSE[\s\S]*$/,'').trim()
          }
          return { ...m, content: sanitizeStreamContent(next) }
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
  }, [aiContext, messages, currentContext])

  const cancelStreaming = useCallback(() => {
    try {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      aiContext.cancel?.()
    } catch { /* noop */ }
  }, [aiContext])

  // Clear chat
  const clearChat = useCallback(() => {
    setMessages([])
    setError(null)
  }, [])

  // Generate nodes
  const generateNodes = useCallback(async (request: NodeGenerationRequest): Promise<NodeGenerationResult> => {
    if (!aiContext.service) {
      throw new Error('AI service not initialized')
    }

    setIsGeneratingNodes(true)
    setError(null)

    try {
      // Cancel any ongoing request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      const { prompt, count = 5, position, context } = request

      // Build system prompt for node generation
      const systemPrompt = `You are an AI assistant that generates nodes for a visual thinking application.

Generate ${count} relevant nodes based on the user's prompt and context. Do not be concise unless asked. Provide clear titles and optional content.

Each node should have:
- A clear, concise title (max 50 characters)
- Relevant content that expands on the title
- A type that fits the context (default, task, note, idea, etc.)

Return your response as a JSON array of node objects with this structure:
{
  "nodes": [
    {
      "title": "Node Title",
      "content": "Detailed content for this node...",
      "type": "default",
      "position": { "x": 100, "y": 100 }
    }
  ],
  "connections": [
    {
      "source": "node1",
      "target": "node2",
      "label": "Connection description"
    }
  ],
  "explanation": "Brief explanation of why these nodes were generated"
}

Consider the existing context and create nodes that build upon or relate to what's already there.`

      // Build AI context
      const aiContextData: AIContextType = {
        ...currentContext,
        ...context,
        board: context?.existingNodes ? {
          nodes: context.existingNodes,
          edges: [],
          selectedNodeId: null,
          focusedNodeIds: [],
          boardSummary: context.topic
        } : undefined
      }

      // Generate nodes
      const response = await aiContext.generate({
        prompt: `Generate ${count} nodes for: ${prompt}`,
        systemPrompt,
        context: aiContextData,
        model: aiContext.selectOptimalModel('expand_node'),
        temperature: 0.8,
        stream: false
      })

      // Parse response
      let parsedResponse: any
      try {
        // Prefer fenced code block with json
        const fenced = response.content.match(/```json\s*([\s\S]*?)\s*```/i)
        if (fenced) {
          parsedResponse = JSON.parse(fenced[1])
        } else {
          // Try extract explicit nodes array
          const nodesArrayMatch = response.content.match(/"nodes"\s*:\s*(\[\s*[\s\S]*?\])/i)
          if (nodesArrayMatch) {
            const arr = JSON.parse(nodesArrayMatch[1])
            parsedResponse = { nodes: arr, connections: [], explanation: undefined }
          } else {
            // Fallback: try to extract first balanced JSON object
            const jsonMatch = response.content.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              parsedResponse = JSON.parse(jsonMatch[0])
            } else {
              throw new Error('No JSON found in response')
            }
          }
        }
      } catch (parseError) {
        // Fallback: robust parse from formatted text
        const raw = response.content
          .replace(/```[a-zA-Z]*[\s\S]*?```/g, '') // strip code fences entirely
        const lines = raw
          .split('\n')
          .map((line: string) => line.trim())
          .filter((line: string) => line.length > 0)
          .filter((line: string) => !/^\{|\}|\[|\]|,$/.test(line))
          .filter((line: string) => !/^"?(nodes|connections|explanation|title|content|type|position|source|target)"?\s*:/.test(line))
          .filter((line: string) => !/^Sure!\b/i.test(line))

        const results: { title: string; content: string }[] = []
        let current: { title: string; content: string } | null = null

        const pushCurrent = () => {
          if (current && current.title) results.push(current)
          current = null
        }

        for (const line of lines) {
          // Numbered header e.g., "1. Habitat"
          const num = line.match(/^\d+\.\s+(.+)/)
          if (num) {
            pushCurrent()
            const text = num[1]
            // Bold title with optional separator
            const bold = text.match(/^\*\*(.+?)\*\*\s*[:—–-]?\s*(.*)$/)
            if (bold) {
              current = { title: bold[1].trim(), content: (bold[2] || '').trim() }
            } else {
              // Split on common separators
              const sep = text.match(/^([^:—–-]{1,120})\s*[:—–-]\s*(.*)$/)
              current = { title: (sep ? sep[1] : text).trim(), content: (sep ? sep[2] : '').trim() }
            }
            continue
          }

          // Bold header without number
          const boldHeader = line.match(/^\*\*(.+?)\*\*\s*[:—–-]?\s*(.*)$/)
          if (boldHeader) {
            pushCurrent()
            current = { title: boldHeader[1].trim(), content: (boldHeader[2] || '').trim() }
            continue
          }

          // Sub-bullets: append to current content
          if (/^[\-•\*]\s+/.test(line)) {
            const detail = line.replace(/^[\-•\*]\s+/, '').trim()
            if (current) {
              current.content = current.content ? `${current.content}\n- ${detail}` : detail
            }
            continue
          }

          // Otherwise, plain text: if we have a current, treat as additional content
          if (current) {
            current.content = current.content ? `${current.content}\n${line}` : line
          }
        }
        pushCurrent()

        const trimmed = results
          .map(r => ({ title: r.title.replace(/["'`]+/g, '').slice(0, 50), content: r.content }))
          .filter(r => r.title && !/^(nodes|connections|explanation|title|content|label)$/i.test(r.title))

        // Dedupe by normalized title
        const seen = new Set<string>()
        const unique = trimmed.filter(r => {
          const key = r.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
          if (!key || seen.has(key)) return false
          seen.add(key)
          return true
        })

        const nodes: BoardNode[] = unique.slice(0, count).map((r, index) => ({
          id: `fallback-${Date.now()}-${index}`,
          type: 'default',
          position: position || { x: 100 + index * 200, y: 100 + index * 100 },
          data: {
            title: r.title,
            content: r.content || '',
            type: 'default',
            aiGenerated: true
          }
        }))

        return { nodes, explanation: 'Generated nodes from formatted list' }
      }

      // Process generated nodes
      let generatedNodes: BoardNode[] = (parsedResponse.nodes || []).map((node: { title?: string; label?: string; content?: string; type?: string; position?: { x: number; y: number } }, index: number) => ({
        id: `generated-${Date.now()}-${index}`,
        type: 'default',
        position: node.position || position || { x: 100 + index * 200, y: 100 + index * 100 },
        data: {
          title: node.title || node.label || `Generated Node ${index + 1}`,
          content: node.content || '',
          type: node.type || 'default',
          aiGenerated: true
        }
      }))

      // Dedupe by normalized title
      const seenTitles = new Set<string>()
      generatedNodes = generatedNodes.filter(n => {
        const key = (n.data.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
        if (!key || seenTitles.has(key)) return false
        seenTitles.add(key)
        return true
      })

      return {
        nodes: generatedNodes.slice(0, count),
        connections: parsedResponse.connections || [],
        explanation: parsedResponse.explanation || 'Nodes generated successfully'
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Request was cancelled')
      }
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate nodes'
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsGeneratingNodes(false)
      abortControllerRef.current = null
    }
  }, [aiContext, currentContext])

  // General AI generation
  const generate = useCallback(async (prompt: string, options?: Partial<AIRequest>): Promise<AIResponse> => {
    if (!aiContext.service) {
      throw new Error('AI service not initialized')
    }

    return aiContext.generate({
      prompt,
      context: currentContext,
      ...options
    })
  }, [aiContext, currentContext])

  // Streaming generation
  const generateStream = useCallback(async function* (prompt: string, options?: Partial<AIRequest>): AsyncGenerator<StreamingAIResponse> {
    if (!aiContext.service) {
      throw new Error('AI service not initialized')
    }

    yield* aiContext.generateStream({
      prompt,
      context: currentContext,
      ...options
    })
  }, [aiContext, currentContext])

  // Note: streaming chat is implemented above (single definition)

  return {
    // Chat functionality
    messages,
    sendMessage,
    sendMessageStream,
    cancelStreaming,
    clearChat,
    
    // Node generation
    generateNodes,
    
    // General AI operations
    generate,
    generateStream,
    
    // State
    isLoading,
    isGeneratingNodes,
    isStreaming,
    error,
    clearError,
    
    // Context management
    updateContext,
    getContext
  }
} 