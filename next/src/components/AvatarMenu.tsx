'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
import { getSupabaseClient } from '../features/auth/supabaseClient'
import { COLORGORY_DEFS } from '../features/board/colorgoryColors'

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
  const [profile, setProfile] = useState<{ username: string | null; avatar_url: string | null } | null>(null)
  const supabase = getSupabaseClient()
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const notifTimerRef = useRef<any>(null)

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

  // Load user profile (avatar_url, username)
  useEffect(() => {
    let active = true
    const run = async () => {
      if (!user?.id) { setProfile(null); return }
      try {
        const { data } = await supabase.from('profiles').select('username, avatar_url').eq('id', user.id).maybeSingle()
        if (!active) return
        const prof = (data as { username: string | null; avatar_url: string | null } | null)
        setProfile(prof || { username: null, avatar_url: null })
      } catch {
        if (!active) return
        setProfile({ username: null, avatar_url: null })
      }
    }
    run()
    return () => { active = false }
  }, [user?.id, supabase])

  // Unread notifications count + realtime + local event
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) { setUnreadCount(0); return }
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null)
      setUnreadCount(count || 0)
    } catch {
      setUnreadCount(0)
    }
  }, [supabase, user?.id])

  useEffect(() => {
    let active = true
    fetchUnreadCount()
    if (!user?.id) return () => { active = false }
    const ch = supabase
      .channel('notif-badge-' + user.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchUnreadCount())
      .subscribe()
    const onLocal = (e: Event) => {
      try {
        const detail: any = (e as CustomEvent).detail
        if (detail && typeof detail.delta === 'number') {
          setUnreadCount((c) => Math.max(0, c + Number(detail.delta)))
          if (notifTimerRef.current) clearTimeout(notifTimerRef.current)
          notifTimerRef.current = setTimeout(() => {
            fetchUnreadCount()
          }, 350)
          return
        } else if (detail && detail.reset) {
          // fall through to fetch immediately
        }
      } catch {}
      fetchUnreadCount()
    }
    window.addEventListener('nodal:notifications-updated', onLocal as any)
    return () => { active = false; if (notifTimerRef.current) clearTimeout(notifTimerRef.current); supabase.removeChannel(ch); window.removeEventListener('nodal:notifications-updated', onLocal as any) }
  }, [user?.id, supabase, fetchUnreadCount])

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
    
    if (profile?.username) return profile.username
    if (user.user_metadata?.full_name) return user.user_metadata.full_name
    if (user.user_metadata?.name) return user.user_metadata.name
    if (user.email) return user.email.split('@')[0]
    
    return 'User'
  }

  const roleLabel = getUserRoleFromMetadata(user)
  const admin = isAdmin(user)
  const displayRole = admin ? 'Admin' : roleLabel

  // Get avatar url only from our profiles table (ignore Google picture entirely)
  const getUserAvatar = () => {
    if (!user) return null
    return profile?.avatar_url || null
  }

  const getInitials = () => {
    const source = (profile?.username || user?.email || user?.id || 'U').toString()
    return source.slice(0, 2).toUpperCase()
  }

  const getInitialsColor = () => {
    const palette = COLORGORY_DEFS.map(d => d.hex)
    const str = (profile?.username || user?.email || user?.id || 'U').toString()
    const hash = Array.from(str).reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0)
    return palette[Math.abs(hash) % palette.length]
  }

  return (
    <>
    <Menu
      className="z-[500]"
      trigger={
        <div className="relative gap-1 flex items-center">
          <IconButton
            aria-label="User menu"
            className="p-0!"
            variant="secondaryGhost"
            size="small"
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
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-gray-200 dark:border-gray-700" style={{ backgroundColor: getInitialsColor() }}>
                {getInitials()}
              </div>
            )}
          </IconButton>
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-[10px] leading-[18px] text-white text-center font-semibold shadow-sm">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
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
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white border-2 border-gray-200 dark:border-gray-700" style={{ backgroundColor: getInitialsColor() }}>
                  {getInitials()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {getUserDisplayName()}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {displayRole} • {user?.email || 'user'}
                </p>
              </div>
            </div>
            <div className="mt-2">
              <button
                onClick={() => { if (typeof window !== 'undefined') window.location.href = '/profile' }}
                className="cursor-pointer text-xs text-primary-600 dark:text-primary-400 hover:underline"
              >
                View Profile{unreadCount > 0 ? ` (${unreadCount > 99 ? '99+' : unreadCount})` : ''}
              </button>
            </div>
          </div>

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

          {/* Admin: Templates (only on board view) */}
          {admin && isBoardView && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Templates (Admin)</div>
              <div className="flex gap-2">
                <button
                  className="px-2 cursor-pointer py-1 text-xs rounded bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-700"
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
                        topic: state.topic || undefined
                      }
                      const res = await fetch('/api/admin/templates', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, data, description: null })
                      })
                      if (!res.ok) throw new Error('Template save failed')
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