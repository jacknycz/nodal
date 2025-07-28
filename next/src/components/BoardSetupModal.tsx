'use client'

import React, { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { BoardBrief } from '../features/board/boardTypes'

interface BoardSetupModalProps {
  isOpen: boolean
  onComplete: (brief: BoardBrief) => void
  onClose: () => void
}

export default function BoardSetupModal({ isOpen, onComplete, onClose }: BoardSetupModalProps) {
  const [boardName, setBoardName] = useState('')
  const [boardTopic, setBoardTopic] = useState('')
  const [description, setDescription] = useState('')
  const [boardId, setBoardId] = useState<string>('')

  // Generate a new board ID when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setBoardId(uuidv4())
    }
  }, [isOpen])

  const handleStartWithAI = () => {
    if (boardName.trim()) {
      onComplete({
        id: boardId,
        boardName: boardName.trim(),
        boardTopic: boardTopic.trim(),
        description: description.trim(),
        startWithAI: true,
      })
    }
  }

  const handleCreateBlank = () => {
    if (boardName.trim()) {
      onComplete({
        id: boardId,
        boardName: boardName.trim(),
        boardTopic: boardTopic.trim(),
        description: description.trim(),
        startWithAI: false,
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
              Title *
            </label>
            <input
              type="text"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder="e.g., My Project Ideas, Research Notes..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This is the name of your board and how it appears in your board list.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Topic (optional)
            </label>
            <input
              type="text"
              value={boardTopic}
              onChange={(e) => setBoardTopic(e.target.value)}
              placeholder="e.g., AI and productivity, Personal projects..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This helps the AI understand the context of your board. It can be changed later.
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tell us more about what you want to work on, your goals, or any specific ideas..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              rows={3}
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              This provides additional context for AI-generated starter nodes.
            </p>
          </div>
        </div>
        
        <div className="flex justify-between space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Cancel
          </button>
          
          <div className="flex space-x-3">
            <button
              onClick={handleCreateBlank}
              disabled={!boardName.trim()}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              Create Blank Board
            </button>
            
            <button
              onClick={handleStartWithAI}
              disabled={!boardName.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-md transition-colors"
            >
              Start with AI
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 