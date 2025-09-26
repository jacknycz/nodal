'use client'

import React from 'react'
import clsx from 'clsx'

export interface ToggleOption<T extends string = string> {
  value: T
  label: React.ReactNode
}

interface ToggleGroupProps<T extends string = string> {
  value: T
  onChange: (value: T) => void
  options: ToggleOption<T>[]
  className?: string
  size?: 'sm' | 'md'
  label?: string
}

export default function ToggleGroup<T extends string = string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
  label,
}: ToggleGroupProps<T>) {
  return (
    <div className={clsx('inline-flex flex-col gap-1', className)}>
      {label && (
        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</div>
      )}
      <div
        role="radiogroup"
        className={clsx(
          'inline-flex rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800',
        )}
      >
        {options.map((opt, idx) => {
          const active = opt.value === value
          return (
            <button
              key={String(opt.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={clsx(
                'px-2 sm:px-3 text-xs sm:text-sm cursor-pointer font-medium transition-colors focus:outline-none',
                size === 'sm' ? 'py-1' : 'py-1.5',
                active
                  ? 'bg-primary-600 text-white'
                  : 'bg-transparent text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700',
                idx !== options.length - 1 && 'border-r border-gray-300 dark:border-gray-700'
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}


