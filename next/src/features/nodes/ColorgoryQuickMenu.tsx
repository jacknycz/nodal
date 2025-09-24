"use client"

import React, { useRef, useState, useMemo } from 'react'
import IconButton from '../../components/ui/IconButton'
import Tooltip from '../../components/ui/Tooltip'
import Checkbox from '../../components/ui/Checkbox'
import { Tag as TagIcon } from '@phosphor-icons/react'
import { colorgoryHexById } from '../board/colorgoryColors'
import { useBoardStore } from '../board/boardSlice'
import Button from '@/components/ui/Button'

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
  const colorgoriesAll = useBoardStore((s) => s.colorgories || [])
  const colorgories = useMemo(() => {
    const list = [...(colorgoriesAll || [])].filter((c: any) => c.visible !== false)
    list.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    return list
  }, [colorgoriesAll])
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
      <Tooltip content="Colorgories">
        <IconButton
          variant="default"
          aria-label="Manage colorgories"
          onMouseEnter={openMenu}
          onMouseLeave={scheduleClose}
          onClick={(e) => { e.stopPropagation() }}
          disabled={disabled}
        >
          <TagIcon size={14} weight="duotone" />
        </IconButton>
      </Tooltip>

      {/* Hover Panel */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 top-full mt-1 z-20 min-w-[280px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-xl backdrop-blur-xs transition-all duration-150 ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => e.stopPropagation()}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <div className="p-2 pb-0 grid grid-cols-2 gap-1">
          {colorgories.map((c: any) => {
            const hex = colorgoryHexById[c.id] || '#9ca3af'
            return (
              <Checkbox
                key={c.id}
                checked={selectedIds.includes(c.id)}
                onChange={(checked) => toggle(c.id, !!checked)}
                label={c.name}
                labelTextClassName="text-xs"
                className="rounded px-2 py-1"
                controlStyle={{ borderColor: hex, borderWidth: 2 }}
                checkColor={hex}
              />
            )
          })}
          {colorgories.length === 0 && (
            <div className="col-span-2 text-xs text-gray-500 dark:text-gray-400 px-1 py-0.5">No colorgories</div>
          )}
        </div>
        <div className="p-2 flex justify-end">
          <Button
            onClick={applyToTree}
            disabled={!onNodeUpdate}
            size="sm"
          >
            Apply to tree
          </Button>
        </div>
      </div>
    </div>
  )
}


