'use client'

import React, { useState, useEffect, useRef } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Checkbox from './ui/Checkbox'
import TipTapEditor from './TipTapEditor'
import TextInput from './ui/TextInput'
import MultiSelect from './ui/MultiSelect'
import ToggleGroup from './ui/ToggleGroup'
import { useBoardStore } from '../features/board/boardSlice'

interface NodeEditModalProps {
  open: boolean
  onClose: () => void
  onSave: (title: string, content: string, colorgoryIds?: string[], titleSize?: 'sm' | 'md' | 'lg', pageMode?: boolean) => void
  initialTitle: string
  initialContent: string
  initialColorgoryIds?: string[]
  initialTitleSize?: 'sm' | 'md' | 'lg'
  initialPageMode?: boolean
}

export default function NodeEditModal({ 
  open, 
  onClose, 
  onSave, 
  initialTitle, 
  initialContent,
  initialColorgoryIds = [],
  initialTitleSize = 'sm',
  initialPageMode = false,
}: NodeEditModalProps) {
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [selectedColorgoryIds, setSelectedColorgoryIds] = useState<string[]>(initialColorgoryIds)
  const [titleSize, setTitleSize] = useState<'sm' | 'md' | 'lg'>(initialTitleSize)
  const [pageMode, setPageMode] = useState<boolean>(!!initialPageMode)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const editorHandleRef = useRef<{ focus: () => void } | null>(null)
  const colorgories = useBoardStore.getState().colorgories || []

  useEffect(() => {
    if (open) {
      setTitle(prev => (prev !== initialTitle ? initialTitle : prev))
      setContent(prev => (prev !== initialContent ? initialContent : prev))
      setTitleSize(prev => (prev !== initialTitleSize ? initialTitleSize : prev))
      setPageMode(prev => (prev !== initialPageMode ? !!initialPageMode : prev))
      setSelectedColorgoryIds(prev => {
        const next = initialColorgoryIds
        const sameLength = prev.length === next.length
        const same = sameLength && prev.every((v, i) => v === next[i])
        return same ? prev : next
      })
      // Focus the content editor first after a brief delay to ensure modal is rendered
      setTimeout(() => {
        if (editorHandleRef.current && typeof editorHandleRef.current.focus === 'function') {
          try { editorHandleRef.current.focus() } catch {}
        } else {
          titleInputRef.current?.focus()
        }
      }, 100)
    }
  }, [open, initialTitle, initialContent, initialColorgoryIds])

  const handleSave = () => {
    onSave(title, content, selectedColorgoryIds, titleSize, pageMode)
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
      className="w-full md:max-w-[40%]! max-w-7xl! h-[85vh]!"
      backdropClassName="hidden! bg-black/20"
      backdropInteractive={false}
      closeOnBackdropClick={false}
      scrollBody={false}
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
      <div className="gap-4 py-2 flex-1 min-h-0 h-full flex flex-col overflow-hidden basis-0">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-none">
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
              onChange={(v) => setTitleSize((v as any) as 'sm' | 'md' | 'lg')}
              options={[
                { value: 'sm', label: 'S' },
                { value: 'md', label: 'M' },
                { value: 'lg', label: 'L' },
              ]}
              size="sm"
            />
          </div>
        </div>
        <div className="flex-none">
          <Checkbox
            checked={pageMode}
            onChange={(v) => setPageMode(!!v)}
            label="Page Mode"
          />
        </div>
        {/* <MultiSelect
          label="Colorgories"
          values={selectedColorgoryIds}
          onChange={setSelectedColorgoryIds}
          options={colorgories.map((c: any) => ({ value: c.id, label: c.name }))}
          size="sm"
          fullWidth
        /> */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden basis-0">
          <label htmlFor="edit-content" aria-description="Content" className="hidden text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Content
          </label>
          <TipTapEditor
            content={content}
            onChange={setContent}
            placeholder="Start writing your node content..."
            onKeyDown={handleContentKeyDown}
            editorHandleRef={editorHandleRef}
            className="flex-1 min-h-[320px]"
          />
        </div>
      </div>
    </Modal>
  )
} 