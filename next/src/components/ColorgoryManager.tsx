"use client"

import React, { useMemo, useState } from 'react'
import { useBoardStore } from '../features/board/boardSlice'
import { X, Tag as TagIcon, DotsSix, Eye, EyeClosed } from '@phosphor-icons/react'
import TextInput from './ui/TextInput'
import { colorgoryHexById } from '../features/board/colorgoryColors'
import IconButton from './ui/IconButton'

interface ColorgoryManagerProps {
  open?: boolean
  onClose?: () => void
  dock?: boolean
  leftOffsetPx?: number
  topOffsetPx?: number
  anchored?: boolean
}

export default function ColorgoryManager({ open, onClose, dock = false, leftOffsetPx = 56, topOffsetPx = 116, anchored = false }: ColorgoryManagerProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const isOpen = typeof open === 'boolean' ? open : internalOpen
  const setIsOpen = (next: boolean) => {
    if (typeof open === 'boolean') {
      if (!next && onClose) onClose()
    } else {
      setInternalOpen(next)
    }
  }
  const colorgories = useBoardStore((s) => s.colorgories || [])
  const renameColorgory = useBoardStore((s: any) => s.renameColorgory)
  const setColorgories = useBoardStore((s: any) => s.setColorgories)
  const reorderColorgories = useBoardStore((s: any) => s.reorderColorgories)
  const setColorgoryVisible = useBoardStore((s: any) => s.setColorgoryVisible)

  const ordered = useMemo(() => {
    const list = [...(colorgories || [])]
    list.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    return list
  }, [colorgories])

  const [dragId, setDragId] = useState<string | null>(null)
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!dragId || dragId === targetId) return
    const ids = ordered.map(c => c.id)
    const from = ids.indexOf(dragId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    reorderColorgories(ids)
    setDragId(null)
  }

  

  return (
    <>
      {/* Toggle Button hidden in dock mode */}
      {!dock && !anchored && (
        <button
          onClick={() => setIsOpen(true)}
          className={`fixed left-16 z-40 bg-primary-600 text-white rounded-full p-3 shadow-lg hover:bg-primary-700 transition-all duration-200 ease-out bottom-4 sm:bottom-auto sm:top-16 ${isOpen ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`}
          title="Manage Colorgories"
        >
          <TagIcon className="w-5 h-5" />
        </button>
      )}

      {/* Panel */}
      <div
        className={`${anchored ? '' : 'fixed'} rounded-4xl z-60 w-64 max-h-[calc(100dvh-80px)] bg-white dark:bg-gray-900 shadow-xl flex flex-col transition-all duration-200 ease-out ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}`}
        style={anchored ? undefined : { top: topOffsetPx, left: dock ? leftOffsetPx : 64 }}
        data-left-dock-panel
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between py-2 px-4 shadow-lg shadow-gray-400/10 dark:shadow-none">
          <div className="flex items-center space-x-2">
            <img src="/nobot.svg" alt="Nodal" width={24} height={24} className="opacity-90" />
            <span className="text-xs text-gray-600 dark:text-gray-300">Colorgories ({ordered.length})</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {ordered.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">No colorgories.</div>
          )}
          {ordered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white/70 dark:bg-gray-800/60"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, c.id)}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <div
                draggable
                onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, c.id) }}
                className="text-gray-400 cursor-grab"
                onPointerDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                title="Drag to reorder"
              >
                <DotsSix size={24} weight="duotone" />
              </div>
              <div className="w-3 h-3 flex-shrink-0 rounded-full" style={{ backgroundColor: colorgoryHexById[c.id] || '#9ca3af' }} />
              <TextInput
                value={c.name}
                onChange={(e) => renameColorgory(c.id, (e.target as HTMLInputElement).value)}
                size="sm"
                className="h-[28px]"
                fullWidth
              />
              <IconButton
                variant="secondary"
                aria-label={c.visible === false ? 'Show colorgory' : 'Hide colorgory'}
                onClick={(e) => { e.stopPropagation(); setColorgoryVisible(c.id, c.visible === false ? true : false) }}
              >
                {c.visible === false ? <EyeClosed size={16} weight="duotone" /> : <Eye size={16} weight="duotone" />}
              </IconButton>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}


