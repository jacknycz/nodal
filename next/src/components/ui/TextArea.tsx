import React, { useState } from 'react'
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
    rows = 3,
    value,
    onChange,
    ...props
  }, ref) => {
    const textareaId = props.id || `textarea-${Math.random().toString(36).substr(2, 9)}`
    const [isFocused, setIsFocused] = useState(false)
    
    // Determine if label should be in "active" state (focused or has value)
    const isActive = isFocused || (value && value.toString().length > 0)

    return (
      <div className={clsx('flex flex-col gap-2', fullWidth && 'w-full')}>
        {/* Textarea container with label inside */}
        <div
          className={clsx(
            'relative rounded-4xl border border-transparent transition-all duration-200 overflow-hidden',
            'bg-gray-100 dark:bg-gray-800',
            'focus-within:bg-white dark:focus-within:bg-gray-900',
            'focus-within:border-primary-500/50 dark:focus-within:border-primary-400/50',
            'focus-within:ring-2 focus-within:ring-primary-500/20',
            error && 'border-red-500 dark:border-red-400 focus-within:border-red-500 dark:focus-within:border-red-400 focus-within:ring-red-500/20'
          )}
        >
          {/* Label inside container */}
          {label && (
            <label 
              htmlFor={textareaId}
              className={clsx(
                'absolute left-5 font-medium transition-all duration-200',
                'text-gray-500 dark:text-gray-400',
                'peer-focus-within:text-primary-600 dark:peer-focus-within:text-primary-400',
                error && 'text-red-500 dark:text-red-400 peer-focus-within:text-red-500 dark:peer-focus-within:text-red-400',
                // Label positioning and size based on active state
                isActive ? [
                  'text-xs',
                  size === 'sm' && 'top-2',
                  size === 'md' && 'top-2',
                  size === 'lg' && 'top-3'
                ] : [
                  'text-sm',
                  size === 'sm' && 'top-3',
                  size === 'md' && 'top-3.5',
                  size === 'lg' && 'top-4'
                ]
              )}
            >
              {label}
              {props.required && (
                <span aria-hidden className="ml-1 text-red-500">*</span>
              )}
            </label>
          )}
          
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
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={clsx(
                'peer w-full bg-transparent border-none outline-none resize-none pl-5',
                'text-gray-900 dark:text-white text-base! md:text-sm! placeholder-transparent',
                leftIcon && 'pl-9',
                rightIcon && 'pr-9',
                sizeClasses[size],
                // Add padding-top when label is present to make room for it
                label && size === 'sm' && 'pt-6 pb-2',
                label && size === 'md' && 'pt-7 pb-3',
                label && size === 'lg' && 'pt-8 pb-3',
                // No label padding
                !label && size === 'sm' && 'py-2',
                !label && size === 'md' && 'py-3',
                !label && size === 'lg' && 'py-3',
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
