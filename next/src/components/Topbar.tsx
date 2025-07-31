'use client'
import { useTheme } from '../contexts/ThemeContext'
import type { SavedBoard } from '../features/storage/storage'
import AvatarMenu from './AvatarMenu'
import AISettingsMenu from './AISettingsMenu'
import DocumentsMenu from './DocumentsMenu'
import React, { useState, useRef, useEffect } from 'react'
import { useBoardStore } from '../features/board/boardSlice';
import { House } from 'lucide-react';
import Image from 'next/image';

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
  isBoardView?: boolean;
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
  onLoadBoard,
  isBoardView = false
}: TopbarProps) {
  const { isDark } = useTheme()
  const [showFeedback, setShowFeedback] = useState(false)
  const setTopbarHeight = useBoardStore(state => state.setTopbarHeight);
  const headerRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    if (headerRef.current) {
      const height = headerRef.current.getBoundingClientRect().height;
      setTopbarHeight(height);
    }
  }, [setTopbarHeight]);

  return (
    <>
      <header ref={headerRef} className="absolute top-0 left-0 right-0 z-[60] bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-3 items-center px-4 py-1">
          {/* Left - Logo */}
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenBoardRoom}
              className={`focus:outline-none flex cursor-pointer flex items-center gap-2 rounded-full p-1 ${
                isBoardView 
                  ? 'text-gray-900 dark:text-white' 
                  : 'bg-primary-500 text-white dark:bg-primary-500'
              }`}
              aria-label="Go to Board Room"
            >
              <House size={16} />
            </button>

            <button
              onClick={onOpenBoardRoom}
              className="focus:outline-none cursor-pointer flex items-center gap-2"
              aria-label="Go to Board Room"
            >
              <Image
                src={isDark ? "/nodal-white.svg" : "/nodal-black.svg"}
                alt="Nodal Logo"
                width={48}
                height={48}
                className="h-8 w-auto"
                // style={{ width: 'auto', height: 'auto' }}
                priority
              />
            </button>

            <button className="text-xs rounded text-gray-600 dark:text-white border border-red-500 p-1 ml-4" onClick={() => setShowFeedback(true)}>
              FEEDBACK
            </button>
          </div>

          {/* Center - Board Info (truly centered) */}
          <div className="flex justify-center">
            {isBoardView && currentBoardName && (
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
                <div className="flex items-center gap-2 text-xs">
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
                  
                  {/* Manual Save Button */}
                  {hasUnsavedChanges && onSaveBoard && (
                    <button
                      onClick={onSaveBoard}
                      disabled={saveStatus === 'saving'}
                      className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Save
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right - Controls */}
          <div className="flex items-center gap-3 justify-end">
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
              isBoardView={isBoardView}
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
            <iframe src="https://docs.google.com/forms/d/e/1FAIpQLSeOKZuFWTCDymdFLYA1ChDqerRfoV3ozH_5BDR1cmVizH_uNA/viewform?embedded=true" width="100%" height="600" frameBorder={0} marginHeight={0} marginWidth={0} title="Feedback Form">Loading…</iframe>
          </div>
        </div>
      )}
    </>
  )
} 