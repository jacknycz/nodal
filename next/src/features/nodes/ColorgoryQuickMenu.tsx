"use client"

import React, { useRef, useState } from 'react'
import IconButton from '../../components/ui/IconButton'
import Checkbox from '../../components/ui/Checkbox'
import { Tag as TagIcon } from '@phosphor-icons/react'
import { useBoardStore } from '../board/boardSlice'

interface ColorgoryQuickMenuProps {
  nodeId: string
  selectedIds: string[]
  onChange: (nextIds: string[]) => void
  disabled?: boolean
  onNodeUpdate?: (nodeId: string, updates: Record<string, any>) => void
}

export default function ColorgoryQuickMenu({ nodeId, selectedIds, onChange, disabled, onNodeUpdate }: ColorgoryQuickMenuProps) {
  const [open, setOpen] = useState(false)
  const closeTimeoutRef = useRef<number | null>(null)
  const clearCloseTimeout = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }
  const openMenu = () => {
    clearCloseTimeout()
    setOpen(true)
  }
  const scheduleClose = () => {
    clearCloseTimeout()
    closeTimeoutRef.current = window.setTimeout(() => {
      setOpen(false)
      closeTimeoutRef.current = null
    }, 180)
  }
  const colorgories = useBoardStore((s) => s.colorgories || [])
  const edges = useBoardStore.getState().edges || []

  const toggle = (id: string, checked: boolean) => {
    const has = selectedIds.includes(id)
    let next = selectedIds
    if (checked && !has) next = [...selectedIds, id]
    if (!checked && has) next = selectedIds.filter((x) => x !== id)
    if (next !== selectedIds) onChange(next)
  }

  const applyToTree = () => {
    if (!onNodeUpdate || !Array.isArray(edges)) return
    // Collect descendants (BFS)
    const childrenMap = new Map<string, string[]>()
    for (const e of edges as any[]) {
      const src = e?.source
      const tgt = e?.target
      if (typeof src === 'string' && typeof tgt === 'string') {
        const arr = childrenMap.get(src) || []
        arr.push(tgt)
        childrenMap.set(src, arr)
      }
    }
    const visited = new Set<string>()
    const queue: string[] = [...(childrenMap.get(nodeId) || [])]
    while (queue.length) {
      const cur = queue.shift() as string
      if (visited.has(cur)) continue
      visited.add(cur)
      queue.push(...(childrenMap.get(cur) || []))
    }
    // Since we don't have direct child data here, issue updates by reading current store nodes
    const nodes = useBoardStore.getState().nodes || []
    for (const nid of visited) {
      const node = (nodes as any[]).find(n => n.id === nid)
      if (!node) continue
      // Override with exactly the selectedIds
      onNodeUpdate(nid, { colorgoryIds: [...selectedIds] })
    }
    // Ensure parent itself reflects current selection too
    onNodeUpdate(nodeId, { colorgoryIds: [...selectedIds] })
    setOpen(false)
  }

  return (
    <div className="relative" onMouseEnter={openMenu} onMouseLeave={scheduleClose}>
      <IconButton
        variant="default"
        size="sm"
        aria-label="Manage colorgories"
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
        onClick={(e) => { e.stopPropagation() }}
        disabled={disabled}
      >
        <TagIcon size={14} weight="duotone" />
      </IconButton>

      {/* Hover Panel */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 top-full mt-1 z-20 min-w-[240px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-xl backdrop-blur-xs transition-all duration-150 ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <div className="p-2 grid grid-cols-2 gap-2">
          {colorgories.map((c: any) => (
            <Checkbox
              key={c.id}
              checked={selectedIds.includes(c.id)}
              onChange={(checked) => toggle(c.id, !!checked)}
              label={c.name}
              labelTextClassName="text-xs"
            />
          ))}
          {colorgories.length === 0 && (
            <div className="col-span-2 text-xs text-gray-500 dark:text-gray-400 px-1 py-0.5">No colorgories</div>
          )}
        </div>
        <div className="border-t border-gray-200 dark:border-gray-700 p-2 flex justify-end">
          <button
            className="text-xs px-2 py-1 rounded-md bg-primary-600 text-white disabled:opacity-60"
            onClick={applyToTree}
            disabled={!onNodeUpdate}
          >
            Apply to tree
          </button>
        </div>
      </div>
    </div>
  )
}


