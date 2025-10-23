import React from 'react'
import clsx from 'clsx'
import { CalendarBlank } from '@phosphor-icons/react/dist/ssr'

export type DateInputSize = 'sm' | 'md' | 'lg'

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'type'> {
  label?: string
  description?: string
  error?: string
  size?: DateInputSize
  fullWidth?: boolean
}

const sizeClasses: Record<DateInputSize, string> = {
  sm: 'h-8 px-3 py-1 text-sm',
  md: 'h-10 px-3 py-2 text-sm',
  lg: 'h-12 px-3 py-2 text-base',
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  (
    {
      label,
      description,
      error,
      size = 'md',
      fullWidth = false,
      className = '',
      value,
      onChange,
      ...props
    },
    ref
  ) => {
    const inputId = props.id || `date-input-${Math.random().toString(36).slice(2, 9)}`
    return (
      <div className={clsx('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={inputId} className={clsx('block text-sm font-medium text-gray-700 dark:text-gray-300')}>
            {label}
            {props.required && <span aria-hidden className="ml-1 text-red-500">*</span>}
          </label>
        )}
        <div
          className={clsx(
            'relative rounded-full border border-transparent transition-all duration-200',
            sizeClasses[size],
            'bg-gray-100 dark:bg-gray-950/80',
            'focus-within:bg-white dark:focus-within:bg-gray-900',
            'focus-within:border-primary-500 dark:focus-within:border-primary-400/50',
            'focus-within:ring-2 focus-within:ring-primary-500/20',
            error && 'border-red-500 dark:border-red-400 focus-within:border-red-500 dark:focus-within:border-red-400 focus-within:ring-red-500/20'
          )}
        >
          <div className={clsx('relative h-full', fullWidth && 'w-full')}>
            <span className="absolute inset-y-0 left-2 flex items-center text-gray-500 dark:text-gray-400">
              <CalendarBlank className="w-4 h-4" />
            </span>
            <input
              ref={ref}
              id={inputId}
              type="date"
              value={value as any}
              onChange={onChange}
              className={clsx(
                'peer w-full text-base! md:text-sm! h-full bg-transparent border-none outline-none pl-7 pr-2',
                'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500',
                className
              )}
              {...props}
            />
          </div>
        </div>
        {description && !error && (
          <span className="text-xs text-gray-500 dark:text-gray-400 px-1">{description}</span>
        )}
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400 px-1">{error}</span>
        )}
      </div>
    )
  }
)

DateInput.displayName = 'DateInput'

export default DateInput


