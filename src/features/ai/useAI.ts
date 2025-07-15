import { useState, useCallback, useRef, useEffect } from 'react'
import { useAIContext, useAI as useBaseAI, useAIConfig, useAIStatus } from './aiContext'
import { useBoard } from '../board/useBoard'
import { useNodeActions } from '../nodes/useNodeActions'
import { PROMPT_TEMPLATES } from './promptTemplates'
import type { 
  AIRequest, 
  AIResponse, 
  StreamingAIResponse, 
  UseAIOptions, 
  UseAIResult, 
  UseNodeAIResult,
  OpenAIModel,
  AIActionType
} from './aiTypes'
import { useBoardStore } from '../board/boardSlice'

// Enhanced useAI hook with more options
export function useAI(options: UseAIOptions = {}): UseAIResult {
  const baseAI = useBaseAI()
  const { selectOptimalModel } = useAIContext()
  const [isLoading, setIsLoading] = useState(false)
  const activeRequestRef = useRef<AbortController | null>(null)
  const { topic } = useBoardStore()

  // Enhanced generate function with better error handling and options
  const generate = useCallback(async (
    prompt: string, 
    requestOptions: Partial<AIRequest> = {}
  ): Promise<AIResponse> => {
    setIsLoading(true)
    
    // Cancel any existing request
    if (activeRequestRef.current) {
      activeRequestRef.current.abort()
    }
    
    activeRequestRef.current = new AbortController()

    try {
      let contextToUse = options.context || requestOptions.context
      if (!contextToUse && topic) {
        // If no context provided, use topic as fallback in a minimal AIContext
        contextToUse = { userPreferences: undefined, board: undefined, documents: undefined, conversation: undefined, topic } as any
      } else if (typeof contextToUse === 'object' && topic && !(contextToUse as any).topic) {
        // If context is an object but topic is not included, add it
        contextToUse = { ...contextToUse, topic }
      }
      const request: AIRequest = {
        prompt,
        model: options.model || selectOptimalModel('chat'),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: false,
        context: contextToUse,
        ...requestOptions
      }

      const response = await baseAI.generate(request)
      return response
    } finally {
      setIsLoading(false)
      activeRequestRef.current = null
    }
  }, [baseAI, options, selectOptimalModel, topic])

  // Enhanced streaming function
  const generateStream = useCallback(async function* (
    prompt: string,
    requestOptions: Partial<AIRequest> = {}
  ): AsyncGenerator<StreamingAIResponse, void, unknown> {
    setIsLoading(true)
    
    // Cancel any existing request
    if (activeRequestRef.current) {
      activeRequestRef.current.abort()
    }
    
    activeRequestRef.current = new AbortController()

    try {
      const request: AIRequest = {
        prompt,
        model: options.model || selectOptimalModel('chat'),
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        stream: true,
        context: options.context,
        ...requestOptions
      }

      for await (const chunk of baseAI.generateStream(request)) {
        yield chunk
      }
    } finally {
      setIsLoading(false)
      activeRequestRef.current = null
    }
  }, [baseAI, options, selectOptimalModel])

  // Cancel function
  const cancel = useCallback(() => {
    if (activeRequestRef.current) {
      activeRequestRef.current.abort()
      activeRequestRef.current = null
      setIsLoading(false)
    }
    baseAI.cancel()
  }, [baseAI])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeRequestRef.current) {
        activeRequestRef.current.abort()
      }
    }
  }, [])

  return {
    generate,
    generateStream,
    isLoading: isLoading || baseAI.isLoading,
    error: baseAI.error,
    usage: baseAI.usageStats,
    cancel
  }
}

