'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import Checkbox from '../../components/ui/Checkbox'
import IconButton from '../../components/ui/IconButton'
import { Trash, TreeView, Play } from "@phosphor-icons/react/ssr";
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { useBoardStore } from '../board/boardSlice'
import Tag from '../../components/ui/Tag'
import { getColorgoryHex } from '../board/colorgoryColors'
import { getNodeContainerClasses, NODE_HANDLE_CLASS, NODE_HANDLE_VISIBILITY_CLASS } from './nodeStyles'
import { useTheme } from '../../contexts/ThemeContext'
 
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
  onStartStoryMode?: (nodeId: string) => void
}

export default function TaskNode({
  data,
  id,
  selected,
  onNodeDelete,
  onNodeUpdate,
  onNodeShiftClickConnect,
  onOrganizeSubtree,
  onStartStoryMode,
}: TaskNodeProps) {
  const [title, setTitle] = useState(data.title || '')
  const [completed, setCompleted] = useState<boolean>(!!data.completed)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showColorgoryModal, setShowColorgoryModal] = useState(false)
  const [pendingColorgoryIds, setPendingColorgoryIds] = useState<string[]>((data as any).colorgoryIds || [])
  const descriptionRef = useRef<HTMLDivElement | null>(null)
  const [assigneeInitials, setAssigneeInitials] = useState<string>('')
  const [assigneeLabel, setAssigneeLabel] = useState<string>('')
  const [alignStart, setAlignStart] = useState(false)

  const isLocked = false
  const lockedByMe = false

  // Focus removed

  useEffect(() => {
    setTitle(data.title || '')
    setCompleted(!!data.completed)
  }, [data.title, data.completed])

  // Measure description height to determine vertical alignment of title/checkbox
  useEffect(() => {
    const measure = () => {
      const h = descriptionRef.current?.offsetHeight || 0
      setAlignStart(h > 40) // align top if content gets taller than a single-line-ish height
    }
    measure()
    let ro: ResizeObserver | null = null
    try {
      ro = new ResizeObserver(measure)
      if (descriptionRef.current) ro.observe(descriptionRef.current)
    } catch {}
    window.addEventListener('resize', measure)
    return () => {
      try { ro?.disconnect() } catch {}
      window.removeEventListener('resize', measure)
    }
  }, [ (data as any)?.content, data.title ])

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
  const { isDark } = useTheme()
  const swatchColors: string[] = Array.isArray((data as any).colorgoryIds)
    ? colorgories
        .filter((c: any) => (data as any).colorgoryIds!.includes(c.id))
        .map((c: any) => getColorgoryHex(c.id))
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

  // Resolve assignee display (initials) if assigned
  useEffect(() => {
    const assigneeId = (data as any)?.assigneeId as string | undefined
    if (!assigneeId) { setAssigneeInitials(''); setAssigneeLabel(''); return }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/users/by-ids', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: [assigneeId] }) })
        const json = await res.json()
        const u = Array.isArray(json.users) ? json.users[0] : null
        const label = (u?.username || u?.email || '') as string
        const source = label || assigneeId
        const initials = (() => {
          if (!source) return ''
          if (source.includes('@')) {
            const parts = source.replace(/@.*/, '').split(/[^a-zA-Z0-9]+/).filter(Boolean)
            const a = (parts[0] || '').slice(0, 1)
            const b = (parts[1] || '').slice(0, 1)
            return (a + b).toUpperCase() || source.slice(0, 2).toUpperCase()
          }
          const parts = source.split(/\s+/).filter(Boolean)
          return ((parts[0] || '').slice(0, 1) + (parts[1] || '').slice(0, 1)).toUpperCase() || source.slice(0, 2).toUpperCase()
        })()
        if (!cancelled) { setAssigneeInitials(initials); setAssigneeLabel(label) }
      } catch { if (!cancelled) { setAssigneeInitials(''); setAssigneeLabel('') } }
    })()
    return () => { cancelled = true }
  }, [ (data as any)?.assigneeId ])

  const assigneeBgClass = (() => {
    const id = String((data as any)?.assigneeId || '')
    if (!id) return 'bg-primary-600'
    const palette = ['bg-primary-600','bg-blue-600','bg-cyan-600','bg-emerald-600','bg-teal-600','bg-indigo-600','bg-violet-600','bg-fuchsia-600','bg-rose-600','bg-amber-600']
    let hash = 0
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
    return palette[hash % palette.length]
  })()

  return (
    <div
      className={getNodeContainerClasses({ selected, receiveMode: isReceiveMode, extra: 'relative min-w-[220px] max-w-[420px]' })}
      style={!isDark && swatchColors.length > 0 ? { background: (swatchColors.length === 1 ? swatchColors[0] : (`linear-gradient(to right, ${gradientStops})`)) } : undefined}
    >
      {/* Assignee avatar initials */}
      {(data as any)?.assigneeId && assigneeInitials && (
        <div className="absolute -top-2 -right-2 z-10 pointer-events-auto">
          <Tooltip content={assigneeLabel || ''} side="top">
            <div className={`w-5 h-5 border border-white/50 rounded-full ${assigneeBgClass} text-white text-[10px] leading-[20px] flex items-center justify-center shadow`}>{assigneeInitials}</div>
          </Tooltip>
        </div>
      )}
      <Handle type="target" position={Position.Top} className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`} />

      {/* Colorgory ring overlay */}
      {isDark && swatchColors.length > 0 && (
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
        {/* Title row: checkbox + title inline */}
        <div className={`nodal-drag-handle cursor-move flex ${alignStart ? 'items-start' : 'items-center'} gap-2`}>
          <Checkbox
            checked={completed}
            onChange={(checked) => handleToggleCompleted(checked)}
            size="lg"
            shape="circle"
          />
          <div className={`text-sm font-medium flex-1 ${completed ? 'line-through text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
            {title || 'Untitled Task'}
          </div>
        </div>
        {(data as any)?.storyStarter && (
          <div className="mt-2 flex items-center gap-2">
            <Tag variant="primary">Story Starter Node</Tag>
            <IconButton
              variant="default"
              size="sm"
              aria-label="Play story"
              onClick={(e) => { e.stopPropagation(); try { onStartStoryMode?.(id) } catch {} }}
              title="Play story"
            >
              <Play size={14} weight="duotone" />
            </IconButton>
          </div>
        )}
        {/* Optional description under title, full width */}
        {(data as any)?.content ? (
          <div
            ref={descriptionRef}
            className="mt-2 text-xs leading-relaxed tiptap-content text-gray-700 dark:text-gray-300 break-words whitespace-pre-wrap [&_a]:text-primary-600 dark:[&_a]:text-primary-400 [&_a:hover]:underline"
            dangerouslySetInnerHTML={{ __html: (data as any)?.content || '' }}
          />
        ) : null}
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
          {(useBoardStore.getState().colorgories || []).filter((c: any) => c?.visible !== false).map((c: any) => (
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

      <Handle type="source" position={Position.Bottom} className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`} />
    </div>
  )
}


