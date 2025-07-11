import React, { useState, useEffect } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'

interface FABAction {
  id: string
  icon: React.ReactNode
  label: string
  onClick: () => void
  color: string
  disabled?: boolean
  destructive?: boolean
}

interface FloatingActionButtonProps {
  onAddNode?: () => void
  onOpenAIGenerator?: () => void
  onClearBoard?: () => void
  hasNodes?: boolean
  className?: string
}

export default function FloatingActionButton({
  onAddNode,
  onOpenAIGenerator,
  onClearBoard,
  hasNodes = false,
  className = ''
}: FloatingActionButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const actions: FABAction[] = [
    {
      id: 'add-node',
      icon: <Plus className="w-5 h-5" />,
      label: 'Add Node',
      onClick: () => {
        onAddNode?.()
        setIsExpanded(false)
      },
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      id: 'ai-generate',
      icon: <Sparkles className="w-5 h-5" />,
      label: 'AI Generate',
      onClick: () => {
        onOpenAIGenerator?.()
        setIsExpanded(false)
      },
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      id: 'clear-board',
      icon: <Trash2 className="w-5 h-5" />,
      label: 'Clear Board',
      onClick: () => {
        if (hasNodes && confirm('Are you sure you want to clear all nodes from the board?')) {
          onClearBoard?.()
        }
        setIsExpanded(false)
      },
      color: 'bg-red-500 hover:bg-red-600',
      disabled: !hasNodes,
      destructive: true,
    },
  ]

  // Handle escape key to close
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isExpanded) {
        setIsExpanded(false)
      }
    }

    document.addEventListener('keydown', handleEscKey)
    return () => document.removeEventListener('keydown', handleEscKey)
  }, [isExpanded])

  // Don't render during SSR
  if (!isMounted) return null

  return (
    <div className={`fixed bottom-4 left-16 z-40 ${className}`}>
      {/* Backdrop */}
      {isExpanded && (
        <div
          className="fixed inset-0 bg-black/5 backdrop-blur-[1px] z-[-1]"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Expanded Actions */}
      {isExpanded && (
        <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 mb-2">
          <div className="flex flex-col-reverse space-y-reverse space-y-3">
            {actions.map((action, index) => (
              <div
                key={action.id}
                className={`flex items-center space-x-3 transition-all duration-200 ${
                  isExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
                style={{ 
                  transitionDelay: `${index * 50}ms`,
                  animationDelay: `${index * 50}ms`
                }}
              >
                {/* Label */}
                <div className="bg-black/80 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
                  {action.label}
                </div>
                
                {/* Action Button */}
                <button
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`
                    w-12 h-12 rounded-full ${action.color} text-white shadow-lg 
                    hover:shadow-xl transition-all duration-200 transform hover:scale-110
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                    ${action.destructive ? 'ring-2 ring-red-200 dark:ring-red-800' : ''}
                  `}
                  title={action.label}
                >
                  {action.icon}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main FAB Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`
          w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white 
          shadow-lg hover:shadow-xl transition-all duration-300 transform
          ${isExpanded ? 'rotate-45 scale-110' : 'hover:scale-105'}
          focus:outline-none focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-800
        `}
        title={isExpanded ? 'Close actions' : 'Open actions'}
      >
        <Plus className="w-6 h-6 mx-auto" />
      </button>

      {/* Floating hint for first-time users */}
      {!isExpanded && (
        <div className="absolute -top-2 -right-2 w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
      )}
    </div>
  )
} 