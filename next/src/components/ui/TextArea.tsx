import React from 'react'
import clsx from 'clsx'

export type TextAreaSize = 'sm' | 'md' | 'lg'

interface TextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  label?: string
  description?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  size?: TextAreaSize
  fullWidth?: boolean
  bgClassName?: string
}

const sizeClasses: Record<TextAreaSize, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-3 py-3 text-sm',
  lg: 'px-3 py-3 text-base',
}

const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({
    label,
    description,
    error,
    leftIcon,
    rightIcon,
    size = 'md',
    fullWidth = false,
    className = '',
    bgClassName = '',
    rows = 3,
    value,
    onChange,
    ...props
  }, ref) => {
    const textareaId = props.id || `textarea-${Math.random().toString(36).substr(2, 9)}`
    return (
      <div className={clsx('flex flex-col gap-2', fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={textareaId} className={clsx('block text-sm font-medium text-gray-700 dark:text-gray-300')}>{label}{props.required && (<span aria-hidden className="ml-1 text-red-500">*</span>)}</label>
        )}

        {/* Textarea container (no label inside) */}
        <div className={clsx(
          'relative rounded-2xl px-3 py-2 border border-transparent transition-all duration-200',
          'bg-gray-100 dark:bg-gray-950/80', bgClassName,
          'focus-within:bg-white dark:focus-within:bg-gray-900',
          'focus-within:border-primary-500/50 dark:focus-within:border-primary-400/50',
          'focus-within:ring-2 focus-within:ring-primary-500/20',
          error && 'border-red-500 dark:border-red-400 focus-within:border-red-500 dark:focus-within:border-red-400 focus-within:ring-red-500/20'
        )}>
          {/* Textarea field */}
          <div className={clsx('relative', fullWidth && 'w-full')}>
            {leftIcon && (
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-start pt-2 pl-3 text-gray-400">
                {leftIcon} 
              </span>
            )}
            <textarea
              ref={ref}
              id={textareaId}
              rows={rows}
              value={value}
              onChange={onChange}
              placeholder={props.placeholder}
              className={clsx(
                'peer w-full bg-transparent border-none outline-none resize-none pl-1',
                'text-gray-900 dark:text-white text-base! md:text-sm! placeholder-gray-400 dark:placeholder-gray-500',
                leftIcon && 'pl-9',
                rightIcon && 'pr-9',
                sizeClasses[size],
                // Normalize padding to match TextInput spacing
                'py-3 px-0',
                className
              )}
              {...props}
            />
            {rightIcon && (
              <span className="absolute inset-y-0 right-0 flex items-start pt-2 pr-3 text-gray-400">
                {rightIcon}
              </span>
            )}
          </div>
        </div>

        {/* Messaging below container */}
        {description && !error && (
          <span className="text-xs text-left text-gray-500 dark:text-gray-400 px-1">{description}</span>
        )}
        {error && (
          <span className="text-xs text-left text-red-600 dark:text-red-400 px-1">{error}</span>
        )}
      </div>
    )
  }
)

TextArea.displayName = 'TextArea'

export default TextArea
