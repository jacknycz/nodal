import { useTheme } from '../contexts/ThemeContext'
import nodalBlackLogo from '../assets/nodal-black.svg'
import nodalWhiteLogo from '../assets/nodal-white.svg'
import type { SavedBoard } from '../features/storage/storage'
import AvatarMenu from './AvatarMenu'
import ThemeToggle from './ThemeToggle'
import AISettingsMenu from './AISettingsMenu'
import DocumentsMenu from './DocumentsMenu'
import React, { useState } from 'react'

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
  const [showFeedback, setShowFeedback] = useState(false)

  return (
    <>
      <header className="absolute top-0 left-0 right-0 z-[60] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 items-center px-6 py-3">
          {/* Left - Logo */}
          <div className="flex items-center gap-3">
            <img
              src={isDark ? nodalWhiteLogo : nodalBlackLogo}
              alt="Nodal Logo"
              className="h-8 w-auto"
            />

            <button className="text-sm rounded text-gray-600 dark:text-white border border-red-500 p-2" onClick={() => setShowFeedback(true)}>
              FEEDBACK
            </button>
          </div>

          {/* Center - Board Info (truly centered) */}
          <div className="flex justify-center">
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
          </div>

          {/* Right - Controls */}
          <div className="flex items-center gap-3 justify-end">
            <ThemeToggle />
            <AISettingsMenu 
              isTestMode={isTestMode}
              onToggleTestMode={onToggleTestMode}
            />
            <DocumentsMenu />
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
      {showFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100]">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl relative">
            <button
              onClick={() => setShowFeedback(false)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 dark:hover:text-white text-2xl font-bold"
              aria-label="Close feedback form"
            >
              ×
            </button>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Feedback</h3>
            <iframe src="https://docs.google.com/forms/d/e/1FAIpQLSeOKZuFWTCDymdFLYA1ChDqerRfoV3ozH_5BDR1cmVizH_uNA/viewform?embedded=true" width="100%" height="600" frameBorder="0" marginHeight={0} marginWidth={0} title="Feedback Form">Loading…</iframe>
          </div>
        </div>
      )}
    </>
  )
}
