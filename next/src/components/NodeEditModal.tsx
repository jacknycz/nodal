'use client'

import React, { useState, useEffect, useRef } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import TipTapEditor from './TipTapEditor'

interface NodeEditModalProps {
  open: boolean
  onClose: () => void
  onSave: (title: string, content: string) => void
  initialTitle: string
  initialContent: string
}

export default function NodeEditModal({ 
  open, 
  onClose, 
  onSave, 
  initialTitle, 
  initialContent 
}: NodeEditModalProps) {
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setContent(initialContent)
      // Focus the title input after a brief delay to ensure modal is rendered
      setTimeout(() => {
        titleInputRef.current?.focus()
      }, 100)
    }
  }, [open, initialTitle, initialContent])

  const handleSave = () => {
    onSave(title, content)
    onClose()
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    }
  }

  const handleContentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Node"
      description="Update the node's title and content with rich text formatting."
      actions={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
          >
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        <div>
          <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Title
          </label>
          <input
            ref={titleInputRef}
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleTitleKeyDown}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter node title..."
          />
        </div>
        <div>
          <label htmlFor="edit-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content
          </label>
          <TipTapEditor
            content={content}
            onChange={setContent}
            placeholder="Start writing your node content..."
            onKeyDown={handleContentKeyDown}
          />
        </div>
      </div>
    </Modal>
  )
} 