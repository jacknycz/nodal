"use client"

import React, { useState, useRef, useEffect } from 'react'
import { ListChecks, Tag as TagIcon, Info, X, ArrowCounterClockwise, ArrowClockwise } from '@phosphor-icons/react'
import TaskList from './TaskList'
import ColorgoryManager from './ColorgoryManager'

type DockKey = 'tasks' | 'colorgories' | 'tips' | null

interface LeftDockProps {
  active: DockKey
  onToggle: (key: Exclude<DockKey, null>) => void
}

export default function LeftDock({ active, onToggle }: LeftDockProps) {
  const baseBtn = "w-10 h-10 cursor-pointer rounded-lg flex items-center justify-center transition-colors duration-150"
  const neutral = "bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 dark:bg-gray-800/80 dark:hover:bg-gray-700/80 dark:text-gray-200"
  const activeCls = "bg-primary-600 text-white hover:bg-primary-600"
  const disabledCls = "opacity-50 cursor-not-allowed"
  const [openKey, setOpenKey] = useState<DockKey>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // Close any open submenu on outside click/tap
  useEffect(() => {
    if (!openKey) return
    const handler = (e: Event) => {
      if (!containerRef.current) return
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

  return (
    <div
      className="fixed z-50 left-0 top-12 md:top-16 flex flex-col gap-2 p-2 rounded-r-xl 
      border border-l-0 border-transparent dark:border-gray-700 
      bg-white/80 dark:bg-gray-900/80 shadow-lg shadow-orange-950/10 dark:shadow-none backdrop-blur-sm nodal-no-select"
      data-left-dock
      aria-label="Left dock"
      ref={containerRef}
    >
      {/* Undo / Redo */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          title="Undo"
          onClick={() => { if (canUndo) try { window.dispatchEvent(new CustomEvent('nodal:undo')) } catch {} }}
          className={`${baseBtn} ${neutral} ${!canUndo ? disabledCls : ''}`}
          disabled={!canUndo}
        >
          <ArrowCounterClockwise className="w-5 h-5" />
        </button>
        <button
          type="button"
          title="Redo"
          onClick={() => { if (canRedo) try { window.dispatchEvent(new CustomEvent('nodal:redo')) } catch {} }}
          className={`${baseBtn} ${neutral} ${!canRedo ? disabledCls : ''}`}
          disabled={!canRedo}
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
        onClick={() => setOpenKey(prev => prev === 'tasks' ? null : 'tasks')}
        className={`${baseBtn} ${openKey === 'tasks' ? activeCls : neutral}`}
      >
        <ListChecks className="w-5 h-5" />
        </button>
        {openKey === 'tasks' && (
          <div className="absolute left-[52px] top-0">
            <TaskList dock anchored open onClose={() => setOpenKey(null)} />
          </div>
        )}
      </div>
      <div className="relative">
        <button
        type="button"
        title="Colorgories"
        aria-pressed={openKey === 'colorgories'}
        onClick={() => setOpenKey(prev => prev === 'colorgories' ? null : 'colorgories')}
        className={`${baseBtn} ${openKey === 'colorgories' ? activeCls : neutral}`}
      >
        <TagIcon className="w-5 h-5" />
        </button>
        {openKey === 'colorgories' && (
          <div className="absolute left-[52px] top-0">
            <ColorgoryManager dock anchored open onClose={() => setOpenKey(null)} />
          </div>
        )}
      </div>
      <div className="relative">
      <button
        type="button"
        title="Tips & Info"
        aria-pressed={openKey === 'tips'}
        onClick={() => setOpenKey(prev => prev === 'tips' ? null : 'tips')}
        className={`${baseBtn} ${openKey === 'tips' ? activeCls : neutral}`}
      >
        <Info className="w-5 h-5" />
      </button>
      {openKey === 'tips' && (
        <div className="absolute left-[52px] top-0">
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
}


