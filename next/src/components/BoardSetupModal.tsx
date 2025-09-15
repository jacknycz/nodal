'use client'

import React, { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type { BoardBrief } from '../features/board/boardTypes'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import TextArea from './ui/TextArea'
import Button from './ui/Button'
import Tag from './ui/Tag'
import { XCircle } from '@phosphor-icons/react/dist/ssr'
import Toggle from './ui/Toggle'
import Checkbox from './ui/Checkbox'

interface BoardSetupModalProps {
  isOpen: boolean
  onComplete: (brief: BoardBrief) => void
  onClose: () => void
}

export default function BoardSetupModal({ isOpen, onComplete, onClose }: BoardSetupModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [boardName, setBoardName] = useState('')
  const [boardTopic, setBoardTopic] = useState('')
  const [description, setDescription] = useState('')
  const [boardId, setBoardId] = useState<string>('')
  const [starterInput, setStarterInput] = useState('')
  const [starterNodes, setStarterNodes] = useState<string[]>([])
  const [generateDescriptionsForStarter, setGenerateDescriptionsForStarter] = useState(false)

  // Generate a new board ID when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setBoardId(uuidv4())
      setCurrentStep(1)
      // Reset form when opening
      setBoardName('')
      setBoardTopic('')
      setDescription('')
      setStarterInput('')
      setStarterNodes([])
      setGenerateDescriptionsForStarter(false)
    }
  }, [isOpen])

  const handleNextStep = () => {
    if (currentStep === 1 && boardTopic.trim()) {
      setCurrentStep(2)
    }
  }

  const handlePreviousStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1)
    }
  }

  const handleCreateBoard = () => {
    if (boardName.trim()) {
      onComplete({
        id: boardId,
        boardName: boardName.trim(),
        boardTopic: boardTopic.trim(),
        description: description.trim(),
        startWithAI: true,
        starterNodes,
        generateDescriptionsForStarter,
      })
    }
  }

  const handleCancel = () => {
    onClose()
  }

  const renderStep1 = () => (
    <div className="space-y-6 mt-8 mb-12">
      <div>
        <TextInput
          value={boardTopic}
          onChange={(e) => setBoardTopic((e.target as HTMLInputElement).value)}
          placeholder="e.g., AI and productivity, Personal projects..."
          label="Topic"
          description="This helps the AI understand the context of your board. It can be changed later."
          fullWidth
          required
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
        <div className="flex gap-2">
          <TextInput
            value={starterInput}
            label="Starter nodes (optional)"
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
              <Tag
                key={title}
                variant="secondary"
                className="px-2 py-1 text-xs"
                rightIcon={<XCircle className="text-gray-500 dark:text-gray-400 cursor-pointer" size={12} weight="duotone" />}
                onRightIconClick={() => setStarterNodes(prev => prev.filter(t => t !== title))}
              >
                {title}
              </Tag>
            ))}
          </div>
        )}
        <p className="text-xs text-left text-gray-500 dark:text-gray-400 mt-1">
          Add any starting ideas. These will be created as nodes on your new board.
        </p>
      </div>

      <div className="flex items-start">
        <Checkbox
          checked={generateDescriptionsForStarter}
          onChange={(checked) => setGenerateDescriptionsForStarter(!!checked)}
          aria-label="Generate AI Description"
          description="Write short descriptions for starter nodes."
          label="Generate AI Description"
        />
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-4 mt-8 mb-12">
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
      
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Board Summary</h3>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <div><strong>Topic:</strong> {boardTopic || 'Not specified'}</div>
          <div><strong>Description:</strong> {description || 'Not specified'}</div>
          <div><strong>Starter nodes:</strong> {starterNodes.length > 0 ? starterNodes.join(', ') : 'None'}</div>
        </div>
      </div>
    </div>
  )

  const renderActions = () => {
    if (currentStep === 1) {
      return (
        <div className="flex justify-between space-x-3">
          <Button
            variant="secondary"
            onClick={handleCancel}
          >
            Cancel
          </Button>
          
          <Button
            variant="primary"
            onClick={handleNextStep}
            disabled={!boardTopic.trim()}
          >
            Next
          </Button>
        </div>
      )
    } else {
      return (
        <div className="flex justify-between space-x-3">
          <Button
            variant="secondary"
            onClick={handlePreviousStep}
          >
            Back
          </Button>
          
          <Button
            variant="primary"
            onClick={handleCreateBoard}
            disabled={!boardName.trim()}
          >
            Create Board
          </Button>
        </div>
      )
    }
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={currentStep === 1 ? "Set Up Your Board" : "Save Your Board"}
      description={currentStep === 1 ? "Tell us about what you want to work on" : "Give your board a name"}
      className="max-w-2xl text-center"
      currentStep={currentStep - 1} // 0-indexed for the step indicator
      totalSteps={2}
    >
      {currentStep === 1 ? renderStep1() : renderStep2()}
      {renderActions()}
    </Modal>
  )
} 