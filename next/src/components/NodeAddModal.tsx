'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import TextArea from './ui/TextArea'
import Button from './ui/Button'

interface NodeAddModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (payload: { titles: string[]; description?: string }) => void
}

export default function NodeAddModal({ open, onClose, onSubmit }: NodeAddModalProps) {
  const [titleInput, setTitleInput] = useState('')
  const [titles, setTitles] = useState<string[]>([])
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (open) {
      setTitleInput('')
      setTitles([])
      setDescription('')
    }
  }, [open])

  const effectiveTitles = useMemo(() => {
    const t = titleInput.trim()
    return t ? [...titles, t] : [...titles]
  }, [titles, titleInput])

  const canSubmit = effectiveTitles.length > 0
  // Hide description as soon as a pill exists (user pressed Enter)
  const showDescription = titles.length === 0

  const addTitle = () => {
    const t = titleInput.trim()
    if (!t) return
    if (!titles.includes(t)) setTitles(prev => [...prev, t])
    setTitleInput('')
  }

  const removeTitle = (t: string) => {
    setTitles(prev => prev.filter(x => x !== t))
  }

  const handleSubmit = () => {
    if (!canSubmit) return
    const payload = { titles: effectiveTitles, description: showDescription ? description.trim() : undefined }
    onSubmit(payload)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={effectiveTitles.length > 1 ? 'Add Nodes' : 'Add Node'}
      className="max-w-xl"
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSubmit} disabled={!canSubmit}>Add</Button>
        </>
      }
    >
      <div className="space-y-4 py-2">
        <div>
          <TextInput
            label={titles.length > 0 ? 'Add another title' : 'Title'}
            value={titleInput}
            onChange={(e) => setTitleInput((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTitle()
              }
            }}
            placeholder={titles.length > 0 ? 'Type and press Enter to add' : 'e.g., Research Topic, Idea, Task...'}
            fullWidth
          />
          {titles.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {titles.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                  {t}
                  <button
                    onClick={() => removeTitle(t)}
                    className="ml-1 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                    aria-label={`Remove ${t}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {showDescription && (
          <div>
            <TextArea
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
              placeholder="Add details, notes, or context for this node..."
              rows={3}
              fullWidth
              description="Hidden when adding multiple nodes."
            />
          </div>
        )}
      </div>
    </Modal>
  )
}


