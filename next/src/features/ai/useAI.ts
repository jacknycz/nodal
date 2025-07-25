'use client'

import { useCallback } from 'react'

interface AIGenerateOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

interface AIResponse {
  content: string
}

export function useAI() {
  const generate = useCallback(async (prompt: string, options: AIGenerateOptions = {}): Promise<AIResponse> => {
    // Stub implementation
    return { content: 'AI response coming soon...' }
  }, [])

  return { generate }
} 