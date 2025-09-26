'use client'

import React, { useState, useEffect, useRef } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import TipTapEditor from './TipTapEditor'
import TextInput from './ui/TextInput'
import MultiSelect from './ui/MultiSelect'
import ToggleGroup from './ui/ToggleGroup'
import { useBoardStore } from '../features/board/boardSlice'

interface NodeEditModalProps {
  open: boolean
  onClose: () => void
  onSave: (title: string, content: string, colorgoryIds?: string[], titleSize?: 'sm' | 'md' | 'lg') => void
  initialTitle: string
  initialContent: string
  initialColorgoryIds?: string[]
  initialTitleSize?: 'sm' | 'md' | 'lg'
}

export default function NodeEditModal({ 
  open, 
  onClose, 
  onSave, 
  initialTitle, 
  initialContent,
  initialColorgoryIds = [],
  initialTitleSize = 'sm'
}: NodeEditModalProps) {
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [selectedColorgoryIds, setSelectedColorgoryIds] = useState<string[]>(initialColorgoryIds)
  const [titleSize, setTitleSize] = useState<'sm' | 'md' | 'lg'>(initialTitleSize)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const editorHandleRef = useRef<{ focus: () => void } | null>(null)
  const colorgories = useBoardStore.getState().colorgories || []

  useEffect(() => {
    if (open) {
      setTitle(prev => (prev !== initialTitle ? initialTitle : prev))
      setContent(prev => (prev !== initialContent ? initialContent : prev))
      setTitleSize(prev => (prev !== initialTitleSize ? initialTitleSize : prev))
      setSelectedColorgoryIds(prev => {
        const next = initialColorgoryIds
        const sameLength = prev.length === next.length
        const same = sameLength && prev.every((v, i) => v === next[i])
        return same ? prev : next
      })
      // Focus the title input after a brief delay to ensure modal is rendered
      setTimeout(() => {
        titleInputRef.current?.focus()
      }, 100)
    }
  }, [open, initialTitle, initialContent, initialColorgoryIds])

  const handleSave = () => {
    onSave(title, content, selectedColorgoryIds, titleSize)
    onClose()
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      setTimeout(() => editorHandleRef.current?.focus(), 0)
      return
    }
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
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <TextInput
              ref={titleInputRef}
              id="edit-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              placeholder="Enter node title..."
              fullWidth
              label="Title"
            />
          </div>
          <div className="sm:w-auto">
            <ToggleGroup
              label="Size"
              value={titleSize}
              onChange={setTitleSize}
              options={[
                { value: 'sm', label: 'S' },
                { value: 'md', label: 'M' },
                { value: 'lg', label: 'L' },
              ]}
              size="sm"
            />
          </div>
        </div>
        {/* <MultiSelect
          label="Colorgories"
          values={selectedColorgoryIds}
          onChange={setSelectedColorgoryIds}
          options={colorgories.map((c: any) => ({ value: c.id, label: c.name }))}
          size="sm"
          fullWidth
        /> */}
        <div>
          <label htmlFor="edit-content" aria-description="Content" className="hidden text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content
          </label>
          <TipTapEditor
            content={content}
            onChange={setContent}
            placeholder="Start writing your node content..."
            onKeyDown={handleContentKeyDown}
            editorHandleRef={editorHandleRef}
          />
        </div>
      </div>
    </Modal>
  )
} 