"use client"

import React from 'react'
import { ListChecks, Tag as TagIcon, Info } from '@phosphor-icons/react'

type DockKey = 'tasks' | 'colorgories' | 'tips' | null

interface LeftDockProps {
  active: DockKey
  onToggle: (key: Exclude<DockKey, null>) => void
}

export default function LeftDock({ active, onToggle }: LeftDockProps) {
  const baseBtn = "w-10 h-10 rounded-lg flex items-center justify-center transition-colors duration-150"
  const neutral = "bg-gray-100/80 hover:bg-gray-200/80 text-gray-700 dark:bg-gray-800/80 dark:hover:bg-gray-700/80 dark:text-gray-200"
  const activeCls = "bg-primary-600 text-white hover:bg-primary-600"

  return (
    <div
      className="fixed z-50 left-0 top-16 flex flex-col gap-2 p-2 rounded-r-xl 
      border border-l-0 border-gray-200 dark:border-gray-700 
      bg-white/80 dark:bg-gray-900/80 shadow-lg backdrop-blur-sm"
      data-left-dock
      aria-label="Left dock"
    >
      <button
        type="button"
        title="Tasks"
        aria-pressed={active === 'tasks'}
        onClick={() => onToggle('tasks')}
        className={`${baseBtn} ${active === 'tasks' ? activeCls : neutral}`}
      >
        <ListChecks className="w-5 h-5" />
      </button>
      <button
        type="button"
        title="Colorgories"
        aria-pressed={active === 'colorgories'}
        onClick={() => onToggle('colorgories')}
        className={`${baseBtn} ${active === 'colorgories' ? activeCls : neutral}`}
      >
        <TagIcon className="w-5 h-5" />
      </button>
      <button
        type="button"
        title="Tips & Info"
        aria-pressed={active === 'tips'}
        onClick={() => onToggle('tips')}
        className={`${baseBtn} ${active === 'tips' ? activeCls : neutral}`}
      >
        <Info className="w-5 h-5" />
      </button>
    </div>
  )
}


