"use client"

import React, { useRef, useState } from 'react'
import IconButton from '../../components/ui/IconButton'
import Checkbox from '../../components/ui/Checkbox'
import { Tag as TagIcon } from '@phosphor-icons/react'
import { useBoardStore } from '../board/boardSlice'

interface ColorgoryQuickMenuProps {
  selectedIds: string[]
  onChange: (nextIds: string[]) => void
  disabled?: boolean
}

export default function ColorgoryQuickMenu({ selectedIds, onChange, disabled }: ColorgoryQuickMenuProps) {
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

  const toggle = (id: string, checked: boolean) => {
    const has = selectedIds.includes(id)
    let next = selectedIds
    if (checked && !has) next = [...selectedIds, id]
    if (!checked && has) next = selectedIds.filter((x) => x !== id)
    if (next !== selectedIds) onChange(next)
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
      </div>
    </div>
  )
}


