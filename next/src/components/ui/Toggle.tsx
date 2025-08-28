import React from 'react'
import clsx from 'clsx'

export type ToggleSize = 'sm' | 'md' | 'lg'

interface ToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked: boolean
  onChange: (checked: boolean) => void
  size?: ToggleSize
  disabled?: boolean
  label?: string
  description?: string
}

const sizeClasses: Record<ToggleSize, string> = {
  sm: 'h-5 w-9',
  md: 'h-6 w-11',
  lg: 'h-7 w-14',
}

const knobSizeClasses: Record<ToggleSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

const knobTranslateClasses: Record<ToggleSize, string> = {
  sm: 'translate-x-5',
  md: 'translate-x-6',
  lg: 'translate-x-8',
}

const Toggle = React.forwardRef<HTMLButtonElement, ToggleProps>(
  ({
    checked,
    onChange,
    size = 'md',
    disabled = false,
    label,
    description,
    className = '',
    ...props
  }, ref) => {
    const handleClick = () => {
      if (!disabled) {
        onChange(!checked)
      }
    }

    return (
      <div className="flex items-center gap-3">
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          disabled={disabled}
          onClick={handleClick}
          className={clsx(
            'cursor-pointer relative inline-flex items-center rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800',
            sizeClasses[size],
            checked
              ? 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600'
              : 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500',
            disabled && 'opacity-50 cursor-not-allowed',
            className
          )}
          {...props}
        >
          <span
            className={clsx(
              'inline-block rounded-full bg-white dark:bg-gray-800 transition-all duration-300 ease-in-out shadow-sm',
              knobSizeClasses[size],
              checked ? knobTranslateClasses[size] : 'translate-x-1'
            )}
          />
        </button>
        {(label || description) && (
          <div className="flex flex-col">
            {label && (
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {label}
              </span>
            )}
            {description && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {description}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }
)
Toggle.displayName = 'Toggle'

export default Toggle 