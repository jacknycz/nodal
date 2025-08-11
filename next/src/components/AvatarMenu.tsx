'use client'

import { useState, useEffect } from 'react'
import { 
  User, 
  Settings, 
  Building, 
  HelpCircle, 
  LogOut,
  Clock
} from 'lucide-react'
import type { SavedBoard } from '../features/storage/storage'
import { signOut, useSupabaseUser } from '../features/auth/authUtils'
import ThemeToggle from './ThemeToggle'
import Image from 'next/image'
import Menu from './ui/Menu'

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
  isBoardView?: boolean
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
  className = '', 
  isBoardView = false
}: AvatarMenuProps) {
  const user = useSupabaseUser()
  const [recentBoards, setRecentBoards] = useState<SavedBoard[]>([])
  const [pendingInvites, setPendingInvites] = useState<any[]>([])

  // Load recent boards when menu opens
  const loadRecentBoards = async () => {
    try {
      const { boardStorage } = await import('../features/storage/storage')
      const allBoards = await boardStorage.getAllBoards()
      const recent = allBoards
        .sort((a, b) => b.lastModified - a.lastModified)
        .slice(0, 3) // Only show last 3 boards
      setRecentBoards(recent)
    } catch {
      // Silently ignore
    }
  }

  // Fetch pending invitations for the current user
  useEffect(() => {
    const fetchInvites = async () => {
      if (!user?.email) return
      try {
        const res = await fetch(`/api/board/invitations?email=${encodeURIComponent(user.email)}`)
        const json = await res.json()
        setPendingInvites(Array.isArray(json.invitations) ? json.invitations : [])
      } catch (e) {
        setPendingInvites([])
      }
    }
    fetchInvites()
  }, [user?.email])

  // Accept invitation handler
  const handleAcceptInvite = async (inviteId: string) => {
    try {
      const res = await fetch('/api/board/invitations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: inviteId, status: 'accepted' })
      })
      if (res.ok) {
        setPendingInvites(invites => invites.filter(inv => inv.id !== inviteId))
      } else {
        alert('Failed to accept invitation')
      }
    } catch (e) {
      alert('Failed to accept invitation')
    }
  }

  // Get user display name
  const getUserDisplayName = () => {
    if (!user) return 'User'
    
    if (user.user_metadata?.full_name) return user.user_metadata.full_name
    if (user.user_metadata?.name) return user.user_metadata.name
    if (user.email) return user.email.split('@')[0]
    
    return 'User'
  }

  // Get user avatar
  const getUserAvatar = () => {
    if (!user) return null
    
    if (user.user_metadata?.avatar_url) return user.user_metadata.avatar_url
    if (user.user_metadata?.picture) return user.user_metadata.picture
    
    return null
  }

  return (
    <Menu
      trigger={
        <button
          className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center h-10 w-10 relative"
          aria-label="User menu"
          style={{ minWidth: '40px', minHeight: '40px' }}
        >
          {getUserAvatar() ? (
            <Image 
              src={getUserAvatar()}
              alt={getUserDisplayName()}
              width={24}
              height={24}
              className="w-6 h-6 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
              unoptimized
            />
          ) : (
            <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
          )}
        </button>
      }
      showNotification={pendingInvites.length > 0}
      width="w-64"
      customContent={
        <div>
          {/* User Info */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              {getUserAvatar() ? (
                <Image 
                  src={getUserAvatar()}
                  alt={getUserDisplayName()}
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                  unoptimized
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

          {/* Pending Invitations */}
          {pendingInvites.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <div className="font-semibold text-xs text-gray-500 dark:text-gray-400 mb-1">Pending Invitations</div>
              <ul className="space-y-1">
                {pendingInvites.map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between text-xs text-gray-700 dark:text-gray-200">
                    <span>
                      Board: {invite.board_id.slice(0, 8)}...<br/>
                      Invited by: {invite.invited_by?.slice?.(0, 8) || 'unknown'}
                    </span>
                    <button className="ml-2 px-2 py-0.5 bg-blue-500 text-white rounded text-xs" onClick={() => handleAcceptInvite(invite.id)}>
                      Accept
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Board Room Link - Only show when NOT on BoardRoom page */}
          {isBoardView && (
            <button
              onClick={onOpenBoardRoom}
              className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
            >
              <Building className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Board Room</span>
            </button>
          )}

          {/* Recent Boards Section - Only show when NOT on BoardRoom page */}
          {isBoardView && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2 mb-2">
                <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Recent boards</span>
              </div>
              {recentBoards.length > 0 ? (
                <div className="space-y-1">
                  {recentBoards.map((board) => (
                    <button
                      key={board.id}
                      onClick={() => onLoadBoard?.(board)}
                      className="w-full px-2 py-1 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {board.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(board.lastModified).toLocaleDateString()}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">No recent boards</p>
                  <button
                    onClick={onOpenBoardRoom}
                    className="mt-1 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"
                  >
                    Create your first board
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Separator - Only show when we have content above and below */}
          {isBoardView && (
            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
          )}

          {/* Settings */}
          <button
            onClick={onOpenSettings}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
          >
            <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-900 dark:text-white">Settings</span>
          </button>

          {/* Theme Toggle */}
          <div className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700">
            <ThemeToggle />
          </div>

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
                window.location.reload();
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
      }
      className={className}
    />
  )
}