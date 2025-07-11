import React, { useState, useRef, useEffect } from 'react'
import { 
  User, 
  Settings, 
  Save, 
  Building, 
  Upload, 
  Download, 
  HelpCircle, 
  LogOut,
  ChevronDown,
  Clock,
  FileText
} from 'lucide-react'
import type { SavedBoard } from '../features/storage/storage'

interface AvatarMenuProps {
  currentBoardName?: string
  saveStatus?: 'saved' | 'saving' | 'unsaved' | 'error'
  hasUnsavedChanges?: boolean
  onSaveBoard?: () => void
  onOpenBoardRoom?: () => void
  onExportBoard?: () => void
  onImportBoard?: () => void
  onOpenSettings?: () => void
  onLoadBoard?: (board: SavedBoard) => void
  className?: string
}

export default function AvatarMenu({
  currentBoardName,
  saveStatus = 'saved',
  hasUnsavedChanges = false,
  onSaveBoard,
  onOpenBoardRoom,
  onExportBoard,
  onImportBoard,
  onOpenSettings,
  onLoadBoard,
  className = ''
}: AvatarMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [recentBoards, setRecentBoards] = useState<SavedBoard[]>([])
  const [showRecentBoards, setShowRecentBoards] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowRecentBoards(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load recent boards when menu opens
  useEffect(() => {
    if (isOpen) {
      loadRecentBoards()
    }
  }, [isOpen])

  const loadRecentBoards = async () => {
    try {
      // Load recent boards from storage
      const { boardStorage } = await import('../features/storage/storage')
      const allBoards = await boardStorage.getAllBoards()
      const recent = allBoards
        .sort((a, b) => b.lastModified - a.lastModified)
        .slice(0, 5)
      setRecentBoards(recent)
    } catch (error) {
      console.error('Failed to load recent boards:', error)
    }
  }

  const handleSaveBoard = () => {
    onSaveBoard?.()
    setIsOpen(false)
  }

  const handleOpenBoardRoom = () => {
    onOpenBoardRoom?.()
    setIsOpen(false)
  }

  const handleExportBoard = () => {
    onExportBoard?.()
    setIsOpen(false)
  }

  const handleImportBoard = () => {
    onImportBoard?.()
    setIsOpen(false)
  }

  const handleOpenSettings = () => {
    onOpenSettings?.()
    setIsOpen(false)
  }

  const handleLoadBoard = (board: SavedBoard) => {
    onLoadBoard?.(board)
    setIsOpen(false)
    setShowRecentBoards(false)
  }

  const getSaveStatusIcon = () => {
    switch (saveStatus) {
      case 'saving':
        return <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
      case 'saved':
        return <div className="w-2 h-2 bg-green-500 rounded-full" />
      case 'unsaved':
        return <div className="w-2 h-2 bg-orange-500 rounded-full" />
      case 'error':
        return <div className="w-2 h-2 bg-red-500 rounded-full" />
      default:
        return null
    }
  }

  const getSaveStatusText = () => {
    switch (saveStatus) {
      case 'saving':
        return 'Saving...'
      case 'saved':
        return hasUnsavedChanges ? 'Save Changes' : 'All Saved'
      case 'unsaved':
        return 'Save Changes'
      case 'error':
        return 'Save Failed'
      default:
        return 'Save Board'
    }
  }

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      {/* Avatar Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      >
        <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-white" />
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 top-12 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-50">
          {/* Current Board Info */}
          {currentBoardName && (
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {currentBoardName}
                </span>
              </div>
            </div>
          )}

          {/* Save Board */}
          <button
            onClick={handleSaveBoard}
            disabled={saveStatus === 'saving' || (!hasUnsavedChanges && saveStatus === 'saved')}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center space-x-2">
              <Save className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              {getSaveStatusIcon()}
            </div>
            <span className="text-sm text-gray-900 dark:text-white">
              {getSaveStatusText()}
            </span>
          </button>

          {/* Board Room with Recent Boards */}
          <div className="relative">
            <button
              onClick={() => setShowRecentBoards(!showRecentBoards)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
            >
              <div className="flex items-center space-x-3">
                <Building className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm text-gray-900 dark:text-white">Board Room</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${showRecentBoards ? 'rotate-180' : ''}`} />
            </button>

            {/* Recent Boards Submenu */}
            {showRecentBoards && (
              <div className="absolute right-64 top-0 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2">
                <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Recent Boards</span>
                  </div>
                </div>

                {recentBoards.length > 0 ? (
                  <>
                    {recentBoards.map((board) => (
                      <button
                        key={board.id}
                        onClick={() => handleLoadBoard(board)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {board.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {new Date(board.lastModified).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                    <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                      <button
                        onClick={handleOpenBoardRoom}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-blue-600 dark:text-blue-400 font-medium"
                      >
                        View All Boards →
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">No recent boards</p>
                    <button
                      onClick={handleOpenBoardRoom}
                      className="mt-2 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"
                    >
                      Create your first board
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

          {/* Export Board */}
          <button
            onClick={handleExportBoard}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
          >
            <Upload className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-900 dark:text-white">Export Board</span>
          </button>

          {/* Import Board */}
          <button
            onClick={handleImportBoard}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
          >
            <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-900 dark:text-white">Import Board</span>
          </button>

          {/* Separator */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

          {/* Settings */}
          <button
            onClick={handleOpenSettings}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
          >
            <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-900 dark:text-white">Settings</span>
          </button>

          {/* Help & Support */}
          <button
            onClick={() => window.open('https://help.nodal.app', '_blank')}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
          >
            <HelpCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-900 dark:text-white">Help & Support</span>
          </button>

          {/* Separator */}
          <div className="border-t border-gray-200 dark:border-gray-700 my-2" />

          {/* Sign Out */}
          <button
            onClick={() => alert('Sign out functionality coming soon!')}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 text-red-600 dark:text-red-400"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      )}
    </div>
  )
} 