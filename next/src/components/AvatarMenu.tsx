'use client'

import { useState, useEffect } from 'react'
import { User, GearSix, SquaresFour, SignOut } from '@phosphor-icons/react/dist/ssr'
import type { SavedBoard } from '../features/storage/storage'
import { signOut, useSupabaseUser } from '../features/auth/authUtils'
import { getUserRoleFromMetadata, isAdmin } from '../features/auth/roles'
import TemplatePickerModal from './TemplatePickerModal'
import { templateStorage } from '../features/storage/templateStorage'
import { boardStorage } from '../features/storage/storage'
import ThemeToggle from './ThemeToggle'
import Image from 'next/image'
import Menu from './ui/Menu'
import IconButton from './ui/IconButton'

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
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)

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

  const roleLabel = getUserRoleFromMetadata(user)
  const admin = isAdmin(user)

  // Get user avatar
  const getUserAvatar = () => {
    if (!user) return null
    
    if (user.user_metadata?.avatar_url) return user.user_metadata.avatar_url
    if (user.user_metadata?.picture) return user.user_metadata.picture
    
    return null
  }

  return (
    <>
    <Menu
      className="z-[500]"
      trigger={
        <IconButton
          aria-label="User menu"
          className="p-0!"
        >
          {getUserAvatar() ? (
            <Image 
              src={getUserAvatar()}
              alt={getUserDisplayName()}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
              unoptimized
            />
          ) : (
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <User size={32} weight="duotone" />
            </div>
          )}
        </IconButton>
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
                  {roleLabel} • {user?.email || 'user'}
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
              className="cursor-pointer w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
            >
              <SquaresFour size={24} weight="duotone" className="text-gray-600 dark:text-gray-400 w-4 h-4" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">Board Room</span>
            </button>
          )}

        

          {/* Separator - Only show when we have content above and below
          {isBoardView && (
            <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
          )} */}

          {/* Settings
          <button
            onClick={onOpenSettings}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
          >
            <GearSix size={24} weight="duotone" className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-900 dark:text-white">Settings</span>
          </button> */}

          {/* Admin: Templates */}
          {admin && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Templates (Admin)</div>
              <div className="flex gap-2">
                <button
                  className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                  onClick={async () => {
                    try {
                      const name = window.prompt('Template name?')?.trim()
                      if (!name) return
                      // Build board data from store
                      const state = (await import('../features/board/boardSlice')).useBoardStore.getState()
                      const boardNodes = state.nodes || []
                      const boardEdges = state.edges || []
                      const data = {
                        nodes: boardNodes,
                        edges: boardEdges,
                        viewport: { x: 0, y: 0, zoom: 1 },
                        topic: state.currentBoardName || undefined
                      }
                      await templateStorage.saveTemplate(name, data as any)
                      alert('Template saved')
                    } catch (e) {
                      alert('Failed to save template')
                    }
                  }}
                >
                  Save as new template
                </button>
              </div>
            </div>
          )}

          {/* Theme Toggle */}
          <div className="px-4 py-2">
            <ThemeToggle />
          </div>

          {/* Help & Support
          <button
            onClick={() => window.open('https://help.nodal.app', '_blank')}
            className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3"
          >
            <HelpCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <span className="text-sm text-gray-900 dark:text-white">Help & Support</span>
          </button> */}

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
            className="cursor-pointer w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center space-x-3 text-red-600 dark:text-red-400"
          >
            <SignOut size={24} weight="duotone" className="text-gray-600 dark:text-gray-400 w-4 h-4" />
            <span className="text-sm">Sign Out</span>
          </button>
        </div>
      }
      className={className}
    />
    {showTemplatePicker && (
      <TemplatePickerModal
        open={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onUseTemplate={async (tpl) => {
          try {
            const newName = `${tpl.name} (copy)`
            const id = await boardStorage.saveBoard(newName, tpl.data)
            setShowTemplatePicker(false)
            if (typeof window !== 'undefined') {
              window.location.href = `/board/${id}`
            }
          } catch (e) {
            alert('Failed to create board from template')
          }
        }}
      />
    )}
    </>
  )
}