import React from 'react'
import clsx from 'clsx'

export type TextAreaSize = 'sm' | 'md' | 'lg'
export type TextAreaVariant = 'default' | 'unstyled'

interface TextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string
  description?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  size?: TextAreaSize
  variant?: TextAreaVariant
  fullWidth?: boolean
}

const sizeClasses: Record<TextAreaSize, string> = {
  sm: 'px-2 py-1 text-sm',
  md: 'px-3 py-2 text-sm',
  lg: 'px-4 py-3 text-base',
}

const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({
    label,
    description,
    error,
    leftIcon,
    rightIcon,
    size = 'md',
    variant = 'default',
    fullWidth = false,
    className = '',
    rows = 3,
    ...props
  }, ref) => {
    const baseField = (
      <div className={clsx('relative', fullWidth && 'w-full')}>
        {leftIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-start pt-2 pl-3 text-gray-400">
            {leftIcon}
          </span>
        )}
        <textarea
          ref={ref}
          rows={rows}
          className={clsx(
            'rounded-md border focus:outline-none focus:ring-2 transition-colors',
            'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white',
            'focus:ring-blue-500 focus:border-blue-500',
            leftIcon && 'pl-9',
            rightIcon && 'pr-9',
            sizeClasses[size],
            variant === 'unstyled' && 'border-transparent focus:ring-0 focus:border-transparent p-0',
            fullWidth && 'w-full',
            className,
            error && 'border-red-500 focus:ring-red-500 focus:border-red-500'
          )}
          {...props}
        />
        {rightIcon && (
          <span className="absolute inset-y-0 right-0 flex items-start pt-2 pr-3 text-gray-400">
            {rightIcon}
          </span>
        )}
      </div>
    )

    if (!label && !description && !error) return baseField

    return (
      <div className={clsx('flex flex-col gap-1', fullWidth && 'w-full')}> 
        {label && (
          <label className="text-sm font-medium text-gray-900 dark:text-white">
            {label}
            {props.required && (
              <span aria-hidden className="ml-1 text-red-500">*</span>
            )}
          </label>
        )}
        {baseField}
        {description && !error && (
          <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
        )}
        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}
      </div>
    )
  }
)

TextArea.displayName = 'TextArea'

export default TextArea


