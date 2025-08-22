'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import Checkbox from '../../components/ui/Checkbox'
import TextInput from '../../components/ui/TextInput'
import IconButton from '../../components/ui/IconButton'
import { Trash, Headlights } from "@phosphor-icons/react/ssr";
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { useBoardStore } from '../board/boardSlice'

interface TaskNodeData {
  title?: string
  type?: 'task'
  completed?: boolean
}

interface TaskNodeProps {
  data: TaskNodeData
  id: string
  selected?: boolean
  onNodeDelete?: (nodeId: string) => void
  onNodeUpdate?: (nodeId: string, updates: Partial<TaskNodeData>) => void
  // Locking
  acquireNodeLock?: (nodeId: string) => Promise<boolean>
  releaseNodeLock?: (nodeId: string) => Promise<void>
  isNodeLocked?: (nodeId: string) => boolean
  getNodeLockOwner?: (nodeId: string) => string | undefined
  isNodeLockedByMe?: (nodeId: string) => boolean
  nodeLocks?: any[]
  // Focus/connect helpers
  focusedNodeIds?: string[]
  toggleFocusOnNode?: (nodeId: string) => void
  onNodeShiftClickConnect?: (targetId: string) => void
}

export default function TaskNode({
  data,
  id,
  selected,
  onNodeDelete,
  onNodeUpdate,
  acquireNodeLock,
  releaseNodeLock,
  isNodeLocked,
  isNodeLockedByMe,
  toggleFocusOnNode,
  onNodeShiftClickConnect,
}: TaskNodeProps) {
  const [title, setTitle] = useState(data.title || '')
  const [completed, setCompleted] = useState<boolean>(!!data.completed)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const isLocked = isNodeLocked?.(id) || false
  const lockedByMe = isNodeLockedByMe?.(id) || false

  // Focus state wiring
  const focusedNodeIds = useBoardStore((s) => s.focusedNodeIds || [])
  const focusAnchorIds = useBoardStore((s: any) => s.focusAnchorIds || [])
  const storeEdges = useBoardStore((s: any) => s.edges || [])
  const hasFocus = Array.isArray(focusedNodeIds) && focusedNodeIds.length > 0
  const isFocusedBase = hasFocus ? focusedNodeIds.includes(id) : false
  const isAdjacentToAnchor = Array.isArray(focusAnchorIds) && focusAnchorIds.length > 0
    ? (storeEdges || []).some((e: any) => {
        const src = typeof e.source === 'string' ? e.source : (e.source as any)?.id
        const tgt = typeof e.target === 'string' ? e.target : (e.target as any)?.id
        return (src === id && focusAnchorIds.includes(tgt)) || (tgt === id && focusAnchorIds.includes(src)) || focusAnchorIds.includes(id)
      })
    : false
  const isFocused = isFocusedBase || isAdjacentToAnchor

  useEffect(() => {
    setTitle(data.title || '')
    setCompleted(!!data.completed)
  }, [data.title, data.completed])

  const commitTitle = (value: string) => {
    if (value !== data.title) {
      onNodeUpdate?.(id, { title: value })
    }
  }

  const handleTitleBlur = () => {
    commitTitle(title.trim())
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur()
    }
  }

  const handleToggleCompleted = (next: boolean) => {
    setCompleted(next)
    onNodeUpdate?.(id, { completed: next })
  }

  const glowClass = isFocused
    ? 'shadow-[0_0_0_3px_rgba(59,130,246,0.2)]'
    : isLocked && !lockedByMe
      ? 'shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
      : ''

  const borderClass = (() => {
    if (isFocused) return '!border-primary-500'
    if (selected) return '!border-primary-500'
    if (isLocked && !lockedByMe) return '!border-red-500'
    return 'border-transparent dark:border-transparent'
  })()

  return (
    <div
      className={`flex flex-col justify-start text-left p-3 min-w-[220px] max-w-[420px] bg-white dark:bg-gray-800 border border-transparent rounded-lg shadow-sm shadow-gray-400/20 dark:shadow-none group ${glowClass} ${borderClass} ${isFocused ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400/50' : ''}`}
      onClick={(e) => {
        if (e.shiftKey) {
          e.preventDefault()
          e.stopPropagation()
          onNodeShiftClickConnect?.(id)
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="rf-handle-hit-32" />

      <IconButton
        variant="default"
        size="sm"
        aria-label="Focus node"
        className="absolute -top-2 -right-2"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          toggleFocusOnNode?.(id)
        }}
      >
        <Headlights size={14} weight="duotone" className='text-secondary-100' />
      </IconButton>

      <div className="nodal-drag-handle cursor-move">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={completed}
            onChange={(checked) => handleToggleCompleted(checked)}
            disabled={isLocked && !lockedByMe}
          />
          <TextInput
            id={`task-${id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            placeholder="New task"
            fullWidth
            className={`!border-0 !bg-transparent !px-0 ${completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}
          />
          {(isLocked) && (
            <div className="flex items-center gap-1 text-[10px] ml-1">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-600 dark:text-red-400">
                {lockedByMe ? 'Editing...' : 'Locked'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex w-full items-end justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <IconButton
          variant="danger"
          size="sm"
          aria-label="Delete task"
          onClick={(e) => {
            e.stopPropagation()
            setShowDeleteModal(true)
          }}
          disabled={isLocked && !lockedByMe}
        >
          <Trash size={14} weight="duotone" />
        </IconButton>
      </div>

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Task"
        description="Are you sure you want to delete this task? This action cannot be undone."
        actions={
          <>
            <Button onClick={() => setShowDeleteModal(false)} variant="secondary">Cancel</Button>
            <Button onClick={() => { setShowDeleteModal(false); onNodeDelete?.(id) }} variant="danger">Delete</Button>
          </>
        }
      />

      <Handle type="source" position={Position.Bottom} className="rf-handle-hit-32" />
    </div>
  )
}


