import React from 'react'
import clsx from 'clsx'

export type IconButtonVariant = 'default' | 'primary' | 'danger'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: 'sm' | 'md' | 'lg'
  'aria-label': string // required for accessibility
}

const variantClasses: Record<IconButtonVariant, string> = {
  default: 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
  primary: 'bg-primary-500 hover:bg-primary-600 text-white',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
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
          'inline-flex items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed',
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