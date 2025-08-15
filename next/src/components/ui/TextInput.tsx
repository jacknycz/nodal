import React, { useState } from 'react'
import clsx from 'clsx'

export type TextInputSize = 'sm' | 'md' | 'lg'

interface TextInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string
  description?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  size?: TextInputSize
  fullWidth?: boolean
}

const sizeClasses: Record<TextInputSize, string> = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-3 py-3 text-sm',
  lg: 'px-3 py-3 text-base',
}

const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({
    label,
    description,
    error,
    leftIcon,
    rightIcon,
    size = 'md',
    fullWidth = false,
    className = '',
    value,
    onChange,
    ...props
  }, ref) => {
    const inputId = props.id || `input-${Math.random().toString(36).substr(2, 9)}`
    const [isFocused, setIsFocused] = useState(false)
    
    // Determine if label should be in "active" state (focused or has value)
    const isActive = isFocused || (value && value.toString().length > 0)

    return (
      <div className={clsx('flex flex-col gap-2', fullWidth && 'w-full')}>
        {/* Input container with label inside */}
        <div
          className={clsx(
            'relative rounded-full border border-transparent transition-all duration-200',
            'bg-gray-100 dark:bg-gray-800',
            'focus-within:bg-white dark:focus-within:bg-gray-900',
            'focus-within:border-primary-500 dark:focus-within:border-primary-400/50',
            'focus-within:ring-2 focus-within:ring-primary-500/20',
            error && 'border-red-500 dark:border-red-400 focus-within:border-red-500 dark:focus-within:border-red-400 focus-within:ring-red-500/20',
            size === 'sm' && 'min-h-[40px]',
            size === 'md' && 'min-h-[48px]',
            size === 'lg' && 'min-h-[52px]'
          )}
        >
          {/* Label inside container */}
          {label && (
            <label 
              htmlFor={inputId}
              className={clsx(
                'absolute left-5 font-medium transition-all duration-200',
                'text-gray-500 dark:text-gray-400',
                'peer-focus-within:text-blue-600 dark:peer-focus-within:text-blue-400',
                error && 'text-red-500 dark:text-red-400 peer-focus-within:text-red-500 dark:peer-focus-within:text-red-400',
                // Label positioning and size based on active state
                isActive ? [
                  'text-xs',
                  size === 'sm' && 'top-1.5',
                  size === 'md' && 'top-2',
                  size === 'lg' && 'top-2.5'
                ] : [
                  'text-sm',
                  size === 'sm' && 'top-2.5',
                  size === 'md' && 'top-3.5',
                  size === 'lg' && 'top-3.5'
                ]
              )}
            >
              {label}
              {props.required && (
                <span aria-hidden className="ml-1 text-red-500">*</span>
              )}
            </label>
          )}
          
          {/* Input field */}
          <div className={clsx('relative', fullWidth && 'w-full')}>
            {leftIcon && (
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                {leftIcon}
              </span>
            )}
            <input
              ref={ref}
              id={inputId}
              value={value}
              onChange={onChange}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className={clsx(
                'peer w-full bg-transparent border-none outline-none',
                'text-gray-900 dark:text-white placeholder-transparent pl-5',
                leftIcon && 'pl-9',
                rightIcon && 'pr-9',
                sizeClasses[size],
                // Add padding-top when label is present to make room for it
                label && size === 'sm' && 'pt-4 pb-1',
                label && size === 'md' && 'pt-5 pb-2',
                label && size === 'lg' && 'pt-6 pb-2',
                // No label padding
                !label && size === 'sm' && 'py-2',
                !label && size === 'md' && 'py-3',
                !label && size === 'lg' && 'py-3',
                className
              )}
              {...props}
            />
            {rightIcon && (
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
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

TextInput.displayName = 'TextInput'

export default TextInput
