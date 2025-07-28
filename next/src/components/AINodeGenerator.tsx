'use client'

import React, { useState } from 'react'

interface AINodeGeneratorProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (nodeData: { label: string; content?: string }) => void
  initialContext?: { topic?: string; description?: string }
}

export default function AINodeGenerator({
  isOpen,
  onClose,
  onGenerate,
  initialContext,
}: AINodeGeneratorProps) {
  const [prompt, setPrompt] = useState('')

  // Pre-populate prompt with context when modal opens
  React.useEffect(() => {
    if (isOpen && initialContext) {
      const contextPrompt = [
        initialContext.topic && `Topic: ${initialContext.topic}`,
        initialContext.description && `Description: ${initialContext.description}`,
        'Generate starter nodes for this board:'
      ].filter(Boolean).join('\n\n')
      setPrompt(contextPrompt)
    }
  }, [isOpen, initialContext])

  if (!isOpen) return null

  const handleGenerate = () => {
    if (prompt.trim()) {
      onGenerate({ label: prompt.trim() })
      setPrompt('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full">
        <h2 className="text-xl font-bold mb-4">Generate AI Node</h2>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the node you want to generate..."
          className="w-full p-3 border border-gray-300 rounded-lg mb-4 h-32 resize-none"
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            Generate
          </button>
        </div>
      </div>
    </div>
  )
} 