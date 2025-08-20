import React from 'react'
import clsx from 'clsx'

export type IconButtonVariant = 'default' | 'primary' | 'danger' | 'primaryGhost' | 'secondary' | 'secondaryGhost' | 'dangerGhost'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large'
  'aria-label': string // required for accessibility
}

const variantClasses: Record<IconButtonVariant, string> = {
  default: 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
  primary: 'bg-primary-500 hover:bg-primary-600 text-white',
  primaryGhost: 'bg-transparent hover:bg-primary-100 text-primary-600',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
  secondaryGhost: 'bg-transparent hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
  dangerGhost: 'bg-transparent hover:bg-red-100 text-red-500',
}

const sizeClasses = {
  sm: 'w-6 h-6',
  small: 'w-6 h-6',
  md: 'w-8 h-8',
  medium: 'w-8 h-8',
  lg: 'w-12 h-12',
  large: 'w-12 h-12',
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({
    children,
    variant = 'default',
    size = 'md',
    className = '',
    ...props
  }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={clsx(
          'inline-flex flex-none items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
IconButton.displayName = 'IconButton'

export default IconButton 