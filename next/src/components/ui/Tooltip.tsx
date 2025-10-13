'use client'

import React from 'react'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'bottom'
  open?: boolean
}

export default function Tooltip({ content, children, side = 'top', open = false }: TooltipProps) {
  const isTop = side === 'top'
  return (
    <div className="relative inline-flex items-center group/tt">
      {children}
      <div
        className={[
          'pointer-events-none absolute whitespace-nowrap rounded-md px-2 py-1 text-xs text-white bg-gray-900 shadow-lg transition-opacity duration-150 z-50',
          open ? 'opacity-100' : 'opacity-0 group-hover/tt:opacity-100',
          isTop ? '-top-8 left-1/2 -translate-x-1/2' : 'top-full mt-2 left-1/2 -translate-x-1/2',
        ].join(' ')}
        role="tooltip"
      >
        {content}
        <span
          className={[
            'absolute w-0 h-0 border-4 border-transparent',
            isTop ? 'top-full left-1/2 -translate-x-1/2 border-t-gray-900' : 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900',
          ].join(' ')}
        />
      </div>
    </div>
  )
}


