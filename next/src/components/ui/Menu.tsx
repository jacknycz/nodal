'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

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
  portal?: boolean
  placement?: 'below' | 'above'
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
  openOnHover = false,
  portal = false,
  placement = 'below'
}: MenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const portalRef = useRef<HTMLDivElement>(null)
  const [portalPos, setPortalPos] = useState<{ left: number; top: number } | null>(null)
  // Re-clamp portal position after open to avoid covering trigger and keep within viewport
  useEffect(() => {
    if (!isOpen || !portal || !portalRef.current || !menuRef.current || !portalPos) return
    const raf = requestAnimationFrame(() => {
      try {
        const menuRect = portalRef.current!.getBoundingClientRect()
        const triggerRect = menuRef.current!.getBoundingClientRect()
        const margin = 8
        let baseLeft = align === 'right' ? triggerRect.right : triggerRect.left
        let baseTop = placement === 'above' ? (triggerRect.top - 8) : (triggerRect.bottom + 8)
        // Effective position after transforms
        let effLeft = baseLeft + (align === 'right' ? -menuRect.width : 0)
        let effTop = baseTop + (placement === 'above' ? -menuRect.height : 0)
        // Clamp to viewport
        effLeft = Math.max(margin, Math.min(effLeft, window.innerWidth - margin - menuRect.width))
        effTop = Math.max(margin, Math.min(effTop, window.innerHeight - margin - menuRect.height))
        // Recompute base positions to keep current transform model
        baseLeft = effLeft + (align === 'right' ? menuRect.width : 0)
        baseTop = effTop + (placement === 'above' ? menuRect.height : 0)
        setPortalPos({ left: baseLeft, top: baseTop })
      } catch {}
    })
    return () => cancelAnimationFrame(raf)
  }, [isOpen, portal, align, placement, portalPos])

  useEffect(() => {
    const handlePointerDownOutside = (event: Event) => {
      const target = event.target as Node
      const inTrigger = !!(menuRef.current && menuRef.current.contains(target))
      const inPortal = !!(portalRef.current && portalRef.current.contains(target))
      if (!inTrigger && !inPortal) {
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
    if (portal && menuRef.current) {
      try {
        const rect = menuRef.current.getBoundingClientRect()
        const top = placement === 'above' ? (rect.top - 8) : (rect.bottom + 8)
        const left = align === 'right' ? rect.right : rect.left
        setPortalPos({ left, top })
      } catch {}
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

  // Compute first/last actionable (non-divider) item indexes for rounded corners
  const nonDividerIndexes = (items || []).map((it, i) => (!it.divider ? i : -1)).filter(i => i >= 0)
  const firstIdx = nonDividerIndexes.length > 0 ? nonDividerIndexes[0] : -1
  const lastIdx = nonDividerIndexes.length > 0 ? nonDividerIndexes[nonDividerIndexes.length - 1] : -1

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
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setIsOpen((prev) => {
            const next = !prev
            if (!prev) openMenu()
            return next
          })
        }}
        onClick={(e) => {
          // Prevent parent click handlers (e.g., card onClick) from firing
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        {trigger}
      </div>

      {/* Dropdown */}
      {portal && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={portalRef}
              onMouseEnter={openOnHover ? () => { cancelClose(); setIsOpen(true) } : undefined}
              onMouseLeave={openOnHover ? () => closeMenuWithDelay(150) : undefined}
              className={`fixed z-[1200] ${width || 'w-56'} rounded-2xl overflow-hidden 
                bg-[linear-gradient(165deg,rgba(241,245,249,1)_0%,rgba(255,255,255,1)_20%,rgba(255,255,255,1)_80%,rgba(241,245,249,1)_100%)]
                dark:bg-gradient-to-br dark:from-gray-900 dark:via-gray-800 dark:to-gray-950
                shadow-lg shadow-gray-400/20 dark:shadow-none focus:outline-none
                transition-opacity duration-150 ease-out
                ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
              `}
              style={{
                left: portalPos ? portalPos.left : 0,
                top: portalPos ? portalPos.top : 0,
                transform: [
                  (align === 'right') ? 'translateX(-100%)' : '',
                  (placement === 'above') ? 'translateY(-100%)' : ''
                ].filter(Boolean).join(' ')
              }}
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
                          e.preventDefault()
                          item.onClick?.()
                          setIsOpen(false)
                        }}
                        disabled={item.disabled}
                        className={`
                          group flex w-full cursor-pointer items-center px-4 py-2 text-sm transition-colors duration-150
                          ${index === firstIdx ? 'rounded-t-2xl' : ''}
                          ${index === lastIdx ? 'rounded-b-2xl' : ''}
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
            </div>,
            document.body
          )
        : (
            <div
              onMouseEnter={openOnHover ? () => { cancelClose(); setIsOpen(true) } : undefined}
              onMouseLeave={openOnHover ? () => closeMenuWithDelay(150) : undefined}
              className={`
                ${fixedCenterAbove ? 'fixed left-1/2 bottom-16 transform -translate-x-1/2 z-[1200]' : placement === 'above' ? 'absolute bottom-full mb-1 z-[1200]' : 'absolute top-full mt-1 z-[1200]'} ${width || 'w-56'} rounded-2xl overflow-hidden 
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
                      ${index === firstIdx ? 'rounded-t-2xl' : ''}
                      ${index === lastIdx ? 'rounded-b-2xl' : ''}
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
        )}
    </div>
  )
}