// Enhanced Node AI hook
export function useNodeAI(nodeId: string): UseNodeAIResult {
  const ai = useAI()
  const { nodes } = useBoard()
  const { updateNodeContent, markAsAIGenerated } = useNodeActions(nodeId)
  const { selectOptimalModel } = useAIContext()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<any>(null)

  const node = nodes.find(n => n.id === nodeId)

  // Clear error function
  const clearError = useCallback(() => setError(null), [])

  // Expand node content
  const expandNode = useCallback(async () => {
    if (!node) {
      setError(new Error('Node not found'))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const prompt = PROMPT_TEMPLATES.expandNode(node.data.label, node.data.content)
      const model = selectOptimalModel('expand_node')
      
      const response = await ai.generate(prompt, {
        model,
        systemPrompt: 'You are a helpful assistant that expands on concepts and ideas. Provide clear, concise, and informative explanations.',
        temperature: 0.7,
        maxTokens: 500
      })

      updateNodeContent(response.content)
      markAsAIGenerated()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to expand node'))
    } finally {
      setIsLoading(false)
    }
  }, [node, ai, selectOptimalModel, updateNodeContent, markAsAIGenerated])

  // Generate related nodes
  const generateRelatedNodes = useCallback(async (count: number = 3): Promise<string[]> => {
    if (!node) {
      setError(new Error('Node not found'))
      return []
    }

    setIsLoading(true)
    setError(null)

    try {
      const prompt = PROMPT_TEMPLATES.generateRelatedNodes(node.data.label, count)
      const model = selectOptimalModel('generate_related')
      
      const response = await ai.generate(prompt, {
        model,
        systemPrompt: 'You are a helpful assistant that generates related concepts and ideas. Provide only concept names, one per line.',
        temperature: 0.8,
        maxTokens: 200
      })

      return response.content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, count)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate related nodes'))
      return []
    } finally {
      setIsLoading(false)
    }
  }, [node, ai, selectOptimalModel])

  // Improve node content
  const improveNode = useCallback(async () => {
    if (!node || !node.data.content) {
      setError(new Error('Node not found or has no content to improve'))
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const prompt = PROMPT_TEMPLATES.improveNode(node.data.label, node.data.content)
      const model = selectOptimalModel('improve_content')
      
      const response = await ai.generate(prompt, {
        model,
        systemPrompt: 'You are a helpful assistant that improves and enhances content. Make it more comprehensive and useful while maintaining the core meaning.',
        temperature: 0.6,
        maxTokens: 600
      })

      updateNodeContent(response.content)
      markAsAIGenerated()
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to improve node'))
    } finally {
      setIsLoading(false)
    }
  }, [node, ai, selectOptimalModel, updateNodeContent, markAsAIGenerated])

  // Generate questions about the node
  const generateQuestions = useCallback(async (): Promise<string[]> => {
    if (!node) {
      setError(new Error('Node not found'))
      return []
    }

    setIsLoading(true)
    setError(null)

    try {
      const prompt = PROMPT_TEMPLATES.generateQuestions(node.data.label, node.data.content)
      const model = selectOptimalModel('generate_related')
      
      const response = await ai.generate(prompt, {
        model,
        systemPrompt: 'You are a helpful assistant that generates thoughtful questions. Create questions that encourage deeper thinking and analysis.',
        temperature: 0.7,
        maxTokens: 300
      })

      return response.content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 5)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate questions'))
      return []
    } finally {
      setIsLoading(false)
    }
  }, [node, ai, selectOptimalModel])

  // Analyze node in context of the board
  const analyzeNode = useCallback(async (): Promise<string> => {
    if (!node) {
      setError(new Error('Node not found'))
      return ''
    }

    setIsLoading(true)
    setError(null)

    try {
      // Get board context
      const connectedNodes = nodes.filter(n => n.id !== nodeId) // Simplified - would need actual connection logic
      const contextInfo = connectedNodes.slice(0, 5).map(n => `${n.data.label}: ${n.data.content || 'No content'}`).join('\n')
      
      const prompt = `Analyze this node in the context of the knowledge graph:

Target Node: "${node.data.label}"
Content: ${node.data.content || 'No content'}

Related nodes in the graph:
${contextInfo}

Provide insights about:
- How this node relates to others
- Potential connections or gaps
- Suggestions for development
- Strategic importance`

      const model = selectOptimalModel('analyze_board')
      
      const response = await ai.generate(prompt, {
        model,
        systemPrompt: 'You are a helpful assistant that analyzes knowledge graphs. Provide insightful analysis about relationships, gaps, and opportunities.',
        temperature: 0.6,
        maxTokens: 400
      })

      return response.content
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to analyze node'))
      return ''
    } finally {
      setIsLoading(false)
    }
  }, [node, nodes, nodeId, ai, selectOptimalModel])

  return {
    expandNode,
    generateRelatedNodes,
    improveNode,
    generateQuestions,
    analyzeNode,
    isLoading,
    error: error || ai.error
  }
}

