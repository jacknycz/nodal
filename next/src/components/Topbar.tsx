'use client'
import { useTheme } from '../contexts/ThemeContext'
import type { SavedBoard } from '../features/storage/storage'
import AvatarMenu from './AvatarMenu'
import AISettingsMenu from './AISettingsMenu'
import DocumentsMenu from './DocumentsMenu'
import ShareMenu from './ShareMenu'
import React, { useState, useRef, useEffect } from 'react'
import { useBoardStore } from '../features/board/boardSlice';
import { House, Info, Plus, Pen, GearSix, ShareFat } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import Image from 'next/image';
import { useSupabaseUser } from '../features/auth/authUtils'
import { getSupabaseClient } from '../features/auth/supabaseClient'
import Menu from './ui/Menu'
import IconButton from './ui/IconButton'
import Button from './ui/Button'
import Tag from './ui/Tag'
import Modal from './ui/Modal'
import ShareBoardModal from './ShareBoardModal'
import BoardMembersRoleEditor from './BoardMembersRoleEditor'
import TextInput from './ui/TextInput'
import { isAdmin } from '../features/auth/roles'
import LinkUI from './ui/Link'
import DynamicModal from 'next/dynamic'
import Checkbox from './ui/Checkbox'
import TextArea from './ui/TextArea'
import { templateStorage } from '../features/storage/templateStorage'
import Toast from './ui/Toast'
import { boardStorage } from '../features/storage/storage'
import Select from './ui/Select'

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
  const [fbIdea, setFbIdea] = useState(false)
  const [fbBroken, setFbBroken] = useState(false)
  const [fbQuick, setFbQuick] = useState('')
  const [fbDetails, setFbDetails] = useState('')
  const [fbSubmitting, setFbSubmitting] = useState(false)
  const [fbError, setFbError] = useState<string | null>(null)
  const [showFbThanks, setShowFbThanks] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const setTopbarHeight = useBoardStore(state => state.setTopbarHeight);
  const headerRef = useRef<HTMLHeadingElement | null>(null);
  const user = useSupabaseUser()
  const currentBoardId = useBoardStore(state => state.currentBoardId)
  const topic = useBoardStore(state => state.topic)
  const [linkCopied, setLinkCopied] = useState(false)
  const setTopic = useBoardStore(state => state.setTopic)
  const [showTopicModal, setShowTopicModal] = useState(false)
  const [pendingTopic, setPendingTopic] = useState('')
  const [presentUsers, setPresentUsers] = useState<{ user_id: string; last_seen: string; email?: string | null }[]>([])
  const colorgories = useBoardStore(state => state.colorgories || [])
  const supabase = getSupabaseClient()
  const [showSavedStatus, setShowSavedStatus] = useState(true)
  const [showBoardSettings, setShowBoardSettings] = useState(false)
  const [pendingBoardName, setPendingBoardName] = useState('')
  const [pendingBoardTopic2, setPendingBoardTopic2] = useState('')
  const [pendingIsPublic, setPendingIsPublic] = useState<boolean>(false)
  const edgeType = useBoardStore(state => state.edgeType || 'floating')
  const setEdgeType = useBoardStore(state => state.setEdgeType)
  const [boardMemberRole, setBoardMemberRole] = useState<'owner' | 'editor' | 'viewer' | null>(null)

  useEffect(() => {
    if (headerRef.current) {
      const height = headerRef.current.getBoundingClientRect().height;
      setTopbarHeight(height);
    }
  }, [setTopbarHeight]);
  // Fetch current user's role on this board for UI gating
  useEffect(() => {
    const loadRole = async () => {
      if (!currentBoardId || !user?.id) { setBoardMemberRole(null); return }
      try {
        const { data, error } = await supabase
          .from('board_members')
          .select('role')
          .eq('board_id', currentBoardId)
          .eq('user_id', user.id)
          .maybeSingle()
        if (!error && data?.role) {
          setBoardMemberRole(data.role as any)
        } else {
          setBoardMemberRole(null)
        }
      } catch {
        setBoardMemberRole(null)
      }
    }
    loadRole()
  }, [currentBoardId, user?.id, supabase])

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
        user_email: user.email || null,
        last_seen: new Date().toISOString(),
      }, { onConflict: 'board_id,user_id' })
    }
    upsertPresence()
    interval = setInterval(upsertPresence, 15000)
    return () => { if (interval) clearInterval(interval) }
  }, [currentBoardId, user?.id, supabase])

  // Fade out Saved status text after 2s
  useEffect(() => {
    if (saveStatus === 'saved' && !hasUnsavedChanges) {
      setShowSavedStatus(true)
      const t = setTimeout(() => setShowSavedStatus(false), 2000)
      return () => clearTimeout(t)
    } else {
      // Ensure other statuses are fully visible
      setShowSavedStatus(true)
    }
  }, [saveStatus, hasUnsavedChanges])

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
        email: (row.email || row.user_email || null) as string | null,
      }))
      setPresentUsers(typed)
    }
    fetchPresence()
    return () => { supabase.removeChannel(channel) }
  }, [currentBoardId, supabase])

  // Helper to get avatar for a user_id (others only: small circle)
  const getPresenceAvatar = (userId: string, email?: string | null) => {
    if (user && user.id === userId) {
      // Current user: show their avatar if available
      const avatar = user.user_metadata?.avatar_url || user.user_metadata?.picture
      if (avatar) {
        return <Image src={avatar} alt="avatar" width={24} height={24} className="w-6 h-6 rounded-full object-cover border-2 border-white" unoptimized />
      }
    }
    // Fallback: colored initials from email (first two letters), else user_id
    const initialsSource = (email && typeof email === 'string') ? String(email).split('@')[0] : userId
    const initials = initialsSource.slice(0, 2).toUpperCase()
    // Pick a color from colorgories deterministically by userId/email
    const colors: string[] = (Array.isArray(colorgories) ? colorgories.map((c: any) => c?.color).filter(Boolean) : []).filter((v: any) => typeof v === 'string')
    const fallbackColors = ['#22c55e','#06b6d4','#3b82f6','#a855f7','#f59e0b','#ef4444']
    const palette = colors.length > 0 ? colors : fallbackColors
    const hashStr = (initialsSource || userId)
    const hash = Array.from(hashStr).reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0)
    const color = palette[Math.abs(hash) % palette.length]
    return (
      <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white" style={{ backgroundColor: color }}>
        {initials}
      </div>
    )
  }

  return (
    <>
      <header ref={headerRef} className="fixed top-0 left-0 right-0 z-[600] 
      bg-white/10 backdrop-blur-sm
      dark:bg-transparent dark:backdrop-blur-none dark:bg-gradient-to-b dark:from-black dark:via-black/80 dark:to-black/0
      ">
        <div className="flex items-center px-3 sm:px-4 py-1 gap-6">
          {/* Left - Logo */}
          <div className="flex-shrink-0 flex space-y-0 md:flex-col">
            <div className="flex gap-4">
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
                  className="hidden sm:block h-4 w-auto"
                  priority
                />
              </button>

              {isBoardView && currentBoardName && (
                <div className="flex items-start gap-2 sm:gap-3 min-w-0 w-full">
                  <div className="flex gap-1">
                    <div className="flex gap-0">
                      {(boardMemberRole === 'owner' || boardMemberRole === 'editor') && (
                        <IconButton aria-label="Board settings" size="md" variant="secondaryGhost" onClick={() => { setPendingBoardName(currentBoardName || ''); setPendingBoardTopic2(topic || ''); (async () => { try { if (currentBoardId) { const { data } = await supabase.from('boards').select('is_public').eq('id', currentBoardId).maybeSingle(); setPendingIsPublic(!!(data as any)?.is_public); } } catch {} finally { setShowBoardSettings(true) } })() }}>
                          <GearSix className="w-4 h-4" />
                        </IconButton>
                      )}
                      <div className="hidden sm:flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium font-fredoka text-gray-900 dark:text-white truncate max-w-[40vw]" title={currentBoardName}>{currentBoardName}</span>
                      </div>
                      <div className="sm:hidden min-w-0 w-full text-left">
                        <span className="font-semibold text-gray-900 dark:text-white truncate max-w-full text-xs" title={currentBoardName}>{currentBoardName}</span>
                      </div>
                      {/* Presence avatars (others only) */}
                      {(() => {
                        try {
                          const now = Date.now()
                          const online = (presentUsers || []).filter(p => {
                            if (user?.id && p.user_id === user.id) return false
                            const ts = Date.parse(p.last_seen)
                            return Number.isFinite(ts) && (now - ts) < 30000 // 30s freshness window
                          })
                          if (online.length === 0) return null
                          const maxShow = 3
                          const toShow = online.slice(0, maxShow)
                          const extra = online.length - toShow.length
                          return (
                            <div className="hidden sm:flex items-center ml-2 -space-x-2">
                              {toShow.map((p) => (
                                <div key={p.user_id} className="inline-block ring-2 ring-white dark:ring-black rounded-full overflow-hidden" title="Collaborator online">
                                  {getPresenceAvatar(p.user_id, p.email)}
                                </div>
                              ))}
                              {extra > 0 && (
                                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-[10px] text-gray-700 dark:text-gray-200 flex items-center justify-center ring-2 ring-white dark:ring-black">+{extra}</div>
                              )}
                            </div>
                          )
                        } catch {
                          return null
                        }
                      })()}
                    </div>

                    {/* Save Status */}
                    <div className="flex items-center gap-2 text-xs">
                      {saveStatus === 'saving' && (
                        <div className="flex items-center text-blue-600 dark:text-blue-400">
                          <div className="w-2 h-2 mr-1 bg-blue-600 rounded-full animate-pulse"></div>
                          <span>Saving...</span>
                        </div>
                      )}
                      {saveStatus === 'saved' && !hasUnsavedChanges && (
                        <div className="flex items-center text-green-600 dark:text-green-400">
                          <div className="w-2 h-2 mr-1 bg-green-600 rounded-full"></div>
                          <span className={`transition-opacity duration-500 ${showSavedStatus ? 'opacity-100' : 'opacity-0'}`}>Saved</span>
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
                </div>
              )}
            </div>
          </div>

          {/* Center - Board Info (truly centered) */}
          <div className="flex-1 min-w-0 flex justify-start sm:justify-center">

          </div>

          {/* Right - Controls */}
          <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 justify-end">
            <Tag variant="beta" className="ml-2">
              BETA
            </Tag>
            <LinkUI onClick={() => setShowFeedback(true)}>Feedback</LinkUI>

            {isBoardView && (
              <>
                <div className="hidden sm:flex items-center gap-3">
                   <IconButton
                    aria-label="Share board"
                    variant="secondaryGhost"
                    size="small"
                    onClick={() => setShowShareModal(true)}
                  >
                    <ShareFat size={44} weight="duotone" className="w-4 h-4" />
                  </IconButton>
                  <AISettingsMenu
                    isTestMode={isTestMode}
                    onToggleTestMode={onToggleTestMode}
                  />
                  <DocumentsMenu
                    onDeleteNode={onDeleteNode}
                  />
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
            {!isBoardView && (
              <IconButton aria-label="Product intro" size="md" onClick={() => router.push('/welcome')}>
                <Info className="w-5 h-5" />
              </IconButton>
            )}
            
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
      {/* Share Modal (same UI as BoardCard share) */}
      <ShareBoardModal open={showShareModal} onClose={() => setShowShareModal(false)} boardId={currentBoardId || ''} boardName={currentBoardName} />

      {/* Edit Topic Modal */}
      <Modal
        open={showTopicModal}
        onClose={() => setShowTopicModal(false)}
        title="Edit Board Topic"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowTopicModal(false)}>Cancel</Button>
            <Button onClick={() => {
              setTopic(pendingTopic.trim() || '')
              setShowTopicModal(false)
              try { onSaveBoard?.() } catch { }
            }}>Save</Button>
          </>
        }
      >
        <div className="py-2">
          <TextInput
            label="Topic"
            value={pendingTopic}
            onChange={(e) => setPendingTopic((e.target as HTMLInputElement).value)}
            placeholder="Enter topic..."
            fullWidth
            autoFocus
          />
        </div>
      </Modal>
      {/* Board Settings Modal */}
      <Modal
        open={showBoardSettings}
        onClose={() => setShowBoardSettings(false)}
        title="Board Settings"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowBoardSettings(false)}>Cancel</Button>
            <Button onClick={async () => {
              try {
                const newName = (pendingBoardName || '').trim()
                const newTopic = (pendingBoardTopic2 || '').trim()
                if (currentBoardId && newName && newName !== (currentBoardName || '')) {
                  try { await boardStorage.renameBoard(currentBoardId, newName) } catch { }
                }
                if (typeof newTopic === 'string' && newTopic !== (topic || '')) {
                  setTopic(newTopic)
                }
                // Persist public flag
                try {
                  if (currentBoardId) {
                    await fetch('/api/board/public', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ boardId: currentBoardId, isPublic: !!pendingIsPublic })
                    })
                  }
                } catch {}
                setShowBoardSettings(false)
                try { onSaveBoard?.() } catch { }
              } catch { }
            }}>Save</Button>
          </>
        }
      >
        <div className="space-y-3 py-2">
          <TextInput
            label="Board title"
            value={pendingBoardName}
            onChange={(e) => setPendingBoardName((e.target as HTMLInputElement).value)}
            placeholder="Enter board title..."
            fullWidth
            autoFocus
          />
          <TextInput
            label="Board topic"
            value={pendingBoardTopic2}
            onChange={(e) => setPendingBoardTopic2((e.target as HTMLInputElement).value)}
            placeholder="Enter topic..."
            fullWidth
          />
          <div className="flex items-center gap-3 pt-1" title={(boardMemberRole !== 'owner') ? 'Admin only' : undefined}>
            <Checkbox
              checked={pendingIsPublic}
              onChange={setPendingIsPublic}
              label="Public board"
              disabled={boardMemberRole !== 'owner'}
            />
            <div className="text-xs text-gray-500 dark:text-gray-400">Public boards are viewable by anyone with the URL.</div>
          </div>
          <Select
            label="Edge type"
            value={edgeType as any}
            onChange={(val) => setEdgeType?.((val as string) as any)}
            options={[
              { value: 'floating', label: 'Floating (Nodal default)' },
              { value: 'straight', label: 'Straight' },
              { value: 'step', label: 'Step' },
              { value: 'smoothstep', label: 'Smooth Step' },
            ]}
            fullWidth
            description="Choose how edges render on this board."
          />

          {/* Board members and roles */}
          <div className="pt-4">
            <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Board Members</div>
            <BoardMembersRoleEditor boardId={currentBoardId || ''} isOwnerView={boardMemberRole === 'owner'} />
          </div>
        </div>
      </Modal>
      <Modal
        open={showFeedback}
        onClose={() => { if (!fbSubmitting) setShowFeedback(false) }}
        title="Send Feedback"
        description="Hey! Thank you for doing this - give me all the feedback you can give! I will steal all the ideas and let me know if something is broken - or could just be better."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowFeedback(false)} disabled={fbSubmitting}>Cancel</Button>
            <Button onClick={async () => {
              setFbError(null)
              if (!fbQuick.trim()) { setFbError('Quick version is required'); return }
              try {
                setFbSubmitting(true)
                await fetch('/api/admin/feedback', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    quick: fbQuick.trim(),
                    details: fbDetails.trim() || null,
                    categories: { idea: fbIdea, broken: fbBroken },
                    user: { id: user?.id || null, email: user?.email || null },
                    board: { id: currentBoardId || null, name: currentBoardName || null },
                  })
                })
                setShowFeedback(false)
                setFbIdea(false); setFbBroken(false); setFbQuick(''); setFbDetails('')
                setShowFbThanks(true)
                setTimeout(() => setShowFbThanks(false), 2200)
              } catch {
                setFbError('Failed to submit')
              } finally {
                setFbSubmitting(false)
              }
            }} disabled={fbSubmitting}>Submit</Button>
          </>
        }
      >
        <div className="space-y-3 py-2">
          <div className="flex items-center gap-4">
            <Checkbox checked={fbIdea} onChange={setFbIdea} label="I have an idea" />
            <Checkbox checked={fbBroken} onChange={setFbBroken} label="Your thing is broken" />
          </div>
          <TextInput
            label="the quick version"
            placeholder="Short summary (required)"
            value={fbQuick}
            onChange={(e) => setFbQuick((e.target as HTMLInputElement).value)}
            required
            fullWidth
          />
          <TextArea
            label="give us the details"
            placeholder="Optional details"
            value={fbDetails}
            onChange={(e) => setFbDetails((e.target as HTMLTextAreaElement).value)}
            rows={4}
            fullWidth
          />
          {fbError && <div className="text-xs text-red-600 dark:text-red-400">{fbError}</div>}
        </div>
      </Modal>
      <Toast open={showFbThanks} onClose={() => setShowFbThanks(false)} variant="success" autoHideMs={2200}>
        Thank you SO MUCH for your feedback! We're making Nodal better as fast as we can!
      </Toast>
    </>
  )
} 