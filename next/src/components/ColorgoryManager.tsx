"use client"

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { useBoardStore } from '../features/board/boardSlice'
import { X, Tag as TagIcon, DotsSix, Eye, EyeClosed } from '@phosphor-icons/react'
import TextInput from './ui/TextInput'
import { getColorgoryHex } from '../features/board/colorgoryColors'
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
  const saveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleSaveNow = () => {
    if (saveDebounceRef.current) clearTimeout(saveDebounceRef.current)
    saveDebounceRef.current = setTimeout(() => {
      try { window.dispatchEvent(new CustomEvent('nodal:save-now')) } catch {}
    }, 500)
  }

  const ordered = useMemo(() => {
    const list = [...(colorgories || [])]
    list.sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
    return list
  }, [colorgories])

  const [dragId, setDragId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement | null>(null)
  const handleDragStart = (e: React.DragEvent, id: string) => {
    // Desktop HTML5 DnD: use dataTransfer only (do not set dragId to avoid pointer trap)
    e.dataTransfer.effectAllowed = 'move'
    try { e.dataTransfer.setData('text/plain', id) } catch {}
  }
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = (() => {
      try { return e.dataTransfer.getData('text/plain') } catch { return '' }
    })() || dragId
    if (!sourceId || sourceId === targetId) return
    const ids = ordered.map(c => c.id)
    const from = ids.indexOf(sourceId)
    const to = ids.indexOf(targetId)
    if (from < 0 || to < 0) return
    ids.splice(to, 0, ids.splice(from, 1)[0])
    reorderColorgories(ids)
    try { window.dispatchEvent(new CustomEvent('nodal:save-now')) } catch {}
    setDragId(null)
  }

  // Touch/pen pointer-based drag-swap (mobile fallback where HTML5 DnD is not supported)
  useEffect(() => {
    if (!dragId) return
    let active = true
    const onMove = (e: PointerEvent) => {
      if (!active) return
      e.stopPropagation()
      try { e.preventDefault() } catch {}
      if (!listRef.current) return
      const y = e.clientY
      const children = Array.from(listRef.current.querySelectorAll('[data-colorgory-row]')) as HTMLElement[]
      const ids = ordered.map(c => c.id)
      const from = ids.indexOf(dragId!)
      if (from < 0) return
      let overIdx = -1
      for (let i = 0; i < children.length; i++) {
        const rect = children[i].getBoundingClientRect()
        if (y >= rect.top && y <= rect.bottom) { overIdx = i; break }
      }
      if (overIdx >= 0 && overIdx !== from) {
        const next = [...ids]
        next.splice(overIdx, 0, next.splice(from, 1)[0])
        reorderColorgories(next)
      }
    }
    const end = (e: PointerEvent) => {
      active = false
      e.stopPropagation()
      try { e.preventDefault() } catch {}
      setDragId(null)
      try { window.dispatchEvent(new CustomEvent('nodal:save-now')) } catch {}
      window.removeEventListener('pointermove', onMove, true)
      window.removeEventListener('pointerup', end, true)
      window.removeEventListener('pointercancel', end, true)
    }
    window.addEventListener('pointermove', onMove, { capture: true, passive: false } as any)
    window.addEventListener('pointerup', end, { capture: true, passive: false } as any)
    window.addEventListener('pointercancel', end, { capture: true, passive: false } as any)
    return () => end(new PointerEvent('pointercancel'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId])

  // While panel is open, aggressively trap touch/drag/pointer movement to prevent canvas panning
  useEffect(() => {
    if (!isOpen) return
    const prevent = (e: Event) => {
      try { e.preventDefault() } catch {}
      e.stopPropagation()
    }
    const opts: AddEventListenerOptions = { passive: false, capture: true }
    document.addEventListener('touchmove', prevent, opts)
    document.addEventListener('pointermove', prevent, opts)
    // Do NOT trap HTML5 dragover globally; it breaks desktop drop
    document.addEventListener('wheel', prevent, opts)
    return () => {
      document.removeEventListener('touchmove', prevent, opts as any)
      document.removeEventListener('pointermove', prevent, opts as any)
      // no dragover removal needed
      document.removeEventListener('wheel', prevent, opts as any)
    }
  }, [isOpen])

  

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
        className={`${anchored ? '' : 'fixed'} rounded-4xl z-[700] w-64 max-h-[calc(100dvh-80px)] bg-white dark:bg-gray-900 shadow-xl flex flex-col transition-all duration-200 ease-out ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2 pointer-events-none'}`}
        style={{ ...(anchored ? {} : { top: topOffsetPx, left: dock ? leftOffsetPx : 64 }), touchAction: 'none' } as any}
        data-left-dock-panel
        onPointerDown={(e) => { e.stopPropagation() }}
        onPointerMove={(e) => { e.stopPropagation() }}
        onTouchStart={(e) => { e.stopPropagation() }}
        onMouseDown={(e) => { e.stopPropagation() }}
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
        <div className="flex-1 overflow-y-auto p-4 space-y-2" ref={listRef}>
          {ordered.length === 0 && (
            <div className="text-sm text-gray-500 dark:text-gray-400">No colorgories.</div>
          )}
          {ordered.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-2 border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white/70 dark:bg-gray-800/60 cursor-grab"
              draggable
              onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, c.id) }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); try { (e.dataTransfer as any).dropEffect = 'move' } catch {}; handleDragOver(e) }}
              onDrop={(e) => { e.stopPropagation(); handleDrop(e, c.id) }}
              onDragEnd={(e) => { e.stopPropagation(); setDragId(null) }}
              onPointerDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              title="Drag to reorder"
              data-colorgory-row
            >
              <span
                onPointerDown={(e) => {
                  // Start pointer-based drag on touch/pen only
                  if ((e as any).pointerType && (e as any).pointerType !== 'mouse') {
                    e.stopPropagation()
                    try { e.preventDefault() } catch {}
                    setDragId(c.id)
                  }
                }}
                style={{ touchAction: 'none' } as any}
              >
                <DotsSix size={24} weight="duotone" className="text-gray-400" />
              </span>
              <div className="w-3 h-3 flex-shrink-0 rounded-full" style={{ backgroundColor: getColorgoryHex(c.id) }} />
              <TextInput
                value={c.name}
                onChange={(e) => { renameColorgory(c.id, (e.target as HTMLInputElement).value); scheduleSaveNow() }}
                onBlur={() => { scheduleSaveNow() }}
                size="sm"
                className="h-[28px]"
                fullWidth
              />
              <IconButton
                variant="secondary"
                aria-label={c.visible === false ? 'Show colorgory' : 'Hide colorgory'}
                onClick={(e) => { e.stopPropagation(); setColorgoryVisible(c.id, c.visible === false ? true : false); try { window.dispatchEvent(new CustomEvent('nodal:save-now')) } catch {} }}
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


