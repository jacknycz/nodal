'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import Checkbox from '../../components/ui/Checkbox'
import TextInput from '../../components/ui/TextInput'
import IconButton from '../../components/ui/IconButton'
import { Trash } from "@phosphor-icons/react/ssr";
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { useBoardStore } from '../board/boardSlice'
import Tag from '../../components/ui/Tag'
import { colorgoryHexById } from '../board/colorgoryColors'
import { getNodeContainerClasses } from './nodeStyles'
import NodeActionDrawer from './NodeActionDrawer'
import ColorgoryQuickMenu from './ColorgoryQuickMenu'

interface TaskNodeData {
  title?: string
  type?: 'task'
  completed?: boolean
  colorgoryIds?: string[]
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
  // Connect helper
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
  onNodeShiftClickConnect,
}: TaskNodeProps) {
  const [title, setTitle] = useState(data.title || '')
  const [completed, setCompleted] = useState<boolean>(!!data.completed)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showColorgoryModal, setShowColorgoryModal] = useState(false)
  const [pendingColorgoryIds, setPendingColorgoryIds] = useState<string[]>((data as any).colorgoryIds || [])

  const isLocked = isNodeLocked?.(id) || false
  const lockedByMe = isNodeLockedByMe?.(id) || false

  // Focus removed

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

  const connectingSourceId = useBoardStore((s: any) => s.connectingSourceId)
  const isReceiveMode = !!connectingSourceId && connectingSourceId !== id
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Build colorgory swatch colors
  const colorgories = useBoardStore.getState().colorgories || []
  const swatchColors: string[] = Array.isArray((data as any).colorgoryIds)
    ? colorgories
        .filter((c: any) => (data as any).colorgoryIds!.includes(c.id))
        .map((c: any) => colorgoryHexById[c.id] || '#9ca3af')
    : []

  const gradientStops = swatchColors.length <= 1
    ? (swatchColors[0] || '')
    : swatchColors.map((color, index) => {
        const percentage = (index / (swatchColors.length - 1)) * 100
        return `${color} ${percentage}%`
      }).join(', ')

  return (
    <div
      className={getNodeContainerClasses({ selected, isLocked, isLockedByMe: lockedByMe, receiveMode: isReceiveMode, extra: 'min-w-[220px] max-w-[420px]' })}
      onClick={(e) => {
        if (e.shiftKey) {
          e.preventDefault()
          e.stopPropagation()
          onNodeShiftClickConnect?.(id)
        }
        if ((e as any).pointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches) {
          setDrawerOpen((prev) => !prev)
        }
      }}
    >
      <Handle type="target" position={Position.Top} className="rf-handle-hit-32" />

      {/* Colorgory ring overlay */}
      {swatchColors.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{
            padding: 3,
            background: swatchColors.length === 1 ? gradientStops : `linear-gradient(to right, ${gradientStops})`,
            ...( { WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' } as any )
          }}
        />
      )}

      

      <div className="nodal-drag-handle cursor-move">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={completed}
            onChange={(checked) => handleToggleCompleted(checked)}
            disabled={isLocked && !lockedByMe}
            size="lg"
            className="flex-none"
            shape="circle"
          />
          <TextInput
            id={`task-${id}`}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            placeholder="New task"
            size="sm"
            fullWidth
            className={`${completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}
          />
          {/* inline actions removed; moved to slide-out */}
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

      {/* Colorgories button moved to drawer */}

      {/* Slide-out action panel on hover */}
      <NodeActionDrawer open={drawerOpen}>
        <ColorgoryQuickMenu
          nodeId={id}
          selectedIds={(data as any).colorgoryIds || []}
          onChange={(next) => onNodeUpdate?.(id, { colorgoryIds: next })}
          disabled={isLocked && !lockedByMe}
          onNodeUpdate={onNodeUpdate}
        />
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
      </NodeActionDrawer>

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

      {/* Colorgories Modal */}
      <Modal
        open={showColorgoryModal}
        onClose={() => setShowColorgoryModal(false)}
        title="Colorgories"
        description="Choose categories to apply to this node"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowColorgoryModal(false)}>Cancel</Button>
            <Button onClick={() => {
              onNodeUpdate?.(id, { colorgoryIds: pendingColorgoryIds })
              setShowColorgoryModal(false)
            }}>Save</Button>
          </>
        }
      >
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(useBoardStore.getState().colorgories || []).map((c: any) => (
            <Checkbox
              key={c.id}
              checked={pendingColorgoryIds.includes(c.id)}
              onChange={(checked) => {
                setPendingColorgoryIds((prev) => {
                  const has = prev.includes(c.id)
                  if (checked && !has) return [...prev, c.id]
                  if (!checked && has) return prev.filter(id0 => id0 !== c.id)
                  return prev
                })
              }}
              label={c.name}
              labelTextClassName="text-sm"
            />
          ))}
        </div>
      </Modal>

      <Handle type="source" position={Position.Bottom} className="rf-handle-hit-32" />
    </div>
  )
}


