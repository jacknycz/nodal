'use client'

import React from 'react'

export default function NodeActionDrawer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={"pointer-events-none group-hover:pointer-events-auto absolute -right-4 -top-5 translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200 z-10 " + className}>
      <div className="flex items-center gap-1 bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-1">
        {children}
      </div>
    </div>
  )
}


