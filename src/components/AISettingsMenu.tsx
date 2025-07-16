import React, { useState, useRef, useEffect } from 'react'
import { Settings, ArrowLeft, TestTube } from 'lucide-react'
import { useAISettingsStore } from '../features/ai/aiSettingsSlice'
import { IconButton } from 'pres-start-core'

interface AISettingsMenuProps {
  isTestMode?: boolean
  onToggleTestMode?: () => void
  className?: string
}

const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Faster)' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
]

const POSITION_STRATEGIES = [
  { value: 'smart', label: 'Smart (Recommended)' },
  { value: 'radial', label: 'Radial' },
  { value: 'grid', label: 'Grid' },
  { value: 'manual', label: 'Manual' },
]

export default function AISettingsMenu({
  isTestMode = false,
  onToggleTestMode,
  className = ''
}: AISettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const { model, setModel, positionStrategy, setPositionStrategy, temperature, setTemperature } = useAISettingsStore()

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false)
    }, 200)
  }

  const handleToggleTestMode = () => {
    onToggleTestMode?.()
    setIsOpen(false)
  }

  return (
    <div
      ref={menuRef}
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Settings Button */}
      <IconButton
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="AI Settings"
        shape="circle"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="size-6 text-gray-600 dark:text-gray-300">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
        </svg>

      </IconButton>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
          <div className="mb-3 font-semibold text-gray-800 dark:text-gray-100 text-sm">AI Settings</div>

          <div className="mb-3">
            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">Model</label>
            <select
              className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              value={model}
              onChange={e => setModel(e.target.value as any)}
            >
              {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          <div className="mb-3">
            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">Position Strategy</label>
            <select
              className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              value={positionStrategy}
              onChange={e => setPositionStrategy(e.target.value)}
            >
              {POSITION_STRATEGIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          <div className="mb-1">
            <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">
              Creativity (Temperature: {temperature})
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Focused</span>
              <span>Creative</span>
            </div>
          </div>

          {onToggleTestMode && (
            <button
              onClick={handleToggleTestMode}
              className="flex items-center gap-2 w-full mt-4 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={isTestMode ? "Exit Test Mode" : "Enter Test Mode"}
            >
              {isTestMode ? (
                <>
                  <ArrowLeft className="w-4 h-4" />
                  <span>Exit Test</span>
                </>
              ) : (
                <>
                  <TestTube className="w-4 h-4" />
                  <span>Test Mode</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
} 