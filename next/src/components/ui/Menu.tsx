'use client'

import React, { useState, useRef, useEffect } from 'react'
import type React from 'react'

export interface MenuItem {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  onClick?: () => void
  disabled?: boolean
  danger?: boolean
  divider?: boolean
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
  , fixedCenterAbove = false
}: MenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleMouseEnter = () => setIsOpen(true)
  const handleMouseLeave = () => setIsOpen(false)
  const handleFocus = () => setIsOpen(true)
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsOpen(false)
    }
  }

  return (
    <div
      ref={menuRef}
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      {/* Trigger */}
      <div className={`relative flex cursor-pointer ${triggerClassName}`}>
        {trigger}
        {showNotification && (
          <span className="absolute top-1 right-1 block w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-gray-800" />
        )}
      </div>

      {/* Dropdown */}
      <div
        className={`
          ${fixedCenterAbove ? 'fixed left-1/2 bottom-24 transform -translate-x-1/2 z-50' : 'absolute z-50'} ${width || 'w-56'} rounded-2xl overflow-hidden 
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
                  onClick={() => {
                    item.onClick?.()
                    setIsOpen(false)
                  }}
                  disabled={item.disabled}
                  className={`
                    group flex w-full items-center px-4 py-2 text-sm transition-colors duration-150
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