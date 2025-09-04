'use client'
import { useTheme } from '../contexts/ThemeContext'
import type { SavedBoard } from '../features/storage/storage'
import AvatarMenu from './AvatarMenu'
import AISettingsMenu from './AISettingsMenu'
import DocumentsMenu from './DocumentsMenu'
import ShareMenu from './ShareMenu'
import React, { useState, useRef, useEffect } from 'react'
import { useBoardStore } from '../features/board/boardSlice';
import { House, Info, Plus } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image';
import { useSupabaseUser } from '../features/auth/authUtils'
import { getSupabaseClient } from '../features/auth/supabaseClient'
import Menu from './ui/Menu'
import IconButton from './ui/IconButton'
import Button from './ui/Button'
import Tag from './ui/Tag'
import { isAdmin } from '../features/auth/roles'
import { templateStorage } from '../features/storage/templateStorage'

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
  onDeleteNode?: (nodeId: string) => void;
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
  isBoardView = false,
  onDeleteNode
}: TopbarProps) {
  const { isDark } = useTheme()
  const router = useRouter()
  const [showFeedback, setShowFeedback] = useState(false)
  const setTopbarHeight = useBoardStore(state => state.setTopbarHeight);
  const headerRef = useRef<HTMLHeadingElement | null>(null);
  const user = useSupabaseUser()
  const currentBoardId = useBoardStore(state => state.currentBoardId)
  const topic = useBoardStore(state => state.topic)
  const [linkCopied, setLinkCopied] = useState(false)
  const [presentUsers, setPresentUsers] = useState<{ user_id: string; last_seen: string }[]>([])
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (headerRef.current) {
      const height = headerRef.current.getBoundingClientRect().height;
      setTopbarHeight(height);
    }
  }, [setTopbarHeight]);

  // Temporary share handler
  const handleShareBoard = async () => {
    console.log('currentBoardId:', currentBoardId, 'user:', user);
    if (!currentBoardId || !user) {
      alert('No board or user')
      return
    }
    const email = window.prompt('Enter email to invite:')
    if (!email) return
    const res = await fetch('/api/board/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boardId: currentBoardId, email, invitedBy: user.id })
    })
    if (res.ok) {
      alert('Invitation sent!')
    } else {
      const json = await res.json()
      alert('Error: ' + (json.error || 'Unknown error'))
    }
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 1500)
    } catch (e) {
      alert('Failed to copy link')
    }
  }

  // Presence: upsert on mount and every 15s
  useEffect(() => {
    if (!currentBoardId || !user?.id) return
    let interval: NodeJS.Timeout | null = null
    const upsertPresence = async () => {
      await supabase.from('board_presence').upsert({
        board_id: currentBoardId,
        user_id: user.id,
        last_seen: new Date().toISOString(),
      })
    }
    upsertPresence()
    interval = setInterval(upsertPresence, 15000)
    return () => { if (interval) clearInterval(interval) }
  }, [currentBoardId, user?.id, supabase])

  // Presence: subscribe to changes
  useEffect(() => {
    if (!currentBoardId) return
    const channel = supabase
      .channel('board-presence-' + currentBoardId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'board_presence',
          filter: `board_id=eq.${currentBoardId}`,
        },
        payload => {
          // Refetch presence list on any change
          fetchPresence()
        }
      )
      .subscribe()
    const fetchPresence = async () => {
      const { data } = await supabase
        .from('board_presence')
        .select('*')
        .eq('board_id', currentBoardId)
        .order('last_seen', { ascending: false })
      const typed = (data || []).map((row: any) => ({
        user_id: String(row.user_id),
        last_seen: String(row.last_seen),
      }))
      setPresentUsers(typed)
    }
    fetchPresence()
    return () => { supabase.removeChannel(channel) }
  }, [currentBoardId, supabase])

  // Helper to get avatar for a user_id
  const getPresenceAvatar = (userId: string) => {
    if (user && user.id === userId) {
      // Current user: show their avatar if available
      const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
      if (avatar) {
        return <Image src={avatar} alt="avatar" width={24} height={24} className="w-6 h-6 rounded-full object-cover border-2 border-white" unoptimized />
      }
    }
    // Fallback: colored initials
    return (
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xs font-bold text-white border-2 border-white">
        {userId.slice(0, 2).toUpperCase()}
      </div>
    )
  }

  return (
    <>
      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-[80] 
      bg-gradient-to-b from-white via-white/70 to-white/0 dark:from-gray-950/50 dark:via-gray-900/10 dark:to-gray-950/0
      ">
        <div className="flex items-center px-3 sm:px-4 py-1 gap-6">
          {/* Left - Logo */}
          <div className="flex-shrink-0 flex items-center gap-3 sm:gap-6">
            {/* <button
              onClick={onOpenBoardRoom}
              className={`focus:outline-none cursor-pointer flex items-center gap-2 rounded-full p-1 ${
                isBoardView 
                  ? 'text-gray-900 dark:text-white' 
                  : 'bg-primary-500 text-white dark:bg-primary-500'
              }`}
              aria-label="Go to Board Room"
            >
              <House size={16} />
            </button> */}

            <button
              onClick={onOpenBoardRoom}
              className="focus:outline-none cursor-pointer flex items-center gap-2"
              aria-label="Go to Board Room"
            >
              {/* Mobile: symbol-only logo */}
              <Image
                src="/nodal.svg"
                alt="Nodal Logo"
                width={40}
                height={40}
                className="h-7 w-auto sm:hidden"
                priority
              />
              {/* Desktop/tablet: wordmark with dark/light */}
              <Image
                src={isDark ? "/nodal-white.svg" : "/nodal-black.svg"}
                alt="Nodal Logo"
                width={48}
                height={48}
                className="hidden sm:block h-8 w-auto"
                priority
              />

              <Tag variant="beta" className="ml-2">
                BETA
              </Tag>
            </button>



            {/* <div className="hidden sm:block">
              <ShareMenu
                onShareBoard={handleShareBoard}
                onCopyLink={handleCopyLink}
                onShowFeedback={() => setShowFeedback(true)}
              />
            </div>
            {linkCopied && (
              <span className="ml-2 text-green-600 text-xs">Link copied!</span>
            )} */}
          </div>

          {/* Center - Board Info (truly centered) */}
          <div className="flex-1 min-w-0 flex justify-start sm:justify-center">
            {isBoardView && currentBoardName && (
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 w-full">
                <div className="hidden sm:flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-900 dark:text-white truncate max-w-[40vw]" title={currentBoardName}>{currentBoardName}</span>
                </div>
                <div className="sm:hidden min-w-0 w-full text-left">
                  <span className="font-medium text-gray-900 dark:text-white truncate max-w-full text-xs" title={currentBoardName}>{currentBoardName}</span>
                </div>

                {/* Save Status */}
                <div className="hidden sm:flex items-center gap-2 text-xs">
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
                {/* Presence Avatars
                {presentUsers.length > 0 && (
                  <div className="hidden sm:flex items-center ml-4 gap-1">
                    {presentUsers.map((u) => (
                      <span key={u.user_id} title={u.user_id}>
                        {getPresenceAvatar(u.user_id)}
                      </span>
                    ))}
                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">{presentUsers.length} online</span>
                  </div>
                )} */}

                {topic && (
                  <div className="hidden sm:flex items-center ml-4">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Topic:</span>

                    <Tag variant="secondary" size="sm">
                      {topic}
                    </Tag>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right - Controls */}
          <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 justify-end">
            {isBoardView && (
              <>
                <div className="hidden sm:flex items-center gap-3">
                  <AISettingsMenu
                    isTestMode={isTestMode}
                    onToggleTestMode={onToggleTestMode}
                  />
                  <DocumentsMenu
                    onDeleteNode={onDeleteNode}
                  />
                  {/* {isAdmin(user) && (
                    <Button
                      variant="secondaryGhost"
                      className="text-sm px-2 py-1"
                      onClick={async () => {
                        const currentBoardId = useBoardStore.getState().currentBoardId
                        const nodes = useBoardStore.getState().nodes || []
                        const edges = useBoardStore.getState().edges || []
                        const viewport = useBoardStore.getState().viewport || { x: 0, y: 0, zoom: 1 }
                        const defaultName = currentBoardName || `Template ${new Date().toLocaleDateString()}`
                        const name = window.prompt('Template name', defaultName)
                        if (!name) return
                        const description = window.prompt('Optional description', '') || undefined
                        try {
                          await templateStorage.saveTemplate(name, { nodes, edges, viewport }, description)
                          alert('Template saved')
                        } catch (err) {
                          alert('Failed to save template')
                        }
                      }}
                    >
                      Save as new template
                    </Button>
                  )} */}
                </div>
                {/* Mobile More menu */}
                <div className="sm:hidden">
                  <Menu
                    trigger={
                      <IconButton aria-label="More" size="md" variant="secondaryGhost">
                        <Plus className="w-4 h-4" />
                      </IconButton>
                    }
                    align="right"
                    items={[
                      { label: 'AI Settings', onClick: () => onToggleTestMode?.() },
                      { label: 'Share board', onClick: () => handleShareBoard() },
                      { label: 'Copy link', onClick: () => handleCopyLink() },
                      { label: 'Feedback', onClick: () => setShowFeedback(true) },
                    ]}
                  />
                </div>
              </>
            )}
            <IconButton aria-label="Product intro" size="md" onClick={() => router.push('/welcome')}>
              <Info className="w-4 h-4" />
            </IconButton>
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