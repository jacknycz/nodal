'use client'

import React, { useState, useRef, useEffect } from 'react'

export interface MenuItem {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  divider?: boolean
  nativeClick?: boolean
}

interface MenuProps {
  trigger: React.ReactNode
  items?: MenuItem[]
  align?: 'left' | 'right'
  className?: string
  triggerClassName?: string
  showNotification?: boolean
  customContent?: React.ReactNode
  width?: string
  fixedCenterAbove?: boolean
  openOnHover?: boolean
}

export default function Menu({
  trigger,
  items,
  align = 'right',
  className = '',
  triggerClassName = '',
  showNotification = false,
  customContent,
  width
  , fixedCenterAbove = false,
  openOnHover = false
}: MenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handlePointerDownOutside = (event: Event) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      // Use capture phase so outside clicks close even if inner elements stopPropagation
      document.addEventListener('pointerdown', handlePointerDownOutside, true)
      document.addEventListener('mousedown', handlePointerDownOutside, true)
      document.addEventListener('touchstart', handlePointerDownOutside, true)
      return () => {
        document.removeEventListener('pointerdown', handlePointerDownOutside, true)
        document.removeEventListener('mousedown', handlePointerDownOutside, true)
        document.removeEventListener('touchstart', handlePointerDownOutside, true)
      }
    }
  }, [isOpen])

  // Remove hover close delay by default; only used if openOnHover is true
  const closeTimeoutRef = useRef<number | null>(null)

  const openMenu = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    setIsOpen(true)
  }

  const closeMenuWithDelay = (ms = 0) => {
    if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current)
    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false)
      closeTimeoutRef.current = null
    }, ms) as unknown as number
  }

  const cancelClose = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }

  // Remove focus/blur-based open/close to avoid flicker; rely on click + outside click only

  return (
    <div
      ref={menuRef}
      className={`relative ${className}`}
      onMouseEnter={openOnHover ? openMenu : undefined}
      onMouseLeave={openOnHover ? () => closeMenuWithDelay(150) : undefined}
    >
      {/* Trigger */}
      <div
        className={`relative flex cursor-pointer ${triggerClassName}`}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen((v) => !v)
        }}
      >
        {trigger}
        {showNotification && (
          <span className="absolute top-1 right-1 block w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800" />
        )}
      </div>

      {/* Dropdown */}
      <div
        onMouseEnter={openOnHover ? () => { cancelClose(); setIsOpen(true) } : undefined}
        onMouseLeave={openOnHover ? () => closeMenuWithDelay(150) : undefined}
        className={`
          ${fixedCenterAbove ? 'fixed left-1/2 bottom-20 transform -translate-x-1/2 z-[350]' : 'absolute z-[350]'} ${width || 'w-56'} rounded-2xl overflow-hidden 
          bg-[linear-gradient(165deg,rgba(241,245,249,1)_0%,rgba(255,255,255,1)_20%,rgba(255,255,255,1)_80%,rgba(241,245,249,1)_100%)]
          dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-950
          shadow-lg shadow-gray-400/20 dark:shadow-none focus:outline-none
          transition-all duration-200 ease-out
          ${!fixedCenterAbove ? (align === 'right' ? 'right-0' : 'left-0') : ''}
          ${isOpen 
            ? 'opacity-100 scale-100 translate-y-0' 
            : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'
          }
        `}
      >
        {customContent ? (
          customContent
        ) : items?.length ? (
          <div className="py-1">
            {items.map((item, index) => {
              if (item.divider) {
                return <hr key={index} className="my-1 border-gray-200 dark:border-gray-700" />
              }
              
              return (
                <button
                  key={index}
                  onClick={item.nativeClick ? () => { item.onClick?.(); setIsOpen(false) } : undefined}
                  onMouseDown={item.nativeClick ? undefined : (e) => {
                    // Fire action early to avoid losing click due to focus/blur
                    e.preventDefault()
                    item.onClick?.()
                    setIsOpen(false)
                  }}
                  disabled={item.disabled}
                  className={`
                    group flex w-full cursor-pointer items-center px-4 py-2 text-sm transition-colors duration-150
                    ${item.disabled
                      ? 'cursor-not-allowed text-gray-400 dark:text-gray-500'
                      : item.danger
                        ? 'text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50'
                    }
                  `}
                >
                  {item.icon && (
                    <item.icon
                      className={`mr-3 h-4 w-4 transition-colors duration-150 ${
                        item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    />
                  )}
                  {item.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}