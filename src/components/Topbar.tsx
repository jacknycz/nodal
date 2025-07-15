import React from 'react'
import ThemeToggle from './ThemeToggle'
import AvatarMenu from './AvatarMenu'
import { useTheme } from '../contexts/ThemeContext'
import nodalBlackLogo from '../assets/nodal-black.svg'
import nodalWhiteLogo from '../assets/nodal-white.svg'
import { TestTube, ArrowLeft, Settings as SettingsIcon } from 'lucide-react'
import type { SavedBoard } from '../features/storage/storage'
import { useAISettingsStore } from '../features/ai/aiSettingsSlice'

const MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
]

const POSITION_STRATEGIES = [
  { value: 'center', label: 'Center' },
  { value: 'circular', label: 'Circular' },
  { value: 'grid', label: 'Grid' },
  { value: 'connected', label: 'Connected' }
]

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

interface TopbarProps {
  currentBoardName?: string
  saveStatus?: SaveStatus
  hasUnsavedChanges?: boolean
  isTestMode?: boolean
  onToggleTestMode?: () => void
  onSaveBoard?: () => void
  onOpenBoardRoom?: () => void
  onExportBoard?: () => void
  onImportBoard?: () => void
  onOpenSettings?: () => void
  onLoadBoard?: (board: SavedBoard) => void
}

export default function Topbar({ 
  currentBoardName, 
  saveStatus = 'saved', 
  hasUnsavedChanges = false,
  isTestMode = false,
  onToggleTestMode,
  onSaveBoard,
  onOpenBoardRoom,
  onExportBoard,
  onImportBoard,
  onOpenSettings,
  onLoadBoard
}: TopbarProps) {
  const { isDark } = useTheme()
  const [showSettings, setShowSettings] = React.useState(false)
  const settingsRef = React.useRef<HTMLDivElement>(null)
  const { model, setModel, positionStrategy, setPositionStrategy, temperature, setTemperature } = useAISettingsStore()

  // Close menu on outside click
  React.useEffect(() => {
    if (!showSettings) return
    function handle(e: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [showSettings])

  return (
    <header className="absolute top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between px-6 py-3">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <img
            src={isDark ? nodalWhiteLogo : nodalBlackLogo}
            alt="Nodal Logo"
            className="h-8 w-auto"
          />
        </div>

        {/* Center - Board Info */}
        {currentBoardName && (
          <div className="flex items-center gap-3">
            <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium text-gray-900 dark:text-white" title={currentBoardName}>
                {currentBoardName}
              </span>
            </div>
            
            {/* Save Status */}
            <div className="flex items-center text-xs">
              {saveStatus === 'saving' && (
                <div className="flex items-center text-blue-600 dark:text-blue-400">
                  <div className="w-2 h-2 mr-2 bg-blue-600 rounded-full animate-pulse"></div>
                  <span>Saving...</span>
                </div>
              )}
              {saveStatus === 'saved' && !hasUnsavedChanges && (
                <div className="flex items-center text-green-600 dark:text-green-400">
                  <div className="w-2 h-2 mr-2 bg-green-600 rounded-full"></div>
                  <span>Saved</span>
                </div>
              )}
              {saveStatus === 'unsaved' && hasUnsavedChanges && (
                <div className="flex items-center text-orange-600 dark:text-orange-400">
                  <div className="w-2 h-2 mr-2 bg-orange-600 rounded-full"></div>
                  <span>Unsaved changes</span>
                </div>
              )}
              {saveStatus === 'error' && (
                <div className="flex items-center text-red-600 dark:text-red-400">
                  <div className="w-2 h-2 mr-2 bg-red-600 rounded-full"></div>
                  <span>Save failed</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Right - Controls */}
        <div className="flex items-center gap-3">
          <div className="relative" ref={settingsRef}>
            <button
              className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onMouseEnter={() => setShowSettings(true)}
              onMouseLeave={() => setTimeout(() => setShowSettings(false), 200)}
              aria-label="AI Settings"
            >
              <SettingsIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>
            {showSettings && (
              <div
                className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50"
                onMouseEnter={() => setShowSettings(true)}
                onMouseLeave={() => setShowSettings(false)}
              >
                <div className="mb-3 font-semibold text-gray-800 dark:text-gray-100 text-sm">AI Settings</div>
                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">Model</label>
                  <select
                    className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                    value={model}
                    onChange={e => setModel(e.target.value as any)}
                  >
                    {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">Position Strategy</label>
                  <select
                    className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
                    value={positionStrategy}
                    onChange={e => setPositionStrategy(e.target.value)}
                  >
                    {POSITION_STRATEGIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
                <div className="mb-1">
                  <label className="block text-xs font-medium mb-1 text-gray-600 dark:text-gray-300">Creativity (Temperature: {temperature})</label>
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
                    onClick={onToggleTestMode}
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
          <ThemeToggle />
          
          <AvatarMenu
            currentBoardName={currentBoardName}
            saveStatus={saveStatus}
            hasUnsavedChanges={hasUnsavedChanges}
            onSaveBoard={onSaveBoard}
            onOpenBoardRoom={onOpenBoardRoom}
            onExportBoard={onExportBoard}
            onImportBoard={onImportBoard}
            onOpenSettings={onOpenSettings}
            onLoadBoard={onLoadBoard}
          />
        </div>
      </div>
    </header>
  )
}
