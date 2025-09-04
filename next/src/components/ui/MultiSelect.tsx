import React, { useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { CaretDown, XCircle } from '@phosphor-icons/react/dist/ssr'
import Checkbox from './Checkbox'

export type MultiSelectSize = 'xs' | 'sm' | 'md' | 'lg'

export interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  label?: string
  placeholder?: string
  values: string[]
  onChange: (values: string[]) => void
  options: MultiSelectOption[]
  size?: MultiSelectSize
  fullWidth?: boolean
  className?: string
  disabled?: boolean
  error?: string
  description?: string
  maxTags?: number
}

const sizeClasses: Record<MultiSelectSize, string> = {
  xs: 'h-8 text-xs',
  sm: 'h-10 text-sm',
  md: 'h-12 text-sm',
  lg: 'h-14 text-base',
}

export default function MultiSelect({
  label,
  placeholder = 'Select...',
  values,
  onChange,
  options,
  size = 'md',
  fullWidth = false,
  className = '',
  disabled = false,
  error,
  description,
  maxTags = 2,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const selectedOptions = useMemo(() => {
    const map = new Map(options.map(o => [o.value, o.label]))
    return values.map(v => ({ value: v, label: map.get(v) || v }))
  }, [values, options])

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const toggleValue = (val: string, checked: boolean) => {
    if (checked) {
      if (!values.includes(val)) onChange([...values, val])
    } else {
      if (values.includes(val)) onChange(values.filter(v => v !== val))
    }
  }

  const clearAll = () => onChange([])

  return (
    <div className={clsx('flex flex-col gap-1', fullWidth && 'w-full')} ref={containerRef}>
      {label && (
        <label className={clsx(
          'text-sm font-medium text-gray-700 dark:text-gray-300',
          error && 'text-red-600 dark:text-red-400'
        )}>
          {label}
        </label>
      )}

      <div
        className={clsx(
          'relative rounded-full border border-transparent transition-all duration-200',
          'shadow-sm shadow-gray-400/20 dark:shadow-2xl dark:shadow-primary-500/40',
          'bg-white dark:bg-gray-900/80',
          'focus-within:border-primary-500 dark:focus-within:border-primary-400/50',
          'focus-within:ring-2 focus-within:ring-primary-500/20',
          error && 'border-red-500 dark:border-red-400 focus-within:ring-red-500/20',
          sizeClasses[size],
          fullWidth && 'w-full',
          disabled && 'opacity-60 cursor-not-allowed'
        )}
      >
        {/* Control */}
        <button
          type="button"
          className={clsx(
            'w-full h-full flex items-center gap-2 pl-3 pr-9 text-left',
            'text-gray-800 dark:text-gray-100'
          )}
          disabled={disabled}
          onClick={() => setOpen(v => !v)}
        >
          {selectedOptions.length === 0 ? (
            <span className="text-gray-400">{placeholder}</span>
          ) : (
            <div className="flex items-center gap-1 flex-wrap">
              {selectedOptions.slice(0, maxTags).map(opt => (
                <span key={opt.value} className="px-2 py-0.5 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                  {opt.label}
                </span>
              ))}
              {selectedOptions.length > maxTags && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  +{selectedOptions.length - maxTags} more
                </span>
              )}
            </div>
          )}
        </button>
        {/* Chevron */}
        <span className="pointer-events-none absolute inset-y-0 right-7 flex items-center pr-1 text-gray-400">
          <CaretDown size={16} weight="duotone" />
        </span>
        {/* Clear */}
        {selectedOptions.length > 0 && (
          <button
            type="button"
            aria-label="Clear"
            onClick={clearAll}
            className="absolute inset-y-0 right-1 flex items-center pr-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            <XCircle size={18} weight="duotone" />
          </button>
        )}

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 left-0 right-0 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl max-h-60 overflow-y-auto scrollbar-themed" onMouseDown={(e) => e.preventDefault()}>
            <ul className="py-1">
              {options.map(opt => {
                const checked = values.includes(opt.value)
                return (
                  <li key={opt.value} className="px-1 py-0.5" onMouseDown={(e) => e.preventDefault()}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-2 py-1 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/60 text-left"
                      onClick={() => toggleValue(opt.value, !checked)}
                    >
                      <Checkbox
                        checked={checked}
                        onChange={(c, e) => { e.stopPropagation() }}
                        aria-hidden
                      />
                      <span className="text-sm text-gray-800 dark:text-gray-200">{opt.label}</span>
                    </button>
                  </li>
                )
              })}
              {options.length === 0 && (
                <li className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">No options</li>
              )}
            </ul>
          </div>
        )}
      </div>

      {description && !error && (
        <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
      )}
      {error && (
        <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  )}