// Streaming hook for real-time AI responses
export function useStreamingAI() {
  const ai = useAI()
  const [content, setContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isComplete, setIsComplete] = useState(false)

  const streamGenerate = useCallback(async (
    prompt: string,
    options: Partial<AIRequest> = {}
  ) => {
    setContent('')
    setIsComplete(false)
    setIsStreaming(true)

    try {
      for await (const chunk of ai.generateStream(prompt, options)) {
        setContent(chunk.content)
        setIsComplete(chunk.isComplete)
        
        if (chunk.isComplete) {
          setIsStreaming(false)
        }
      }
    } catch (err) {
      setIsStreaming(false)
      setIsComplete(true)
      throw err
    }
  }, [ai])

  const reset = useCallback(() => {
    setContent('')
    setIsComplete(false)
    setIsStreaming(false)
  }, [])

  return {
    content,
    isStreaming,
    isComplete,
    streamGenerate,
    reset,
    error: ai.error,
    cancel: ai.cancel
  }
}

// Board-level AI operations
export function useBoardAI() {
  const ai = useAI()
  const { nodes, edges } = useBoard()
  const { selectOptimalModel } = useAIContext()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Summarize the entire board
  const summarizeBoard = useCallback(async (): Promise<string> => {
    setIsLoading(true)
    setError(null)

    try {
      const nodesSummary = nodes.map(node => 
        `- ${node.data.label}${node.data.content ? `: ${node.data.content}` : ''}`
      ).join('\n')

      const prompt = PROMPT_TEMPLATES.summarizeBoard(nodes.map(n => ({
        label: n.data.label,
        content: n.data.content
      })))
      
      const model = selectOptimalModel('analyze_board')
      
      const response = await ai.generate(prompt, {
        model,
        systemPrompt: 'You are a helpful assistant that analyzes and summarizes knowledge graphs. Provide clear, insightful summaries.',
        temperature: 0.6,
        maxTokens: 500
      })

      return response.content
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to summarize board'))
      return ''
    } finally {
      setIsLoading(false)
    }
  }, [nodes, ai, selectOptimalModel])

  // Suggest connections between nodes
  const suggestConnections = useCallback(async () => {
    if (nodes.length < 2) {
      setError(new Error('Need at least 2 nodes to suggest connections'))
      return []
    }

    setIsLoading(true)
    setError(null)

    try {
      const prompt = PROMPT_TEMPLATES.suggestConnections(nodes.map(node => ({
        id: node.id,
        label: node.data.label
      })))
      
      const model = selectOptimalModel('suggest_connections')
      
      const response = await ai.generate(prompt, {
        model,
        systemPrompt: 'You are a helpful assistant that suggests logical connections between concepts. Provide connections in the specified format.',
        temperature: 0.6,
        maxTokens: 400
      })

      // Parse the response to extract connections
      const connections: Array<{ source: string; target: string; reason: string }> = []
      const lines = response.content.split('\n')

      for (const line of lines) {
        const match = line.match(/^(\w+)\s*->\s*(\w+):\s*(.+)$/)
        if (match) {
          connections.push({
            source: match[1],
            target: match[2],
            reason: match[3].trim()
          })
        }
      }

      return connections
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to suggest connections'))
      return []
    } finally {
      setIsLoading(false)
    }
  }, [nodes, ai, selectOptimalModel])

  // Generate related nodes for the entire board
  const generateBoardExtensions = useCallback(async (count: number = 5): Promise<string[]> => {
    if (nodes.length === 0) {
      setError(new Error('No nodes found on board'))
      return []
    }

    setIsLoading(true)
    setError(null)

    try {
      const boardContext = nodes.map(n => n.data.label).join(', ')
      const prompt = `Based on this knowledge graph with nodes: ${boardContext}

Generate ${count} additional concepts that would complement and extend this knowledge graph. Consider:
- Gaps in the current knowledge
- Related fields or disciplines
- Practical applications
- Prerequisites or fundamentals
- Advanced topics

Provide only the concept names, one per line.`

      const model = selectOptimalModel('generate_related')
      
      const response = await ai.generate(prompt, {
        model,
        systemPrompt: 'You are a helpful assistant that generates related concepts for knowledge graphs. Focus on valuable additions that enhance understanding.',
        temperature: 0.8,
        maxTokens: 300
      })

      return response.content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, count)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to generate board extensions'))
      return []
    } finally {
      setIsLoading(false)
    }
  }, [nodes, ai, selectOptimalModel])

  return {
    summarizeBoard,
    suggestConnections,
    generateBoardExtensions,
    isLoading,
    error
  }
}

// Re-export context hooks for convenience
export { useAIConfig, useAIStatus } from './aiContext' 