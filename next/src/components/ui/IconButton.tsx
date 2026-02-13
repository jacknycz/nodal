import React from 'react'
import clsx from 'clsx'

export type IconButtonVariant = 'default' | 'primary' | 'danger' | 'primaryGhost' | 'secondary' | 'secondaryGhost' | 'dangerGhost' | 'primaryOutline' | 'secondaryOutline'

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'small' | 'medium' | 'large'
  'aria-label': string // required for accessibility
}

const variantClasses: Record<IconButtonVariant, string> = {
  default: 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
  primary: 'bg-primary-500 hover:bg-primary-600 text-white',
  primaryGhost: 'bg-transparent hover:border-2 hover:border-primary-600 text-primary-600',
  primaryOutline: 'bg-transparent border-2 border-primary-500 text-primary-600 hover:bg-primary-50 hover:border-primary-600 hover:text-primary-700 dark:hover:bg-primary-900/20',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
  secondaryGhost: 'bg-transparent hover:bg-gray-100 text-gray-700 dark:hover:bg-gray-600 dark:text-gray-200',
  secondaryOutline: 'bg-transparent border-2 border-gray-400 text-gray-700 dark:border-gray-400 dark:text-gray-200',
  danger: 'bg-red-500 hover:bg-red-600 text-white',
  dangerGhost: 'bg-transparent hover:bg-red-100 text-red-500',
}

const sizeClasses = {
  // Align control heights: sm=32px, md=40px, lg=48px
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  small: 'w-8 h-8',
  md: 'w-10 h-10',
  medium: 'w-10 h-10',
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