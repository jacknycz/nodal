'use client'

import React, { useState } from 'react'

interface BoardBrief {
  topic: string
  ramble: string
  goal: string
  audience: string
  resources: string[]
  aiHelpPreferences: string[]
  notes?: string
  isReady?: boolean
  preSessionChat?: { role: 'user' | 'ai', content: string }[]
}

interface BoardSetupModalProps {
  isOpen: boolean
  onComplete: (brief: BoardBrief) => void
  onClose: () => void
}

export default function BoardSetupModal({ isOpen, onComplete, onClose }: BoardSetupModalProps) {
  const [topic, setTopic] = useState('')
  const [ramble, setRamble] = useState('')

  const handleCreate = () => {
    if (topic.trim()) {
      onComplete({
        topic: topic.trim(),
        ramble: ramble.trim(),
        goal: 'Freeform',
        audience: 'Personal',
        resources: [],
        aiHelpPreferences: ['Suggest'],
        isReady: true,
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4">
        <h2 className="text-xl font-semibold mb-4">Create New Board</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Topic
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Project Ideas, Research Notes..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (optional)
            </label>
            <textarea
              value={ramble}
              onChange={(e) => setRamble(e.target.value)}
              placeholder="Tell us more about what you want to work on..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              rows={3}
            />
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!topic.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            Create Board
          </button>
        </div>
      </div>
    </div>
  )
} 