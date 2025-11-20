'use client'

import React from 'react'

type TooltipVariant = 'default' | 'primary' | 'secondary' | 'danger' | 'tertiary'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  open?: boolean
  variant?: TooltipVariant
}

export default function Tooltip({ content, children, side = 'top', open = false, variant = 'default' }: TooltipProps) {
  const isTop = side === 'top'
  const isLeft = side === 'left'
  const isRight = side === 'right'
  const base = 'pointer-events-none absolute whitespace-nowrap rounded-md px-2 py-1 text-xs text-white shadow-lg transition-opacity duration-150 z-50'
  const variantClasses: Record<TooltipVariant, string> = {
    default: 'bg-gray-900',
    primary: 'bg-primary-600',
    secondary: 'bg-gray-700',
    danger: 'bg-red-600',
    tertiary: 'bg-tertiary-600',
  }
  const arrowColor: Record<TooltipVariant, string> = {
    default: 'gray-900',
    primary: 'primary-600',
    secondary: 'gray-700',
    danger: 'red-600',
    tertiary: 'tertiary-600',
  }
  return (
    <div className="relative inline-flex items-center group">
      {children}
      <div
        className={[
          base,
          variantClasses[variant],
          open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          isTop ? '-top-8 left-1/2 -translate-x-1/2' : isLeft ? 'right-full top-1/2 -translate-y-1/2' : isRight ? 'left-full ml-2 top-1/2 -translate-y-1/2' : 'top-full mt-2 left-1/2 -translate-x-1/2',
        ].join(' ')}
        role="tooltip"
      >
        {content}
        <span
          className={[
            'absolute w-0 h-0 border-4 border-transparent',
            isTop ? `top-full left-1/2 -translate-x-1/2 border-t-${arrowColor[variant]}` : `bottom-full left-1/2 -translate-x-1/2 border-b-${arrowColor[variant]}`,
          ].join(' ')}
        />
      </div>
    </div>
  )
}


