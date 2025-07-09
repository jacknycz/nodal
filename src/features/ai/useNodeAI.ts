import { useState, useCallback } from 'react'
import { useBoard } from '../board/useBoard'
import { useNodeActions } from '../nodes/useNodeActions'
import AIClient, { type AIConfig } from './aiClient'
import { PROMPT_TEMPLATES } from './promptTemplates'

interface UseNodeAIOptions {
  apiKey?: string
  baseUrl?: string
  model?: string
}

export function useNodeAI(nodeId: string, options: UseNodeAIOptions = {}) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const { nodes } = useBoard()
  const { updateNodeContent, markAsAIGenerated } = useNodeActions(nodeId)
  
  const node = nodes.find(n => n.id === nodeId)
  const aiClient = options.apiKey ? new AIClient(options as AIConfig) : null

  const expandNode = useCallback(async () => {
    if (!aiClient || !node) return

    setIsLoading(true)
    setError(null)

    try {
      const prompt = PROMPT_TEMPLATES.expandNode(node.data.label, node.data.content)
      const response = await aiClient.generateText({
        prompt,
        systemPrompt: 'You are a helpful assistant that expands on concepts and ideas. Provide clear, concise, and informative explanations.',
        temperature: 0.7,
        maxTokens: 500,
      })

      updateNodeContent(response.content)
      markAsAIGenerated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to expand node')
    } finally {
      setIsLoading(false)
    }
  }, [aiClient, node, updateNodeContent, markAsAIGenerated])

  const generateRelatedNodes = useCallback(async (count: number = 3) => {
    if (!aiClient || !node) return []

    setIsLoading(true)
    setError(null)

    try {
      const prompt = PROMPT_TEMPLATES.generateRelatedNodes(node.data.label, count)
      const response = await aiClient.generateText({
        prompt,
        systemPrompt: 'You are a helpful assistant that generates related concepts and ideas. Provide only concept names, one per line.',
        temperature: 0.8,
        maxTokens: 200,
      })

      return response.content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, count)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate related nodes')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [aiClient, node])

  const improveNode = useCallback(async () => {
    if (!aiClient || !node || !node.data.content) return

    setIsLoading(true)
    setError(null)

    try {
      const prompt = PROMPT_TEMPLATES.improveNode(node.data.label, node.data.content)
      const response = await aiClient.generateText({
        prompt,
        systemPrompt: 'You are a helpful assistant that improves and enhances content. Make it more comprehensive and useful while maintaining the core meaning.',
        temperature: 0.6,
        maxTokens: 600,
      })

      updateNodeContent(response.content)
      markAsAIGenerated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to improve node')
    } finally {
      setIsLoading(false)
    }
  }, [aiClient, node, updateNodeContent, markAsAIGenerated])

  const generateQuestions = useCallback(async () => {
    if (!aiClient || !node) return []

    setIsLoading(true)
    setError(null)

    try {
      const prompt = PROMPT_TEMPLATES.generateQuestions(node.data.label, node.data.content)
      const response = await aiClient.generateText({
        prompt,
        systemPrompt: 'You are a helpful assistant that generates thoughtful questions. Create questions that encourage deeper thinking and analysis.',
        temperature: 0.7,
        maxTokens: 300,
      })

      return response.content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 5)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate questions')
      return []
    } finally {
      setIsLoading(false)
    }
  }, [aiClient, node])

  return {
    isLoading,
    error,
    expandNode,
    generateRelatedNodes,
    improveNode,
    generateQuestions,
    isAvailable: !!aiClient,
  }
} 