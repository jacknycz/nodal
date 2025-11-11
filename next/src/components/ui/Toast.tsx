'use client'

import React, { useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import clsx from 'clsx'

type ToastVariant = 'success' | 'info' | 'warning' | 'danger'

interface ToastProps {
  open: boolean
  onClose?: () => void
  variant?: ToastVariant
  autoHideMs?: number
  children?: React.ReactNode
  className?: string
  position?: 'top-center' | 'top-right' | 'top-left' | 'bottom-center' | 'bottom-right' | 'bottom-left'
}

const variantClasses: Record<ToastVariant, string> = {
  // Use brand colors where possible
  success: 'bg-emerald-600 text-white',
  info: 'bg-primary-600 text-white',
  warning: 'bg-orange-500 text-white',
  danger: 'bg-red-600 text-white',
}

const positionClasses: Record<NonNullable<ToastProps['position']>, string> = {
  'top-center': 'top-16 left-1/2 -translate-x-1/2',
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
}

export default function Toast({
  open,
  onClose,
  variant = 'success',
  autoHideMs = 2000,
  children,
  className,
  position = 'top-center',
}: ToastProps) {
  const [shouldRender, setShouldRender] = useState(open)
  const [isVisible, setIsVisible] = useState(open)
  const openedAtRef = useRef<number>(0)

  useEffect(() => {
    if (open) {
      setShouldRender(true)
      requestAnimationFrame(() => {
        setIsVisible(true)
        openedAtRef.current = Date.now()
      })
    } else {
      setIsVisible(false)
      const t = setTimeout(() => setShouldRender(false), 200)
      return () => clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => {
      setIsVisible(false)
      const t2 = setTimeout(() => {
        setShouldRender(false)
        onClose?.()
      }, 200)
      return () => clearTimeout(t2)
    }, autoHideMs)
    return () => clearTimeout(t)
  }, [open, autoHideMs, onClose])

  if (!shouldRender) return null
  if (typeof window === 'undefined') return null

  return ReactDOM.createPortal(
    <div className={clsx('fixed z-[1000] pointer-events-none', positionClasses[position])}>
      <div
        className={clsx(
          'pointer-events-auto rounded-full shadow-xl px-4 py-2 text-xs sm:text-sm transition-all duration-200',
          isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-1 scale-95',
          variantClasses[variant],
          className
        )}
        role="status"
        aria-live="polite"
        onClick={() => onClose?.()}
      >
        {children}
      </div>
    </div>,
    document.body
  )
}


