'use client'

import React, { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { BoardBrief } from '../features/board/boardTypes'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import TextArea from './ui/TextArea'
import Button from './ui/Button'

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
  const [starterInput, setStarterInput] = useState('')
  const [starterNodes, setStarterNodes] = useState<string[]>([])

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
        starterNodes,
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
        starterNodes,
      })
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Create New Board"
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div>
          <TextInput
            label="Title"
            value={boardName}
            onChange={(e) => setBoardName((e.target as HTMLInputElement).value)}
            placeholder="e.g., My Project Ideas, Research Notes..."
            fullWidth
            required
            description="This is the name of your board and how it appears in your board list."
          />
        </div>
        
        <div>
          <TextInput
            value={boardTopic}
            onChange={(e) => setBoardTopic((e.target as HTMLInputElement).value)}
            placeholder="e.g., AI and productivity, Personal projects..."
            label="Topic (optional)"
            description="This helps the AI understand the context of your board. It can be changed later."
            fullWidth
          />
        </div>
        
        <div>
          <TextArea
            value={description}
            onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
            placeholder="Tell us more about what you want to work on, your goals, or any specific ideas..."
            label="Description (optional)"
            rows={3}
            fullWidth
            description="This provides additional context for AI-generated starter nodes."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Starter nodes (optional)
          </label>
          <div className="flex gap-2">
            <TextInput
              value={starterInput}
              onChange={(e) => setStarterInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  const val = starterInput.trim()
                  if (val && !starterNodes.includes(val)) {
                    setStarterNodes(prev => [...prev, val])
                    setStarterInput('')
                  }
                }
              }}
              placeholder="Type a node title and press Enter"
              fullWidth
            />
          </div>
          {starterNodes.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {starterNodes.map((title) => (
                <span key={title} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                  {title}
                  <button
                    onClick={() => setStarterNodes(prev => prev.filter(t => t !== title))}
                    className="ml-1 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                    aria-label={`Remove ${title}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Add any starting ideas. These will be created as nodes on your new board.
          </p>
        </div>
      </div>

      <div className="flex justify-between space-x-3 mt-6">
        <Button
          variant="secondary"
          onClick={onClose}
        >
          Cancel
        </Button>
        
        <div className="flex space-x-3">
          <Button
            variant="secondary"
            onClick={handleCreateBlank}
            disabled={!boardName.trim()}
          >
            Create Blank Board
          </Button>
          
          <Button
            variant="primary"
            onClick={handleStartWithAI}
            disabled={!boardName.trim()}
          >
            Start with AI
          </Button>
        </div>
      </div>
    </Modal>
  )
} 