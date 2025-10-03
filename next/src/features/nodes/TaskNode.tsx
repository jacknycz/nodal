'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import Checkbox from '../../components/ui/Checkbox'
import IconButton from '../../components/ui/IconButton'
import { Trash, TreeView } from "@phosphor-icons/react/ssr";
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { useBoardStore } from '../board/boardSlice'
import Tag from '../../components/ui/Tag'
import { colorgoryHexById } from '../board/colorgoryColors'
import { getNodeContainerClasses } from './nodeStyles'
 
import Tooltip from '../../components/ui/Tooltip'

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
  // Connect helper
  onNodeShiftClickConnect?: (targetId: string) => void
  onOrganizeSubtree?: (nodeId: string) => void
}

export default function TaskNode({
  data,
  id,
  selected,
  onNodeDelete,
  onNodeUpdate,
  onNodeShiftClickConnect,
  onOrganizeSubtree,
}: TaskNodeProps) {
  const [title, setTitle] = useState(data.title || '')
  const [completed, setCompleted] = useState<boolean>(!!data.completed)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showColorgoryModal, setShowColorgoryModal] = useState(false)
  const [pendingColorgoryIds, setPendingColorgoryIds] = useState<string[]>((data as any).colorgoryIds || [])

  const isLocked = false
  const lockedByMe = false

  // Focus removed

  useEffect(() => {
    setTitle(data.title || '')
    setCompleted(!!data.completed)
  }, [data.title, data.completed])

  // Inline editing removed; Task now edited via Edit Node modal

  const handleToggleCompleted = (next: boolean) => {
    setCompleted(next)
    onNodeUpdate?.(id, { completed: next })
  }

  const connectingSourceId = useBoardStore((s: any) => s.connectingSourceId)
  const isReceiveMode = !!connectingSourceId && connectingSourceId !== id
  

  // Focus on mount behavior removed with inline editor

  // Build colorgory swatch colors
  const colorgories = useBoardStore.getState().colorgories || []
  const swatchColors: string[] = Array.isArray((data as any).colorgoryIds)
    ? colorgories
        .filter((c: any) => (data as any).colorgoryIds!.includes(c.id))
        .map((c: any) => colorgoryHexById[c.id] || '#9ca3af')
    : []

  const gradientStops = swatchColors.length <= 1
    ? (swatchColors[0] || '')
    : (() => {
        const n = swatchColors.length
        const segment = 100 / n
        const blendWidth = segment * 0.3
        const half = blendWidth / 2
        const stops: string[] = []
        stops.push(`${swatchColors[0]} 0%`)
        for (let i = 0; i < n - 1; i++) {
          const boundary = segment * (i + 1)
          const p0 = Math.max(0, boundary - half)
          const p1 = Math.min(100, boundary + half)
          stops.push(`${swatchColors[i]} ${p0}%`, `${swatchColors[i + 1]} ${p1}%`)
        }
        stops.push(`${swatchColors[n - 1]} 100%`)
        return stops.join(', ')
      })()

  return (
    <div
      className={getNodeContainerClasses({ selected, receiveMode: isReceiveMode, extra: 'min-w-[220px] max-w-[420px]' })}
      onClick={(e) => {
        if (e.shiftKey) {
          e.preventDefault()
          e.stopPropagation()
          onNodeShiftClickConnect?.(id)
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
        <div className="flex items-start gap-2">
          <Checkbox
            checked={completed}
            onChange={(checked) => handleToggleCompleted(checked)}
            
            size="lg"
            className="flex-none"
            shape="circle"
          />
          <div className={`text-sm leading-relaxed tiptap-content ${completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`} dangerouslySetInnerHTML={{ __html: (data as any)?.content || (data.title || '') }} />
          {/* inline actions removed; moved to slide-out */}
          
        </div>
      </div>

      {/* Colorgories button moved to drawer */}

      

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


