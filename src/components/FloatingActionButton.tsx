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
  const [mainButtonPressed, setMainButtonPressed] = useState(false)

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
      color: 'bg-primary-500 hover:bg-primary-600',
    },
    {
      id: 'ai-generate',
      icon: <Sparkles className="w-5 h-5" />,
      label: 'AI Generate',
      onClick: () => {
        onOpenAIGenerator?.()
        setIsExpanded(false)
      },
      color: 'bg-tertiary-500 hover:bg-tertiary-600',
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

  // Handle main button press animation
  const handleMainButtonPress = () => {
    setMainButtonPressed(true)
    setIsExpanded(!isExpanded)
    setTimeout(() => setMainButtonPressed(false), 150)
  }

  // Don't render during SSR
  if (!isMounted) return null

  return (
    <>
      {/* Custom styles for animations */}
      <style>{`
        @keyframes fabSlideIn {
          0% {
            opacity: 0;
            transform: translateY(20px) scale(0.8);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        @keyframes fabSlideOut {
          0% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(20px) scale(0.8);
          }
        }
        
        @keyframes fabBounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }
        
        @keyframes fabPulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        
        .fab-action-enter {
          opacity: 0;
          transform: translateY(20px) scale(0.8);
          animation: fabSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        
        .fab-action-exit {
          opacity: 1;
          transform: translateY(0) scale(1);
          animation: fabSlideOut 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
        }
        
        .fab-main-pressed {
          animation: fabPulse 0.15s ease-out;
        }
        
        .fab-hint {
          animation: fabBounce 2s ease-in-out infinite;
        }
      `}</style>

      <div className={`fixed bottom-4 left-16 z-40 ${className}`}>
        {/* Smooth backdrop */}
        {isExpanded && (
          <div
            className="fixed inset-0 bg-black/5 backdrop-blur-[1px] z-[-1] transition-all duration-300 ease-out"
            style={{ animation: 'fadeIn 0.3s ease-out' }}
            onClick={() => setIsExpanded(false)}
          />
        )}

        {/* Expanded Actions */}
        <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 mb-2">
          <div className="flex flex-col-reverse space-y-reverse space-y-3">
            {actions.map((action, index) => (
              <div
                key={action.id}
                className={`flex items-center space-x-3 ${
                  isExpanded ? 'fab-action-enter' : 'fab-action-exit'
                }`}
                style={{ 
                  animationDelay: `${index * 80}ms`,
                  visibility: isExpanded ? 'visible' : 'hidden'
                }}
              >
                {/* Label with smooth appearance */}
                <div className={`
                  bg-black/80 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg
                  transition-all duration-300 ease-out
                  ${isExpanded ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform translate-x-2'}
                `}>
                  {action.label}
                </div>
                
                {/* Action Button with hover effects */}
                <button
                  onClick={action.onClick}
                  disabled={action.disabled}
                  className={`
                    w-12 h-12 rounded-full ${action.color} text-white shadow-lg 
                    transition-all duration-200 ease-out transform 
                    hover:shadow-xl hover:scale-110 active:scale-95
                    disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
                    ${action.destructive ? 'ring-2 ring-red-200 dark:ring-red-800' : ''}
                    flex items-center justify-center
                    hover:rotate-12 active:rotate-0
                  `}
                  style={{
                    transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                  }}
                  title={action.label}
                >
                  {action.icon}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Main FAB Button with enhanced animations */}
        <button
          onClick={handleMainButtonPress}
          className={`
            w-14 h-14 rounded-full bg-primary-500 text-white 
            shadow-lg hover:shadow-xl transition-all duration-300 transform
            hover:scale-105 active:scale-95
            focus:outline-none focus:ring-4 focus:ring-primary-200 dark:focus:ring-primary-800
            ${isExpanded ? 'rotate-45 scale-110' : ''}
            ${mainButtonPressed ? 'fab-main-pressed' : ''}
          `}
          style={{
            transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
            transformOrigin: 'center'
          }}
          title={isExpanded ? 'Close actions' : 'Open actions'}
        >
          <Plus className="w-6 h-6 mx-auto transition-transform duration-300" />
        </button>

        {/* Animated hint for first-time users */}
        {!isExpanded && (
          <div className="absolute -top-2 -right-2 w-3 h-3 bg-primary-400 rounded-full fab-hint" />
        )}
      </div>
    </>
  )
} 