'use client'

import React from 'react'
import clsx from 'clsx'

export interface TagProps {
  children: React.ReactNode
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'beta'
  className?: string
  onClick?: () => void
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  onRightIconClick?: (e?: React.MouseEvent) => void
}

export default function Tag({ 
  children, 
  variant = 'default',
  className,
  onClick
  , leftIcon, rightIcon, onRightIconClick
}: TagProps) {
  const baseClasses = 'inline-flex items-center font-medium rounded-sm transition-colors duration-150 px-2 py-0 text-xs h-5'
  
  const variantClasses = {
    default: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
    primary: 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border-primary-200 dark:border-primary-800',
    secondary: 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
    success: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    danger: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    beta: 'bg-gradient-to-br from-red-500 to-tertiary-300 text-white border-transparent shadow-sm'
  }
  
  const interactiveClasses = onClick ? 'cursor-pointer hover:opacity-80 active:scale-95' : ''
  
  return (
    <span
      className={clsx(
        baseClasses,
        variantClasses[variant],
        interactiveClasses,
        className
      )}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      } : undefined}
    >
      {leftIcon && (
        <span className="mr-1 inline-flex items-center">{leftIcon}</span>
      )}
      <span className="truncate">{children}</span>
      {rightIcon && (
        <span className="ml-1 inline-flex items-center">{rightIcon}</span>
      )}
    </span>
  )
}
