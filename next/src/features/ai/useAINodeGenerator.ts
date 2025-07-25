'use client'

import { useState } from 'react'

export function useAINodeGenerator() {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateNode = async () => {
    // Stub implementation
    return null
  }

  return { generateNode, isGenerating, error }
} 