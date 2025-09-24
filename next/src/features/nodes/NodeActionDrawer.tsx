'use client'

import React from 'react'

export default function NodeActionDrawer({ children, className = '', open = false }: { children: React.ReactNode; className?: string; open?: boolean }) {
  const base = "absolute -right-4 -top-5 transition-all duration-200 z-10"
  // Delay hide by 1000ms, but show immediately on hover
  const hoverControlled = "pointer-events-none group-hover:pointer-events-auto translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 delay-500 group-hover:delay-0"
  const forceOpen = "pointer-events-auto translate-x-0 opacity-100 delay-0"
  return (
    <div className={`${base} ${open ? forceOpen : hoverControlled} ${className}`}>
      <div className="flex items-center gap-2 p-2
      bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 
      rounded-lg shadow-lg">
        {children}
      </div>
    </div>
  )
}


