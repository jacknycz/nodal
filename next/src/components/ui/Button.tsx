import React from 'react'
import clsx from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'icon' | 'primaryGhost' | 'secondaryGhost' | 'dangerGhost'

export type ButtonSize = 'small' | 'medium' | 'large' | 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-700 dark:hover:bg-primary-600 text-white',
  primaryGhost: 'bg-transparent hover:bg-primary-100 text-primary-600',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white',
  secondaryGhost: 'bg-transparent hover:bg-gray-100 text-gray-900 dark:hover:bg-gray-600 dark:text-white',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
  dangerGhost: 'bg-transparent hover:bg-red-100 text-red-500',
  icon: 'bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-200 p-1 rounded-full',
}

const sizeClasses: Record<ButtonSize, string> = {
  small: 'px-2 py-1.5 text-sm',
  sm: 'px-2 py-1.5 text-sm',
  medium: 'px-4 py-2 text-base',
  md: 'px-4 py-2 text-base',
  large: 'px-5 py-3 text-lg',
  lg: 'px-5 py-3 text-lg',
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    children,
    variant = 'primary',
    size = 'medium',
    loading = false,
    disabled = false,
    fullWidth = false,
    className = '',
    ...props
  }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center rounded-full font-fredoka font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed',
          sizeClasses[size],
          variantClasses[variant],
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = 'Button'

export default Button 