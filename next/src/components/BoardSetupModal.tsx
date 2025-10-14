'use client'

import React, { useRef, useEffect, useState } from 'react'
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
  const [generateDescriptionsForStarter, setGenerateDescriptionsForStarter] = useState(true)
  const [generateStarterNodes, setGenerateStarterNodes] = useState(false)
  const titleInputRef = useRef<HTMLInputElement | null>(null)

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
      setGenerateDescriptionsForStarter(true)
      setGenerateStarterNodes(false)
    }
  }, [isOpen])

  // If user adds manual starter nodes, hide/disable Generate Starter Nodes
  React.useEffect(() => {
    if (starterNodes.length > 0 && generateStarterNodes) {
      setGenerateStarterNodes(false)
    }
  }, [starterNodes, generateStarterNodes])

  // Focus the Title field when entering Step 3
  useEffect(() => {
    if (isOpen && currentStep === 3) {
      // Slight delay to allow the input to mount
      const t = setTimeout(() => {
        try { titleInputRef.current?.focus() } catch {}
      }, 0)
      return () => clearTimeout(t)
    }
  }, [isOpen, currentStep])

  const handleNextStep = () => {
    if (currentStep === 1) {
      if (boardTopic.trim()) setCurrentStep(2)
      return
    }
    if (currentStep === 2) {
      setCurrentStep(3)
      return
    }
  }

  const handlePreviousStep = () => {
    if (currentStep === 2) {
      setCurrentStep(1)
      return
    }
    if (currentStep === 3) {
      setCurrentStep(2)
      return
    }
  }

  const handleCreateBoard = () => {
    if (boardName.trim()) {
      onComplete({
        id: boardId,
        boardName: boardName.trim(),
        boardTopic: boardTopic.trim(),
        description: description.trim(),
        startWithAI: !!generateStarterNodes || (starterNodes.length > 0),
        starterNodes: generateStarterNodes ? [] : starterNodes,
        generateDescriptionsForStarter,
      })
    }
  }

  const handleCancel = () => {
    onClose()
  }

  const renderStep1 = () => (
    <div className="space-y-6 mt-8 mb-12 items-start text-left">
      <div>
        <TextInput
          value={boardTopic}
          onChange={(e) => setBoardTopic((e.target as HTMLInputElement).value)}
          placeholder="e.g. 'garden plan', 'storyboard for short film', etc."
          label="Topic"
          description="This helps the AI understand the context of your board in a few words. It can be changed later."
          fullWidth
          required
        />
      </div>
      <div>
        <TextArea
          value={description}
          onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
          placeholder="e.g. 'We're going to plant a garden in my backyard and I need to plan the layout and get the supplies.'"
          label="Description (optional)"
          rows={3}
          fullWidth
          description="Describe your board in a few sentences. This also gives the AI more context."
        />
      </div>
    </div>
  )

  const renderStep2 = () => (
    <div className="space-y-6 mt-8 mb-12 items-start text-left">
      <div>
        {!generateStarterNodes && (
          <>
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
          </>
        )}
      </div>

      {starterNodes.length === 0 && (
        <div className="flex items-start">
          <Checkbox
            checked={generateStarterNodes}
            onChange={(checked) => setGenerateStarterNodes(!!checked)}
            label="Generate Starter Nodes"
            description="Pre-populate the board - let AI create a few starter nodes for you."
          />
        </div>
      )}

      {(generateStarterNodes || starterNodes.length > 0) && (
        <div className="flex items-start">
          <Checkbox
            checked={generateDescriptionsForStarter}
            onChange={(checked) => setGenerateDescriptionsForStarter(!!checked)}
            aria-label="Generate AI Descriptions"
            description="Write short descriptions for starter nodes."
            label="Generate AI Descriptions"
          />
        </div>
      )}
    </div>
  )

  const renderStep3 = () => (
    <div className="space-y-4 mt-8 mb-12 items-start text-left">
      <div>
        <TextInput
          label="Title"
          value={boardName}
          onChange={(e) => setBoardName(((e.target as HTMLInputElement).value || '').slice(0, 80))}
          placeholder="e.g., My Project Ideas, Research Notes..."
          fullWidth
          required
          ref={titleInputRef}
          description="This is the name of your board and how it appears in your board room."
        />
      </div>
      
      <div className="mt-8">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Board Summary</h3>
        <div className="overflow-hidden rounded-md border border-gray-200 dark:border-gray-700">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 text-gray-700 dark:text-gray-300">
              <tr className="bg-white/70 dark:bg-gray-950/50">
                <td className="w-40 px-3 py-2 font-medium text-gray-900 dark:text-white align-top">Topic</td>
                <td className="px-3 py-2">{boardTopic || 'Not specified'}</td>
              </tr>
              <tr className="bg-white/60 dark:bg-gray-950/50">
                <td className="w-40 px-3 py-2 font-medium text-gray-900 dark:text-white align-top">Description</td>
                <td className="px-3 py-2">{description || 'Not specified'}</td>
              </tr>
              <tr className="bg-white/70 dark:bg-gray-950/50">
                <td className="w-40 px-3 py-2 font-medium text-gray-900 dark:text-white align-top">Starter nodes</td>
                <td className="px-3 py-2">
                  {starterNodes.length > 0 ? starterNodes.join(', ') : (generateStarterNodes ? 'AI Generated' : 'None')}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderActions = () => {
    if (currentStep === 1) {
      return (
        <div className="flex justify-between space-x-3">
          <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleNextStep} disabled={!boardTopic.trim()}>Next</Button>
        </div>
      )
    }
    if (currentStep === 2) {
      return (
        <div className="flex justify-between space-x-3">
          <Button variant="secondary" onClick={handlePreviousStep}>Back</Button>
          <Button variant="primary" onClick={handleNextStep}>Next</Button>
        </div>
      )
    }
    return (
      <div className="flex justify-between space-x-3">
        <Button variant="secondary" onClick={handlePreviousStep}>Back</Button>
        <Button variant="primary" onClick={handleCreateBoard} disabled={!boardName.trim()}>Create Board</Button>
      </div>
    )
  }

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={currentStep === 1 ? "Set Up Your Board" : currentStep === 2 ? "Choose Your Starters" : "Save Your Board"}
      description={currentStep === 1
        ? "Tell us about what you want to work on"
        : currentStep === 2
          ? "Add or generate starter nodes and optional descriptions.\n(check 'Generate Starter Nodes' to pre-populate the board)"
          : "Give your board a name"}
      className="max-w-2xl text-center"
      currentStep={currentStep - 1} // 0-indexed for the step indicator
      totalSteps={3}
    >
      {currentStep === 1 ? renderStep1() : currentStep === 2 ? renderStep2() : renderStep3()}
      {renderActions()}
    </Modal>
  )
} 