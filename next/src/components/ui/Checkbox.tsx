import React from 'react'
import clsx from 'clsx'

export type CheckboxSize = 'sm' | 'md' | 'lg'
export type CheckboxVariant = 'default' | 'unstyled'

interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size' | 'onChange' | 'type'> {
  label?: string
  description?: string
  error?: string
  size?: CheckboxSize
  variant?: CheckboxVariant
  fullWidth?: boolean
  indeterminate?: boolean
  checked?: boolean
  defaultChecked?: boolean
  onChange?: (checked: boolean, e: React.ChangeEvent<HTMLInputElement>) => void
  inputClassName?: string
  labelTextClassName?: string
  descriptionClassName?: string
  controlClassName?: string
}

const boxSize: Record<CheckboxSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
}

const iconSize: Record<CheckboxSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      label,
      description,
      error,
      size = 'md',
      variant = 'default',
      fullWidth = false,
      indeterminate = false,
      disabled = false,
      className = '',
      inputClassName = '',
      labelTextClassName = '',
      descriptionClassName = '',
      controlClassName = '',
      checked,
      defaultChecked,
      onChange,
      ...props
    },
    ref
  ) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null)

    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement)

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = !!indeterminate && !checked
      }
    }, [indeterminate, checked])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(e.target.checked, e)
    }

    const control = (
      <span
        className={clsx(
          'relative inline-flex items-center justify-center border rounded transition-colors select-none',
          boxSize[size],
          variant === 'default' &&
            'border-gray-300 bg-white text-white peer-focus:ring-2 peer-focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-900',
          error && 'border-red-500',
          disabled && 'opacity-60 cursor-not-allowed',
          controlClassName
        )}
        aria-hidden="true"
      >
        {/* Check icon */}
        <svg
          className={clsx(
            'opacity-0 peer-checked:opacity-100 transition-opacity text-blue-600',
            iconSize[size]
          )}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-7.364 7.364a1 1 0 01-1.414 0L3.293 9.436a1 1 0 011.414-1.414l3.222 3.222 6.657-6.657a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {/* Indeterminate icon */}
        <svg
          className={clsx(
            'absolute opacity-0 transition-opacity text-blue-600',
            indeterminate && !checked && 'opacity-100',
            iconSize[size]
          )}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <rect x="5" y="9" width="10" height="2" rx="1" />
        </svg>
      </span>
    )

    return (
      <label
        className={clsx(
          'inline-flex items-start gap-3 cursor-pointer',
          disabled && 'cursor-not-allowed',
          fullWidth && 'w-full',
          className
        )}
      >
        <span className="relative inline-flex">
          <input
            ref={inputRef}
            type="checkbox"
            className={clsx('peer sr-only', inputClassName)}
            disabled={disabled}
            checked={checked}
            defaultChecked={defaultChecked}
            onChange={handleChange}
            {...props}
          />
          {control}
        </span>

        {(label || description || error) && (
          <span className="mt-[-1px] flex flex-col">
            {label && (
              <span className={clsx('text-sm font-medium text-gray-900 dark:text-white', labelTextClassName)}>{label}</span>
            )}
            {description && !error && (
              <span className={clsx('text-xs text-gray-500 dark:text-gray-400', descriptionClassName)}>{description}</span>
            )}
            {error && (
              <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
            )}
          </span>
        )}
      </label>
    )
  }
)

Checkbox.displayName = 'Checkbox'

export default Checkbox


