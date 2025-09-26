'use client'

import React from 'react'
import clsx from 'clsx'

interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export default function Link({ leftIcon, rightIcon, className, children, onClick, href, ...rest }: LinkProps) {
  const isButton = !href
  const base = (
    <span
      className={clsx(
        'inline-flex items-center gap-1 text-xs sm:text-sm font-medium text-primary-700 dark:text-primary-300 hover:text-primary-900 dark:hover:text-primary-200',
        'cursor-pointer select-none'
      )}
    >
      {leftIcon && <span className="inline-flex items-center">{leftIcon}</span>}
      <span className="underline underline-offset-2 decoration-primary-300/60 hover:decoration-primary-500 truncate">{children}</span>
      {rightIcon && <span className="inline-flex items-center">{rightIcon}</span>}
    </span>
  )

  if (isButton) {
    return (
      <button type="button" onClick={onClick} className={clsx('bg-transparent p-0 border-0', className)} {...(rest as any)}>
        {base}
      </button>
    )
  }

  return (
    <a href={href} onClick={onClick} className={clsx('no-underline', className)} {...rest}>
      {base}
    </a>
  )
}


