import React from 'react'
import ThemeToggle from './ThemeToggle'
import { useTheme } from '../contexts/ThemeContext'
import nodalBlackLogo from '../assets/nodal-black.svg'
import nodalWhiteLogo from '../assets/nodal-white.svg'
import { TestTube, ArrowLeft } from 'lucide-react'

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error'

interface TopbarProps {
  currentBoardName?: string
  saveStatus?: SaveStatus
  hasUnsavedChanges?: boolean
  isTestMode?: boolean
  onToggleTestMode?: () => void
}

export default function Topbar({ 
  currentBoardName, 
  saveStatus = 'saved', 
  hasUnsavedChanges = false,
  isTestMode = false,
  onToggleTestMode
}: TopbarProps) {
  const { isDark } = useTheme()

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
          {onToggleTestMode && (
            <button
              onClick={onToggleTestMode}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
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
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
