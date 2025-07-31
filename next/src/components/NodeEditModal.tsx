'use client'

import React, { useState, useEffect } from 'react'
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

  useEffect(() => {
    if (open) {
      setTitle(initialTitle)
      setContent(initialContent)
    }
  }, [open, initialTitle, initialContent])

  const handleSave = () => {
    onSave(title, content)
    onClose()
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
            id="edit-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
          />
        </div>
      </div>
    </Modal>
  )
} 