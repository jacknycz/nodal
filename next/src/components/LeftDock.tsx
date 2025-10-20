"use client"

import React, { useState, useRef, useEffect } from 'react'
import { ListChecks, Tag as TagIcon, Info, X, ArrowCounterClockwise, ArrowClockwise, Sidebar } from '@phosphor-icons/react'
import TaskList from './TaskList'
import ColorgoryManager from './ColorgoryManager'
import IconButton from './ui/IconButton'

type DockKey = 'tasks' | 'colorgories' | 'tips' | null

interface LeftDockProps {
  active: DockKey
  onToggle: (key: Exclude<DockKey, null>) => void
  disabled?: boolean
}

export default function LeftDock({ active, onToggle, disabled = false }: LeftDockProps) {
  const baseBtn = "w-10 h-10 cursor-pointer rounded-lg flex items-center justify-center transition-colors duration-150"
  const neutral = "bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 dark:bg-gray-800/80 dark:hover:bg-gray-700/80 dark:text-gray-200"
  const activeCls = "bg-primary-600 text-white hover:bg-primary-600"
  const disabledCls = "opacity-50 cursor-not-allowed"
  const [openKey, setOpenKey] = useState<DockKey>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Mobile toggle state
  const [isMdUp, setIsMdUp] = useState<boolean>(() => (typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : false))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [panelEntered, setPanelEntered] = useState(false)
  useEffect(() => {
    const mq = typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)') : null
    const onChange = () => setIsMdUp(!!mq?.matches)
    onChange()
    mq?.addEventListener('change', onChange)
    return () => mq?.removeEventListener('change', onChange)
  }, [])
  useEffect(() => {
    if (mobileOpen) {
      const t = setTimeout(() => setPanelEntered(true), 0)
      return () => clearTimeout(t)
    } else {
      setPanelEntered(false)
    }
  }, [mobileOpen])

  // Close any open submenu on outside click/tap
  useEffect(() => {
    if (!openKey) return
    const handler = (e: Event) => {
      if (!containerRef.current) return
      const target = e.target as Node | null
      // Ignore clicks inside any modal portal
      if (target && (target as Element).closest?.('[data-modal-root]')) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpenKey(null)
      }
    }
    document.addEventListener('pointerdown', handler, true)
    document.addEventListener('mousedown', handler, true)
    document.addEventListener('touchstart', handler, true)
    return () => {
      document.removeEventListener('pointerdown', handler, true)
      document.removeEventListener('mousedown', handler, true)
      document.removeEventListener('touchstart', handler, true)
    }
  }, [openKey])

  useEffect(() => {
    const onHist = (e: any) => {
      setCanUndo(!!e?.detail?.canUndo)
      setCanRedo(!!e?.detail?.canRedo)
    }
    window.addEventListener('nodal:history-state', onHist as EventListener)
    return () => window.removeEventListener('nodal:history-state', onHist as EventListener)
  }, [])

  const Panel = (
    <div
      className="flex flex-col gap-2 p-2 rounded-r-xl border border-l-0 border-transparent dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 shadow-lg shadow-orange-950/10 dark:shadow-none backdrop-blur-sm nodal-no-select"
      data-left-dock-panel
    >
      {/* Undo / Redo */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          title="Undo"
          onClick={() => { if (disabled) return; if (canUndo) try { window.dispatchEvent(new CustomEvent('nodal:undo')) } catch { } }}
          className={`${baseBtn} ${neutral} ${(disabled || !canUndo) ? disabledCls : ''}`}
          disabled={disabled || !canUndo}
        >
          <ArrowCounterClockwise className="w-5 h-5" />
        </button>
        <button
          type="button"
          title="Redo"
          onClick={() => { if (disabled) return; if (canRedo) try { window.dispatchEvent(new CustomEvent('nodal:redo')) } catch { } }}
          className={`${baseBtn} ${neutral} ${(disabled || !canRedo) ? disabledCls : ''}`}
          disabled={disabled || !canRedo}
        >
          <ArrowClockwise className="w-5 h-5" />
        </button>
      </div>
      <hr className="border-gray-200 dark:border-gray-800 shadow-sm shadow-gray-400/10 dark:shadow-gray-950/90 my-1" />
      <div className="relative">
        <button
          type="button"
          title="Tasks"
          aria-pressed={openKey === 'tasks'}
          onClick={() => { if (disabled) return; setOpenKey(prev => prev === 'tasks' ? null : 'tasks') }}
          className={`${baseBtn} ${openKey === 'tasks' ? activeCls : neutral} ${disabled ? disabledCls : ''}`}
          disabled={disabled}
        >
          <ListChecks className="w-5 h-5" />
        </button>
        {openKey === 'tasks' && (
          <div className="absolute left-[52px] top-0 origin-left transition-all duration-150 ease-out opacity-100 scale-100">
            <TaskList dock anchored open onClose={() => setOpenKey(null)} />
          </div>
        )}
      </div>
      {/* Colorgories moved to Board Settings modal */}
      <div className="relative">
        <button
          type="button"
          title="Tips & Info"
          aria-pressed={openKey === 'tips'}
          onClick={() => { if (disabled) return; setOpenKey(prev => prev === 'tips' ? null : 'tips') }}
          className={`${baseBtn} ${openKey === 'tips' ? activeCls : neutral} ${disabled ? disabledCls : ''}`}
          disabled={disabled}
        >
          <Info className="w-5 h-5" />
        </button>
        {openKey === 'tips' && (
          <div className="absolute left-[52px] top-0 origin-left transition-all duration-150 ease-out opacity-100 scale-100">
            <div className="rounded-4xl z-60 w-64 max-h-[calc(100dvh-80px)] bg-white dark:bg-gray-900 shadow-xl flex flex-col transition-all duration-200 ease-out opacity-100 scale-100 translate-y-0">
              <div className="flex items-center justify-between py-2 px-4 shadow-lg shadow-gray-400/10 dark:shadow-none">
                <div className="flex items-center space-x-2">
                  <img src="/nobot.svg" alt="Nodal" width={24} height={24} className="opacity-90" />
                  <span className="text-xs text-gray-600 dark:text-gray-300">Tips & Info</span>
                </div>
                <button onClick={() => setOpenKey(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Cmd/Ctrl + click</strong> on nodes to multi-select.</li>
                  <li><strong>Shift + click</strong> a node (with another selected) to connect them.</li>
                  <li><strong>Drag & drop</strong> files onto the board to create nodes.</li>
                  <li><strong>Double-click</strong> a node to open editing.</li>
                  <li>Use the bottom FAB to add nodes, upload, or generate.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className="fixed z-50 left-0 top-12 md:top-16" data-left-dock aria-label="Left dock" ref={containerRef}>
      {/* Desktop/Tablet */}
      <div className="hidden md:block">
        {Panel}
      </div>
      {/* Mobile */}
      <div className="block md:hidden">
        <div className={`ml-2 mb-2 ${mobileOpen ? '' : ''}`}>
          <IconButton
            aria-label="Toggle left dock"
            variant="primaryOutline"
            className="bg-white dark:bg-gray-900"
            size="lg"
            onClick={() => { if (disabled) return; setMobileOpen(v => !v) }}
            disabled={disabled}
          >
            <Sidebar size={14} className="w-5 h-5" weight="duotone" />
          </IconButton>
        </div>
        {mobileOpen && (
          <div className={`transition-transform duration-200 ease-out ${panelEntered ? 'translate-x-0' : '-translate-x-full'}`}>
            {Panel}
          </div>
        )}
      </div>
    </div>
  )
}


