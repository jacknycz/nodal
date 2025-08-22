import React from 'react'
import clsx from 'clsx'
import { CaretDown } from '@phosphor-icons/react/dist/ssr'

export type SelectSize = 'xs' | 'sm' | 'md' | 'lg'

export interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size' | 'onChange'> {
  label?: string
  description?: string
  error?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  size?: SelectSize
  fullWidth?: boolean
  options?: SelectOption[]
  onChange?: (value: string, e: React.ChangeEvent<HTMLSelectElement>) => void
}

const sizeClasses: Record<SelectSize, string> = {
  xs: 'h-8 text-xs',
  sm: 'h-10 text-sm',
  md: 'h-12 text-sm',
  lg: 'h-14 text-base',
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      description,
      error,
      leftIcon,
      rightIcon = <CaretDown size={16} weight="duotone" />,
      size = 'md',
      fullWidth = false,
      className = '',
      options,
      value,
      onChange,
      children,
      ...props
    },
    ref
  ) => {
    const id = props.id || `select-${Math.random().toString(36).slice(2, 9)}`

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange?.(e.target.value, e)
      ;(props as any).onChange?.(e)
    }

    return (
      <div className={clsx('flex flex-col gap-1', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={id}
            className={clsx(
              'text-sm font-medium text-gray-700 dark:text-gray-300',
              error && 'text-red-600 dark:text-red-400'
            )}
          >
            {label}
            {props.required && <span aria-hidden className="ml-1 text-red-500">*</span>}
          </label>
        )}

        <div
          className={clsx(
            'relative flex cursor-pointer rounded-full border border-transparent transition-all duration-200',
            'shadow-sm shadow-gray-400/20 dark:shadow-2xl dark:shadow-primary-500/40',
            'bg-white dark:bg-gray-900/80',
            'focus-within:border-primary-500 dark:focus-within:border-primary-400/50',
            'focus-within:ring-2 focus-within:ring-primary-500/20',
            error && 'border-red-500 dark:border-red-400 focus-within:ring-red-500/20',
            sizeClasses[size],
            fullWidth && 'w-full'
          )}
        >
          {leftIcon && (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
              {leftIcon}
            </span>
          )}
          <select
            ref={ref}
            id={id}
            value={value}
            onChange={handleChange}
            className={clsx(
              'peer w-full h-full bg-transparent outline-none appearance-none cursor-pointer',
              'text-gray-700 dark:text-white font-normal font-fredoka',
              leftIcon && 'pl-9',
              rightIcon && 'pr-9',
              'px-3',
              className
            )}
            {...props}
          >
            {children ??
              options?.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                >
                  {opt.label}
                </option>
              ))}
          </select>
          {/* Chevron */}
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
            {rightIcon}
          </span>
        </div>

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

Select.displayName = 'Select'

export default Select
