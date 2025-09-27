'use client'

import React from 'react'
import { useBoardStore } from '../board/boardSlice'

export default function NodeActionDrawer({ children, className = '', open = false, selected = false }: { children: React.ReactNode; className?: string; open?: boolean; selected?: boolean }) {
  const selectedIds: string[] = useBoardStore((s: any) => s.selectedNodeIds || [])
  const singleSelected = selectedIds.length === 1
  const shouldShow = singleSelected && selected

  // Centered over the node, subtly animated, behind node content
  const base = "absolute bottom-[100%] left-1/2 -translate-x-1/2 translate-y-0 transition-all duration-200 ease-out -z-10"
  const hiddenCls = "pointer-events-none opacity-0 scale-95 translate-y-1/2"
  const visibleCls = "pointer-events-auto opacity-100 scale-100"

  return (
    <div className={`${base} ${shouldShow || open ? visibleCls : hiddenCls} ${className}`}>
      <div className="flex items-center gap-1 p-1 
      bg-white/80 dark:bg-gray-900/80 
      rounded-t-lg shadow-lg">
        {children}
      </div>
    </div>
  )
}


