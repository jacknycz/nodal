'use client'

import React, { useState, useEffect, useRef } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import IconButton from './ui/IconButton'
import { CrosshairSimple } from '@phosphor-icons/react'
import Tooltip from './ui/Tooltip'
import Checkbox from './ui/Checkbox'
import TipTapEditor from './TipTapEditor'
import TextInput from './ui/TextInput'
import MultiSelect from './ui/MultiSelect'
import Select from './ui/Select'
import ToggleGroup from './ui/ToggleGroup'
import { useBoardStore } from '../features/board/boardSlice'

type TitleSize = 'sm' | 'md' | 'lg' | 'xl'

interface NodeEditModalProps {
  open: boolean
  onClose: () => void
  onSave: (title: string, content: string, colorgoryIds?: string[], titleSize?: TitleSize, pageMode?: boolean) => void
  onLiveChange?: (title: string, content: string, colorgoryIds?: string[], titleSize?: TitleSize, pageMode?: boolean) => void
  onLocate?: () => void
  initialTitle: string
  initialContent: string
  initialColorgoryIds?: string[]
  initialTitleSize?: TitleSize
  initialPageMode?: boolean
  showContent?: boolean
  showPageMode?: boolean
  titleSizeOptions?: TitleSize[]
  showTitle?: boolean
  showTitleSize?: boolean
  // Optional assignment selector
  assignOptions?: Array<{ value: string; label: string }>
  assignValue?: string | null
  onAssignChange?: (value: string | null) => void
  assignLabel?: string
  // When true, auto-focus the title field even if content editor is shown
  focusTitleFirst?: boolean
}

