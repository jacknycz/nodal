'use client'

import React from 'react'
import clsx from 'clsx'

export type RangeSize = 'sm' | 'md' | 'lg'

interface RangeProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange' | 'value'> {
  label?: string
  description?: string
  error?: string
  value: number
  onChange: (val: number) => void
  min?: number
  max?: number
  step?: number
  size?: RangeSize
  fullWidth?: boolean
  startLabel?: string
  endLabel?: string
}

const trackHeights: Record<RangeSize, string> = {
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
}

const thumbSizes: Record<RangeSize, string> = {
  sm: 'w-3 h-3',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
}

export default function Range({
  label,
  description,
  error,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.05,
  size = 'md',
  fullWidth = false,
  className = '',
  startLabel,
  endLabel,
  ...props
}: RangeProps) {
  const id = props.id || `range-${Math.random().toString(36).slice(2, 9)}`
  // Compute thumb size and offset to vertically center over 0.5rem track
  const thumbSizeRem = size === 'sm' ? 0.75 : size === 'lg' ? 1.25 : 1.0
  const trackHeightRem = 0.5
  const thumbOffsetRem = -((thumbSizeRem - trackHeightRem) / 2) // negative margin-top
  return (
    <div className={clsx('flex flex-col gap-1.5', fullWidth && 'w-full')}>
      {label && (
        <label htmlFor={id} className={clsx('block text-sm font-medium text-gray-700 dark:text-gray-300', error ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-300')}>
          {label}
        </label>
      )}
      <div className={clsx('w-full', fullWidth && 'w-full')}>
        <input
          id={id}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat((e.target as HTMLInputElement).value))}
          className={clsx(
            'w-full appearance-none bg-transparent cursor-pointer',
            className
          )}
          {...props}
        />
        {/* Custom styles for track and thumb */}
        <style jsx>{`
          input[type='range']::-webkit-slider-runnable-track {
            background: linear-gradient(to right, var(--color-primary-500), var(--color-primary-500)) no-repeat, 
                        linear-gradient(to right, rgba(107,114,128,0.35), rgba(107,114,128,0.35));
            height: ${trackHeightRem}rem;
            border-radius: 9999px;
          }
          input[type='range']::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            background: white;
            border: 2px solid var(--color-primary-500);
            border-radius: 9999px;
            width: ${thumbSizeRem}rem;
            height: ${thumbSizeRem}rem;
            margin-top: ${thumbOffsetRem}rem;
          }
          input[type='range']:focus { outline: none; }
          input[type='range']::-moz-range-track {
            background: rgba(107,114,128,0.35);
            height: ${trackHeightRem}rem;
            border-radius: 9999px;
          }
          input[type='range']::-moz-range-thumb {
            background: white;
            border: 2px solid var(--color-primary-500);
            border-radius: 9999px;
            width: ${thumbSizeRem}rem;
            height: ${thumbSizeRem}rem;
          }
        `}</style>
      </div>
      {(startLabel || endLabel) && (
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{startLabel || ''}</span>
          <span>{endLabel || ''}</span>
        </div>
      )}
      {description && !error && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
      )}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  )
}


