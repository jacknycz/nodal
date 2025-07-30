import { 
  User, 
  Settings, 
  Save, 
  Building, 
  HelpCircle, 
  LogOut,
  ChevronDown,
  Clock,
  FileText
} from 'lucide-react'
import type { SavedBoard } from '../features/storage/storage'
import { signOut, useSupabaseUser } from '../features/auth/authUtils'
import { useState, useRef, useEffect } from 'react'

interface AvatarMenuProps {
  currentBoardName?: string
  saveStatus?: 'saved' | 'saving' | 'unsaved' | 'error'
  hasUnsavedChanges?: boolean
  onSaveBoard?: () => void
  onOpenBoardRoom?: () => void
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
  onOpenSettings,
  onLoadBoard,
  className = ''
}: AvatarMenuProps) {
  const user = useSupabaseUser()
  const [isOpen, setIsOpen] = useState(false)
  const [submenu, setSubmenu] = useState<null | 'recentBoards'>(null);
  const [recentBoards, setRecentBoards] = useState<SavedBoard[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSubmenu(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Load recent boards when submenu opens
  useEffect(() => {
    if (submenu === 'recentBoards') {
      loadRecentBoards();
    }
  }, [submenu]);

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

  const handleOpenSettings = () => {
    onOpenSettings?.()
    setIsOpen(false)
  }

  const handleLoadBoard = (board: SavedBoard) => {
    onLoadBoard?.(board)
    setIsOpen(false)
    setSubmenu(null)
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

  // Get user display name
  const getUserDisplayName = () => {
    if (!user) return 'User'
    
    // Try to get the best available name
    if (user.user_metadata?.full_name) {
      return user.user_metadata.full_name
    }
    if (user.user_metadata?.name) {
      return user.user_metadata.name
    }
    if (user.email) {
      return user.email.split('@')[0] // Just the username part
    }
    
    return 'User'
  }

  // Get user avatar
  const getUserAvatar = () => {
    if (!user) return null
    
    // Try to get avatar from Google OAuth metadata
    if (user.user_metadata?.avatar_url) {
      return user.user_metadata.avatar_url
    }
    if (user.user_metadata?.picture) {
      return user.user_metadata.picture
    }
    
    return null
  }

  // Clean hover/focus logic, no timeouts
  const handleMouseEnter = () => {
    setIsOpen(true);
  };
  const handleMouseLeave = () => {
    setIsOpen(false);
    setSubmenu(null);
  };
  const handleFocus = () => setIsOpen(true);
  const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsOpen(false);
      setSubmenu(null);
    }
  };

  return (
    <div
      ref={menuRef}
      className={`relative ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={0}
    >
      {/* Avatar Button */}
      <button
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center h-10 w-10"
        aria-label="User menu"
        tabIndex={-1}
        style={{ minWidth: '40px', minHeight: '40px' }}
      >
        {getUserAvatar() ? (
          <img 
            src={getUserAvatar()} 
            alt={getUserDisplayName()}
            className="w-6 h-6 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
          />
        ) : (
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
        )}
      </button>
      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              {getUserAvatar() ? (
                <img 
                  src={getUserAvatar()} 
                  alt={getUserDisplayName()}
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {getUserDisplayName()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  Signed in as {user?.email || 'user'}
                </p>
              </div>
            </div>
          </div>

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
          {/* <button
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
          </button> */}

          {/* Board Room with Recent Boards */}
          <div className="relative">
            <button
              onClick={() => setSubmenu(submenu === 'recentBoards' ? null : 'recentBoards')}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-between"
              type="button"
            >
              <div className="flex items-center space-x-3">
                <Building className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">Board Room</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${submenu === 'recentBoards' ? 'rotate-180' : ''}`} />
            </button>
            {/* Recent Boards Submenu */}
            {submenu === 'recentBoards' && (
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
                        View All Boards 
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
            onClick={async () => {
              try {
                await signOut();
                window.location.reload(); // Or redirect to login page if you have one
              } catch (err) {
                alert('Sign out failed: ' + (err instanceof Error ? err.message : err));
              }
            }}
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