export default function NodeEditModal({ 
  open, 
  onClose, 
  onSave, 
  onLiveChange,
  onLocate,
  initialTitle, 
  initialContent,
  initialColorgoryIds = [],
  initialTitleSize = 'sm',
  initialPageMode = false,
  showContent = true,
  showPageMode = true,
  titleSizeOptions = ['sm','md','lg'],
  showTitle = true,
  showTitleSize = true,
  assignOptions,
  assignValue,
  onAssignChange,
  assignLabel = 'Assign',
  focusTitleFirst = false,
}: NodeEditModalProps) {
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [selectedColorgoryIds, setSelectedColorgoryIds] = useState<string[]>(initialColorgoryIds)
  const [titleSize, setTitleSize] = useState<TitleSize>(initialTitleSize)
  const [pageMode, setPageMode] = useState<boolean>(!!initialPageMode)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const editorHandleRef = useRef<{ focus: () => void } | null>(null)
  const didAutoFocusRef = useRef<boolean>(false)
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
    }
  }, [open, initialTitle, initialContent, initialColorgoryIds, initialTitleSize, initialPageMode])

  // Auto-focus only once when opening. Do not steal focus from title if user clicked it.
  useEffect(() => {
    if (!open) { didAutoFocusRef.current = false; return }
    if (didAutoFocusRef.current) return
    const t = setTimeout(() => {
      didAutoFocusRef.current = true
      const active = document.activeElement as HTMLElement | null
      if (active && titleInputRef.current && active === titleInputRef.current) return
      try {
        if (!focusTitleFirst && showContent && editorHandleRef.current && typeof editorHandleRef.current.focus === 'function') {
          editorHandleRef.current.focus()
        } else {
          titleInputRef.current?.focus()
        }
      } catch {}
    }, 100)
    return () => clearTimeout(t)
  }, [open, showContent, focusTitleFirst])

  const handleSave = () => {
    const trimmed = (title || '').trim()
    if (!trimmed) {
      try { titleInputRef.current?.focus() } catch {}
      return
    }
    onSave(trimmed, content, selectedColorgoryIds, titleSize, pageMode)
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

  // Allow Delete key to delete selected nodes while modal is open
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      // Don't interfere with text editing inside inputs/editors
      const active = document.activeElement as HTMLElement | null
      if (active) {
        const tag = active.tagName
        if (active.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA') return
      }
      const store = useBoardStore.getState() as any
      const selectedIds: string[] = Array.isArray(store?.selectedNodeIds) ? store.selectedNodeIds : []
      if (selectedIds.length === 0) return
      e.preventDefault()
      e.stopPropagation()
      try {
        selectedIds.forEach((id) => {
          window.dispatchEvent(new CustomEvent('nodal:delete-node', { detail: { id } }))
        })
      } catch {}
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Node"
      className="w-full lg:max-w-[40%]! max-w-7xl! h-[85vh]!"
      backdropClassName="bg-black lg:bg-orange-950/5 dark:lg:bg-gray-950/5"
      backdropInteractive={false}
      closeOnBackdropClick={false}
      scrollBody={false}
      showCloseButton
      alignLeftLg
      actions={
        <div className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tooltip content="Find My Node" side="top">
              <IconButton aria-label="Find My Node" variant="secondaryGhost" size="md" onClick={() => onLocate?.()} className="hidden lg:inline-flex">
                <CrosshairSimple className="w-6 h-6" />
              </IconButton>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!title.trim()}
            >
              Save Changes
            </Button>
          </div>
        </div>
      }
    >
      <div className="gap-4 py-2 flex-1 min-h-0 h-full flex flex-col overflow-hidden basis-0">
        {(showTitle || showTitleSize) && (
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-none">
            {showTitle && (
              <div className="flex-1">
                <TextInput
                  ref={titleInputRef}
                  id="edit-title"
                  type="text"
                  value={title}
                  onChange={(e) => { const v = e.target.value; setTitle(v); onLiveChange?.(v, content, selectedColorgoryIds, titleSize, pageMode) }}
                  onKeyDown={handleTitleKeyDown}
                  placeholder="Enter node title..."
                  fullWidth
                  label="Title"
                />
              </div>
            )}
            {showTitleSize && titleSizeOptions.length > 0 && (
              <div className="sm:w-auto">
                <ToggleGroup
                  label="Size"
                  value={titleSize}
                  onChange={(v) => { const vs = (v as any) as TitleSize; setTitleSize(vs); onLiveChange?.(title, content, selectedColorgoryIds, vs, pageMode) }}
                  options={titleSizeOptions.map((sz) => ({ value: sz, label: sz.toUpperCase() }))}
                  size="sm"
                />
              </div>
            )}
          </div>
        )}
        {/* Optional assignment selector (moved below editor) */}
        {showPageMode && (
          <div className="flex-none">
            <Checkbox
              checked={pageMode}
              onChange={(v) => { const pv = !!v; setPageMode(pv); onLiveChange?.(title, content, selectedColorgoryIds, titleSize, pv) }}
              label="Page Mode"
            />
          </div>
        )}
        {/* <MultiSelect
          label="Colorgories"
          values={selectedColorgoryIds}
          onChange={setSelectedColorgoryIds}
          options={colorgories.map((c: any) => ({ value: c.id, label: c.name }))}
          size="sm"
          fullWidth
        /> */}
        {showContent && (
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden basis-0">
            <label htmlFor="edit-content" aria-description="Content" className="hidden text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content
            </label>
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-themed">
              <TipTapEditor
                content={content}
                onChange={(v) => { setContent(v); onLiveChange?.(title, v, selectedColorgoryIds, titleSize, pageMode) }}
                placeholder="Start writing your node content..."
                onKeyDown={handleContentKeyDown}
                editorHandleRef={editorHandleRef}
                className="h-full"
              />
            </div>
          </div>
        )}
        {Array.isArray(assignOptions) && assignOptions.length > 1 && (
          <div className="flex-none">
            <div className="w-full flex items-center justify-end gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{assignLabel}</span>
              <Select
                value={assignValue || ''}
                onChange={(v) => onAssignChange?.((v as string))}
                options={[{ value: '', label: 'Unassigned' }, ...assignOptions]}
                size="sm"
                className="min-w-40"
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
} 