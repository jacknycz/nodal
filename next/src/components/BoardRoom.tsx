'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { SavedBoard } from '../features/storage/storage'
import type { BoardBrief } from '../features/board/boardTypes'
import BoardNameModal from './BoardNameModal'
import BoardSetupModal from './BoardSetupModal'
import Loader from './ui/Loader'
import { templateStorage, type TemplateRecord } from '../features/storage/templateStorage'
import { isAdmin } from '../features/auth/roles'
import { useSupabaseUser } from '../features/auth/authUtils'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import Checkbox from './ui/Checkbox'
import Button from './ui/Button'
import IconButton from './ui/IconButton'
import { PencilIcon, PinIcon, CheckIcon, Copy, Plus, Share2 } from 'lucide-react'
import { ClockClockwise, Graph, PushPin, TreeStructure, Pen, ChatCircleDots, Lightbulb, Gear } from '@phosphor-icons/react/dist/ssr'
import Select from './ui/Select'
import Search from './ui/Search'
import { Tab, Tabs } from './ui/Tabs'
// Gradient background only (no external images)

interface BoardRoomProps {
  onOpenBoard: (board: SavedBoard | null, brief?: BoardBrief | null) => void;
}

type SharedBoard = SavedBoard & { shared?: boolean; invited_by?: string }

function BoardCard({ board, onLoad, onRename, onDelete, isPinned, onTogglePin }: {
  board: SavedBoard & { shared?: boolean; invited_by?: string }
  onLoad: () => void
  onRename: (newName: string) => void
  onDelete: () => void
  isPinned: boolean
  onTogglePin: () => void
}) {
  const [newName, setNewName] = useState(board.name)
  const [imgError, setImgError] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState(`https://xghncimqbauvtytdfkkx.supabase.co/storage/v1/object/public/thumbnails/thumbnail-${board.id}.jpg`)
  const [loading, setLoading] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [originalName, setOriginalName] = useState(board.name)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareEmails, setShareEmails] = useState<string[]>([])
  const [shareInput, setShareInput] = useState('')
  const shareLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/board/${board.id}`

  // Optionally, poll for thumbnail updates
  useEffect(() => {
    if (loading) {
      const timeout = setTimeout(() => {
        // Bump the URL to force reload
        const newUrl = `https://xghncimqbauvtytdfkkx.supabase.co/storage/v1/object/public/thumbnails/thumbnail-${board.id}.jpg?${Date.now()}`;
        setThumbnailUrl(newUrl)
        setLoading(false)
      }, 2000)
      return () => clearTimeout(timeout)
    }
  }, [loading, board.id])

  // Listen for a custom event to trigger loading state
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail === board.id) setLoading(true)
    }
    window.addEventListener('thumbnail-generation', handler as EventListener)
    return () => window.removeEventListener('thumbnail-generation', handler as EventListener)
  }, [board.id])

  const commitTitleEdit = useCallback(() => {
    const trimmed = newName.trim()
    if (!trimmed) {
      setNewName(originalName)
      setIsEditingTitle(false)
      return
    }
    if (trimmed !== originalName) {
      onRename(trimmed)
    }
    setIsEditingTitle(false)
  }, [newName, originalName, onRename])

  // Click-outside to commit and exit title editing
  useEffect(() => {
    if (!isEditingTitle) return
    const handleMouseDown = (e: MouseEvent) => {
      const inputEl = titleInputRef.current
      if (inputEl && !inputEl.contains(e.target as Node)) {
        commitTitleEdit()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isEditingTitle, newName, originalName, commitTitleEdit])

  // Autofocus and select when entering title edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffHours < 1) {
      return 'Just now'
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)}d ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const handleCardClick = () => {
    if (showShareModal || showDeleteModal || isEditingTitle) return
    onLoad()
  }

  return (
    <div
      className="group relative shadow-xl shadow-gray-200/20 hover:shadow-gray-400/20 hover:shadow-lg dark:hover:shadow-primary-800/20 dark:shadow-none dark:hover:shadow-xl border-transparent bg-white/80 dark:bg-gray-950/70 dark:hover:border-primary-600/20 p-4 rounded-2xl border transition-all duration-200 cursor-pointer"
      onClick={handleCardClick}
    >

      <IconButton
        aria-label={isPinned ? 'Unpin board' : 'Pin board'}
        onClick={(e) => { e.stopPropagation(); onTogglePin() }}
        variant={isPinned ? 'primaryGhost' : 'secondaryGhost'}
        className={`absolute top-2 right-2 z-20 ${isPinned ? 'text-tertiary-500 bg-tertiary-50/50! dark:bg-transparent! hover:bg-tertiary-50' : 'text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200'}`}
      >
        <PushPin size={16} weight="duotone" />
      </IconButton>

      <div className="mb-1">
        {/* Clean title with hover-to-edit */}
        <div className="group relative">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <TextInput
                ref={titleInputRef}
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitTitleEdit() }
                  if (e.key === 'Escape') { e.preventDefault(); setNewName(originalName); setIsEditingTitle(false) }
                }}
                onBlur={commitTitleEdit}
                size="md"
                maxLength={50}
                className="flex-1"
              />
              <IconButton
                variant="primary"
                aria-label="Save title"
                onClick={(e) => { e.stopPropagation(); commitTitleEdit() }}
                className="ml-2"
              >
                <CheckIcon className="w-4 h-4" />
              </IconButton>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h3
                className="text-xl font-fredoka font-normal text-gray-900 dark:text-white truncate cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                onClick={(e) => { e.stopPropagation(); setOriginalName(newName); setIsEditingTitle(true) }}
              >
                {newName}
              </h3>
              <IconButton
                variant="primaryGhost"
                aria-label="Edit title"
                onClick={(e) => { e.stopPropagation(); setOriginalName(newName); setIsEditingTitle(true) }}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
              >
                <Pen size={20} weight="duotone" />
              </IconButton>
            </div>
          )}
        </div>

        {/* Last Modified */}
        <span className="flex mt-1 gap-1 items-center text-xs text-gray-400 dark:text-gray-400">
          <ClockClockwise size={16} weight="duotone" />{formatDate(board.lastModified)}
        </span>
      </div>

      <div className="flex space-x-6 items-center">
        {/* Board Info (right column) */}
        <div className="flex flex-col flex-1 w-full items-start">
          {/* Shared with/by info
          <div className="mb-2 flex items-center gap-2">
            {board.shared && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-semibold">Shared</span>
            )}
          </div>
          {board.shared && (
            <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Invited by: {board.invited_by || 'unknown'}</div>
          )} */}
          {/* Board Stats */}
          <div className="flex space-x-4 text-sm text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-1">
              <span className="flex items-center justify-center w-8 h-8 text-lg font-fredoka font-medium dark:bg-primary-900 border-2 border-primary-500 bg-primary-50/50 dark:border-none rounded-full text-primary-600 dark:text-primary-200">{board.nodeCount}</span>
              <span className="font-medium font-fredoka text-base">nodes</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex items-center justify-center w-8 h-8 text-lg font-fredoka font-medium dark:bg-primary-900 border-2 border-primary-500 bg-primary-50/50 dark:border-none rounded-full text-primary-600 dark:text-primary-200">{board.edgeCount}</span>
              <span className="font-medium font-fredoka text-base">connections</span>
            </div>
          </div>
        </div>

        {/* Board Thumbnail */}
        <div className="flex flex-col justify-items-start">
          {loading && (
            <div className="flex justify-center w-16 h-16 bg-gray-100 dark:bg-gray-900 rounded animate-pulse">
              <span className="text-gray-400 text-xs">Generating...</span>
            </div>
          )}
          {!loading && !imgError && thumbnailUrl ? (
            <div className="w-16 h-16 rounded-xl shadow overflow-hidden bg-gray-100 dark:bg-gray-900">
              <img
                src={thumbnailUrl}
                alt="Board thumbnail"
                className="w-full h-full object-cover"
                onError={() => {
                  setImgError(true);
                }}
              />
            </div>
          ) : (
            <div
              className="w-16 h-16 rounded shadow flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-gray-800 dark:to-gray-700"
            >
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 select-none">
                {(board.name || '')
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map(s => (s[0] ? s[0].toUpperCase() : ''))
                  .join('') || 'NB'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons - persistent bottom row */}
      <div className="col-span-2 mt-3 flex items-center justify-between gap-2">
        <Button
          variant="secondary"
          size="small"
          onClick={e => { e.stopPropagation(); setShowShareModal(true) }}
          title="Share board"
        >
          Share
        </Button>
        {/* Edit button removed; inline edit via title icon */}
        <Button
          variant="dangerGhost"
          size="small"
          onClick={e => { e.stopPropagation(); setShowDeleteModal(true) }}
          title="Delete board"
        >
          Delete
        </Button>
      </div>

      {/* Inline title editing replaces rename modal */}

      {/* Delete Confirmation Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Board"
        description={`Are you sure you want to delete "${newName}"? This action cannot be undone.`}
      >
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" size="small" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" size="small" onClick={() => { setShowDeleteModal(false); onDelete() }}>
            Delete
          </Button>
        </div>
      </Modal>

      {/* Share Modal */}
      <Modal
        open={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Board"
        description="Copy a link or invite people by email."
      >
        <div className="space-y-4">
          {/* Share link */}
          <div>
            <div className="flex gap-2">
              <TextInput readOnly value={shareLink} fullWidth label="Share link" />
              <IconButton aria-label="Copy share link" size="lg" variant="secondary" onClick={() => { navigator.clipboard.writeText(shareLink) }}>
                <Copy className="w-4 h-4" />
              </IconButton>
            </div>
          </div>

          {/* Share by email */}
          <div>
            <div className="flex gap-2">
              <TextInput
                type="email"
                placeholder="Add email and press Enter"
                label="Invite by email"
                value={shareInput}
                onChange={e => setShareInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const email = shareInput.trim()
                    if (email && !shareEmails.includes(email)) {
                      setShareEmails(prev => [...prev, email])
                      setShareInput('')
                    }
                  }
                }}
                fullWidth
              />
              <IconButton
                aria-label="Add email"
                size="lg"
                variant="secondary"
                onClick={() => {
                  const email = shareInput.trim()
                  if (email && !shareEmails.includes(email)) {
                    setShareEmails(prev => [...prev, email])
                    setShareInput('')
                  }
                }}
              >
                <Plus className="w-4 h-4" />
              </IconButton>
            </div>
            {shareEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {shareEmails.map(email => (
                  <span key={email} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                    {email}
                    <IconButton
                      aria-label={`Remove ${email}`}
                      size="sm"
                      variant="default"
                      className="ml-1"
                      onClick={() => setShareEmails(prev => prev.filter(e => e !== email))}
                    >
                      ×
                    </IconButton>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="secondary"
              onClick={() => setShowShareModal(false)}
            >
              Close
            </Button>
            <Button
              onClick={async () => {
                // Fire invitations for each email
                try {
                  await Promise.all(shareEmails.map(async (email) => {
                    await fetch('/api/board/invitations', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ boardId: board.id, email, invitedBy: board.userId })
                    })
                  }))
                  setShowShareModal(false)
                  setShareEmails([])
                } catch (e) {
                  console.error('Failed to send invites', e)
                }
              }}
              disabled={shareEmails.length === 0}
            >
              Send Invites
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

const BoardRoom: React.FC<BoardRoomProps> = ({ onOpenBoard }) => {
  const user = useSupabaseUser()
  const [boards, setBoards] = useState<SavedBoard[]>([])
  const [sharedBoards, setSharedBoards] = useState<SharedBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewBoardModal, setShowNewBoardModal] = useState(false)
  const [pinnedBoardIds, setPinnedBoardIds] = useState<string[]>([])
  const [showSharedOnly, setShowSharedOnly] = useState(false)
  const [totalDocuments, setTotalDocuments] = useState<number>(0)
  const [statsLoading, setStatsLoading] = useState<boolean>(false)
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(false)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null)
  const [editingTemplateName, setEditingTemplateName] = useState<string>('')
  const [editingTemplateDescription, setEditingTemplateDescription] = useState<string>('')
  const [editingTemplateLoading, setEditingTemplateLoading] = useState<boolean>(false)
  const [tasksLoading, setTasksLoading] = useState<boolean>(false)
  const [incompleteTasks, setIncompleteTasks] = useState<Array<{ boardId: string; boardName: string; nodeId: string; title: string }>>([])

  // New board flow states
  const [showBoardSetup, setShowBoardSetup] = useState(false)

  const loadBoards = async () => {
    try {
      setLoading(true)
      const { boardStorage } = await import('../features/storage/storage')
      const loadedBoards = await boardStorage.getAllBoards()
      setBoards(loadedBoards)
      // Fetch shared boards from API
      if (user?.email) {
        const res = await fetch(`/api/board/shared?email=${encodeURIComponent(user.email)}`)
        const json = await res.json()
        setSharedBoards(Array.isArray(json.boards) ? json.boards : [])
      } else {
        setSharedBoards([])
      }
      // Stats computed in a separate effect when state settles
    } catch {
      setError('Failed to load boards')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBoards()
    // Load pinned boards from localStorage
    try {
      const stored = localStorage.getItem('pinnedBoards')
      if (stored) setPinnedBoardIds(JSON.parse(stored))
    } catch { }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email])

  // Load templates (public)
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        setTemplatesLoading(true)
        setTemplatesError(null)
        const list = await templateStorage.getAllTemplates()
        setTemplates(list)
      } catch {
        setTemplatesError('Failed to load templates')
      } finally {
        setTemplatesLoading(false)
      }
    }
    loadTemplates()
  }, [])

  // Compute incomplete task nodes across all boards
  useEffect(() => {
    const computeTasks = async () => {
      try {
        setTasksLoading(true)
        const { boardStorage } = await import('../features/storage/storage')
        const all: Array<SavedBoard | SharedBoard> = [...boards, ...sharedBoards]
        const results: Array<{ boardId: string; boardName: string; nodeId: string; title: string }> = []
        for (const b of all) {
          try {
            const full = await boardStorage.loadBoard(b.id)
            const nodes = full?.data?.nodes || []
            nodes.forEach((n: any) => {
              if (n?.type === 'task' && !(n?.data?.completed === true)) {
                results.push({ boardId: b.id, boardName: b.name, nodeId: n.id, title: n?.data?.title || 'Untitled' })
              }
            })
          } catch {
            // ignore board load errors for tasks list
          }
        }
        setIncompleteTasks(results)
      } catch {
        setIncompleteTasks([])
      } finally {
        setTasksLoading(false)
      }
    }
    if (!loading) {
      computeTasks()
    }
  }, [boards, sharedBoards, loading])

  // Re-compute document stats whenever boards/sharedBoards change
  useEffect(() => {
    const computeDocs = async () => {
      try {
        setStatsLoading(true)
        const { boardStorage } = await import('../features/storage/storage')
        const allIds: string[] = [
          ...boards.map(b => b.id),
          ...sharedBoards.map((b) => b.id)
        ]
        const counts = await Promise.all(
          allIds.map(async (id) => {
            try {
              const docs = await boardStorage.getBoardDocuments(id)
              return docs.length
            } catch {
              return 0
            }
          })
        )
        const total = counts.reduce((a, b) => a + b, 0)
        setTotalDocuments(total)
      } catch {
        setTotalDocuments(0)
      } finally {
        setStatsLoading(false)
      }
    }
    // Only run after initial boards load completes
    if (!loading) {
      computeDocs()
    }
  }, [boards, sharedBoards, loading])

  const togglePin = (boardId: string) => {
    setPinnedBoardIds(prev => {
      const exists = prev.includes(boardId)
      const next = exists ? prev.filter(id => id !== boardId) : [boardId, ...prev]
      try { localStorage.setItem('pinnedBoards', JSON.stringify(next)) } catch { }
      return next
    })
  }

  const handleRename = async (boardId: string, newName: string) => {
    // Optimistic update: avoid full reload/loader flicker
    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, name: newName, lastModified: Date.now() } : b))
    setSharedBoards(prev => prev.map((b) => b.id === boardId ? { ...b, name: newName, lastModified: Date.now() } : b))
    try {
      const { boardStorage } = await import('../features/storage/storage')
      await boardStorage.renameBoard(boardId, newName)
    } catch {
      setError('Failed to rename board')
      // Optional: reload to reconcile state if needed, but avoid blocking UI
      // void loadBoards()
    }
  }

  const handleDelete = async (boardId: string) => {
    try {
      const { boardStorage } = await import('../features/storage/storage')
      await boardStorage.deleteBoard(boardId)
      await loadBoards()
    } catch {
      setError('Failed to delete board')
    }
  }

  const handleCreateNewBoard = async (boardName: string) => {
    try {
      const { boardStorage } = await import('../features/storage/storage')
      const emptyBoardData = {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      }
      const boardId = await boardStorage.saveBoard(boardName, emptyBoardData)
      const newBoard = await boardStorage.loadBoard(boardId)
      if (newBoard) {
        setShowNewBoardModal(false)
        await loadBoards() // Refresh the board list
        onOpenBoard(newBoard, undefined) // Mark as new
      }
    } catch {
      setError('Failed to create new board')
    }
  }

  // Handle board setup completion (now creates the board directly)
  const handleBoardSetupComplete = (brief: BoardBrief) => {
    setShowBoardSetup(false)
    onOpenBoard(null, brief) // Pass brief to App/Board
  }

  // Handle cancellation of any modal in the flow
  const handleCancelSetup = () => {
    setShowBoardSetup(false)
  }

  const handleNewBoardClick = () => {
    setShowBoardSetup(true)
  }

  const allBoards: Array<SavedBoard | SharedBoard> = [...boards, ...sharedBoards]
  const filteredBoards = allBoards
    .filter(board =>
      board.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(board => !showSharedOnly || ('shared' in board && board.shared === true))

  // Sort: pinned first, then by lastModified desc
  const sortedBoards = [...filteredBoards].sort((a, b) => {
    const aPinned = pinnedBoardIds.includes(a.id)
    const bPinned = pinnedBoardIds.includes(b.id)
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1
    return (b.lastModified || 0) - (a.lastModified || 0)
  })

  // Determine a topic query from latest board (owned or shared)
  const latestBoards: Array<SavedBoard | SharedBoard> = [...boards, ...sharedBoards]
  const latestBoardTopic = (latestBoards
    .sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))[0]?.data?.topic) || 'creative'

  // Prefer first name; if missing, use last name; otherwise no name
  const greetingName = (() => {
    const meta = user?.user_metadata as Record<string, unknown> | undefined
    const given = String(meta?.given_name ?? '').trim()
    const family = String(meta?.family_name ?? '').trim()
    const full = String((meta?.full_name ?? meta?.name) ?? '').trim()
    if (given) return given.split(/\s+/)[0]
    if (full) {
      const parts = full.split(/\s+/).filter(Boolean)
      if (parts.length >= 2) return parts[0]
    }
    if (family) return family.split(/\s+/)[0]
    return ''
  })()

  return (
    <div className="relative min-h-screen pt-16">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 dark:from-gray-950 dark:via-primary-950 dark:to-gray-950" />
      </div>

      {/* Sticky Welcome Section */}
      <div className="sticky top-16 z-10 pb-8">
        <div className="w-full mx-auto py-10 px-4 sm:px-6 lg:px-8">
          {/* Welcome + Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1 rounded-xl">
              <h1 className="mb-4 text-xl md:text-5xl font-fredoka text-transform-lowercase font-medium text-gray-900 dark:text-white">
                <span className="font-normal">welcome back</span>{greetingName ? `, ${greetingName}` : ''}!
              </h1>
              <p className="mt-1 text-sm text-gray-700 dark:text-gray-400">
                Pick up where you left off or create something new.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="relative rounded-4xl px-6 py-4 bg-white/80 dark:bg-gray-900/60 border border-primary-500/80 dark:border-primary-700/80">
                <div className="flex absolute top-4 right-4 items-center text-primary-500/80">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12">
                    <path opacity="0.2" d="M38.5 9.625V34.375C38.5 34.7397 38.3551 35.0894 38.0973 35.3473C37.8394 35.6051 37.4897 35.75 37.125 35.75H6.875C6.51033 35.75 6.16059 35.6051 5.90273 35.3473C5.64487 35.0894 5.5 34.7397 5.5 34.375V9.625C5.5 9.26033 5.64487 8.91059 5.90273 8.65273C6.16059 8.39487 6.51033 8.25 6.875 8.25H37.125C37.4897 8.25 37.8394 8.39487 38.0973 8.65273C38.3551 8.91059 38.5 9.26033 38.5 9.625Z" fill="currentColor" />
                    <path d="M37.125 6.875C37.8543 6.875 38.5536 7.16494 39.0693 7.68066C39.5851 8.19639 39.875 8.89566 39.875 9.625V34.375C39.875 35.1043 39.5851 35.8036 39.0693 36.3193C38.5536 36.8351 37.8543 37.125 37.125 37.125H6.875C6.14565 37.125 5.44639 36.8351 4.93066 36.3193C4.41494 35.8036 4.125 35.1043 4.125 34.375V9.625C4.125 8.89565 4.41494 8.19639 4.93066 7.68066C5.44639 7.16494 6.14565 6.875 6.875 6.875H37.125ZM6.875 34.375H37.125V9.625H6.875V34.375ZM16 28C16.5523 28 17 28.4477 17 29V31C17 31.5523 16.5523 32 16 32H10C9.44772 32 9 31.5523 9 31V29C9 28.4477 9.44772 28 10 28H16ZM34 28C34.5523 28 35 28.4477 35 29V31C35 31.5523 34.5523 32 34 32H28C27.4477 32 27 31.5523 27 31V29C27 28.4477 27.4477 28 28 28H34ZM25 20C25.5523 20 26 20.4477 26 21V23C26 23.5523 25.5523 24 25 24H19C18.4477 24 18 23.5523 18 23V21C18 20.4477 18.4477 20 19 20H25ZM31 11C31.5523 11 32 11.4477 32 12C32 12.5523 31.5523 13 31 13C30.4477 13 30 12.5523 30 12C30 11.4477 30.4477 11 31 11ZM34 11C34.5523 11 35 11.4477 35 12C35 12.5523 34.5523 13 34 13C33.4477 13 33 12.5523 33 12C33 11.4477 33.4477 11 34 11Z" fill="currentColor" />
                  </svg>
                </div>
                <div className="font-fredoka font-medium lowercase tracking-wide text-gray-500 dark:text-gray-400">Boards</div>
                <div className="text-4xl font-fredoka font-normal text-gray-900 dark:text-white">{boards.length}</div>
              </div>

              <div className="relative rounded-4xl p-4 bg-white/80 dark:bg-gray-900/60 border border-secondary-500/80 dark:border-secondary-700/80">
                <div className="flex absolute top-4 right-4 items-center text-secondary-500/80">
                  <Graph size={48} weight="duotone" />
                </div>
                <div className="font-fredoka font-semibold lowercase tracking-wide text-gray-500 dark:text-gray-400">nodes</div>
                <div className="text-4xl font-fredoka font-normal text-gray-900 dark:text-white">
                  {boards.reduce((total, board) => total + (board.nodeCount || 0), 0)}
                </div>
              </div>

              <div className="relative rounded-4xl p-4 bg-white/80 dark:bg-gray-900/60 border border-tertiary-500/80 dark:border-tertiary-700/80">
                <div className="flex absolute top-4 right-4 items-center text-tertiary-500/80">
                  <TreeStructure size={48} weight="duotone" />
                </div>
                <div className="font-fredoka font-semibold lowercase tracking-wide text-gray-500 dark:text-gray-400">connections</div>
                <div className="text-4xl font-fredoka font-normal text-gray-900 dark:text-white">
                  {boards.reduce((total, board) => total + (board.edgeCount || 0), 0)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/*
        ANNOYINGLY LARGE SEPERATOR (ALS) BETWEEN WELCOME AND BOARD CARDS JUST LIKE THE UI YEEEEAAAAHHHHH
      */}

      {/* <Tabs>
        <Tab
          label="Chat"
          icon={<ChatCircleDots size={20} weight="duotone" />}
        >
          <p>Here’s where chat messages will show up.</p>
        </Tab>

        <Tab
          label="Ideas"
          icon={<Lightbulb size={20} weight="duotone" />}
        >
          <ul className="list-disc pl-5 space-y-1">
            <li>Mind map brainstorms</li>
            <li>AI-generated suggestions</li>
            <li>Random shower thoughts</li>
          </ul>
        </Tab>

        <Tab
          label="Settings"
          icon={<Gear size={20} weight="duotone" />}
        >
          <p>Manage your board preferences and options here.</p>
        </Tab>
      </Tabs> */}

      {/* Scrollable Boards Section */}
      <div className="relative flex flex-col md:flex-row mx-4 md:mx-6 lg:mx-8 z-20 
      shadow dark:shadow-2xl dark:shadow-gray-950/70 
      backdrop-blur-sm bg-white/50 dark:bg-slate-950/70
      border-t border-gray-200/50 dark:border-gray-800/50 rounded-4xl overflow-hidden">

        <Tabs>

          {/* TAB 1 */}
          <Tab
            label="Boards"
            icon={<svg width="44" height="44" className="mt-[1px] w-6 h-6 text-white" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path opacity="0.2" d="M38.5 9.625V34.375C38.5 34.7397 38.3551 35.0894 38.0973 35.3473C37.8394 35.6051 37.4897 35.75 37.125 35.75H6.875C6.51033 35.75 6.16059 35.6051 5.90273 35.3473C5.64487 35.0894 5.5 34.7397 5.5 34.375V9.625C5.5 9.26033 5.64487 8.91059 5.90273 8.65273C6.16059 8.39487 6.51033 8.25 6.875 8.25H37.125C37.4897 8.25 37.8394 8.39487 38.0973 8.65273C38.3551 8.91059 38.5 9.26033 38.5 9.625Z" fill="currentColor" />
              <path d="M37.125 6.875C37.8543 6.875 38.5536 7.16494 39.0693 7.68066C39.5851 8.19639 39.875 8.89566 39.875 9.625V34.375C39.875 35.1043 39.5851 35.8036 39.0693 36.3193C38.5536 36.8351 37.8543 37.125 37.125 37.125H6.875C6.14565 37.125 5.44639 36.8351 4.93066 36.3193C4.41494 35.8036 4.125 35.1043 4.125 34.375V9.625C4.125 8.89565 4.41494 8.19639 4.93066 7.68066C5.44639 7.16494 6.14565 6.875 6.875 6.875H37.125ZM6.875 34.375H37.125V9.625H6.875V34.375ZM23 16C23.5523 16 24 16.4477 24 17V20H27C27.5523 20 28 20.4477 28 21V23C28 23.5523 27.5523 24 27 24H24V27C24 27.5523 23.5523 28 23 28H21C20.4477 28 20 27.5523 20 27V24H17C16.4477 24 16 23.5523 16 23V21C16 20.4477 16.4477 20 17 20H20V17C20 16.4477 20.4477 16 21 16H23ZM31 11C31.5523 11 32 11.4477 32 12C32 12.5523 31.5523 13 31 13C30.4477 13 30 12.5523 30 12C30 11.4477 30.4477 11 31 11ZM34 11C34.5523 11 35 11.4477 35 12C35 12.5523 34.5523 13 34 13C33.4477 13 33 12.5523 33 12C33 11.4477 33.4477 11 34 11Z" fill="currentColor" />
            </svg>}
            headerClassName="bg-white text-slate-900"
            activeHeaderClassName="bg-white text-slate-900"
          >
            <div className="w-full mx-auto px-4 sm:px-6 lg:px-12 py-10">
              {/* <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-medium font-fredoka text-gray-800 dark:text-white">your boards</h2>
          </div> */}

              <div className="flex justify-between items-center gap-4 md:gap-6 xl:gap-8 mb-8">
                <div className="flex justify-center w-full max-w-xl">
                  <Search
                    placeholder="Search boards..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    label="Search boards..."
                    className="w-full"
                  />
                </div>

                <div className="flex items-center gap-4 flex-none">
                  <Checkbox
                    label="Show shared only"
                    checked={showSharedOnly}
                    onChange={(v) => setShowSharedOnly(v)}
                    labelTextClassName='text-sm text-gray-500 dark:text-gray-400'
                  />
                </div>
              </div>

              {error && (
                <div className="mb-4 text-red-600 dark:text-red-400">{error}</div>
              )}
              {loading ? (
                <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                  <Loader />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                  {sortedBoards.length === 0 ? (
                    <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-16">
                      No boards found. Create a new board to get started!
                    </div>
                  ) : (
                    sortedBoards.map(board => (
                      <BoardCard
                        key={board.id}
                        board={board}
                        onLoad={() => onOpenBoard(board, undefined)}
                        onRename={newName => handleRename(board.id, newName)}
                        onDelete={() => handleDelete(board.id)}
                        isPinned={pinnedBoardIds.includes(board.id)}
                        onTogglePin={() => togglePin(board.id)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          </Tab>
          
          {/* TAB 2 */}
          <Tab
            label="Ideas"
            icon={<Lightbulb size={20} weight="duotone" />}
          >
            {/* Templates Section */}
            <div className="relative z-20 mx-4 md:mx-6 lg:mx-8 bg-white/50 dark:bg-slate-950/50 shadow backdrop-blur-sm border-t border-gray-200/50 dark:border-gray-800/50 rounded-t-4xl overflow-hidden mt-8 md:mt-12 lg:mt-16">
              <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-medium font-fredoka text-gray-900 dark:text-white">templates</h2>
                </div>
                {templatesError && (
                  <div className="mb-4 text-red-600 dark:text-red-400">{templatesError}</div>
                )}
                {templatesLoading ? (
                  <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                    <Loader />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {templates.length === 0 ? (
                      <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-16">
                        No templates yet.
                      </div>
                    ) : (
                      templates.map((t) => {
                        const admin = isAdmin(user)
                        const isEditing = editingTemplateId === t.id
                        return (
                          <div key={t.id} className="group relative shadow-xl shadow-gray-200/20 hover:shadow-gray-400/20 hover:shadow-lg dark:hover:shadow-primary-800/20 dark:shadow-none dark:hover:shadow-xl border-transparent bg-white/80 dark:bg-gray-950/70 dark:hover:border-primary-600/20 p-4 rounded-3xl border transition-all duration-200">
                            <div className="mb-2">
                              {isEditing ? (
                                <div className="flex items-center gap-2">
                                  <TextInput
                                    type="text"
                                    value={editingTemplateName}
                                    onChange={(e) => setEditingTemplateName(e.target.value)}
                                    size="md"
                                    className="flex-1"
                                    maxLength={100}
                                  />
                                  <IconButton
                                    variant="primary"
                                    aria-label="Save title"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      try {
                                        setEditingTemplateLoading(true)
                                        const updated = await templateStorage.updateTemplate(t.id, { name: editingTemplateName, description: editingTemplateDescription })
                                        setTemplates(prev => prev.map(p => p.id === t.id ? updated : p))
                                        setEditingTemplateId(null)
                                        setEditingTemplateName('')
                                        setEditingTemplateDescription('')
                                      } catch (err) {
                                        alert('Failed to update template')
                                      } finally {
                                        setEditingTemplateLoading(false)
                                      }
                                    }}
                                  >
                                    <CheckIcon className="w-4 h-4" />
                                  </IconButton>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 group">
                                  <h3
                                    className="text-xl font-thin text-gray-900 dark:text-white truncate cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                                  >
                                    {t.name}
                                  </h3>
                                  <IconButton
                                    variant="primaryGhost"
                                    aria-label="Edit title"
                                    onClick={(e) => { e.stopPropagation(); setEditingTemplateId(t.id); setEditingTemplateName(t.name || ''); setEditingTemplateDescription(t.description || '') }}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                                  >
                                    <PencilIcon className="w-4 h-4" />
                                  </IconButton>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400 mb-2">
                              <div className="flex items-center gap-1">
                                <span className="flex items-center justify-center w-8 h-8 text-lg font-fredoka font-medium dark:bg-primary-900 border-2 border-primary-200 dark:border-none rounded-full text-primary-500 dark:text-primary-200">{t.nodeCount}</span>
                                <span className="font-medium">nodes</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="flex items-center justify-center w-8 h-8 text-lg font-fredoka font-medium dark:bg-primary-900 border-2 border-primary-200 dark:border-none rounded-full text-primary-500 dark:text-primary-200">{t.edgeCount}</span>
                                <span className="font-medium">connections</span>
                              </div>
                            </div>
                            <div className="mt-3 flex justify-end gap-2">

                              <>
                                {admin && (
                                  <Button
                                    variant="secondaryGhost"
                                    size="small"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      try {
                                        const { boardStorage } = await import('../features/storage/storage')
                                        const id = await boardStorage.saveBoard(t.name, t.data)
                                        // Persist mapping so autosave updates the template
                                        try { localStorage.setItem(`templateMapping:${id}`, t.id) } catch { }
                                        const newBoard = await boardStorage.loadBoard(id)
                                        if (newBoard) {
                                          onOpenBoard(newBoard, undefined)
                                        } else if (typeof window !== 'undefined') {
                                          window.location.href = `/board/${id}`
                                        }
                                      } catch (err) {
                                        alert('Failed to open template for editing')
                                      }
                                    }}
                                  >
                                    Edit
                                  </Button>
                                )}
                                <Button
                                  variant="primary"
                                  size="small"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    try {
                                      const newName = `${t.name} (copy)`
                                      const { boardStorage } = await import('../features/storage/storage')
                                      const id = await boardStorage.saveBoard(newName, t.data)
                                      const newBoard = await boardStorage.loadBoard(id)
                                      if (newBoard) {
                                        onOpenBoard(newBoard, undefined)
                                      } else if (typeof window !== 'undefined') {
                                        window.location.href = `/board/${id}`
                                      }
                                    } catch (e) {
                                      alert('Failed to use template')
                                    }
                                  }}
                                >
                                  Use
                                </Button>
                              </>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </Tab>
          
          {/* TAB 3 */}
          <Tab
            label="Settings"
            icon={<Gear size={20} weight="duotone" />}
          >
            <p>Manage your board preferences and options here.</p>
          </Tab>
        </Tabs>

        <div className="w-96 bg-white dark:bg-slate-950/90 p-8">
          <div className="flex flex-none justify-end">
            <Button
              onClick={handleNewBoardClick}
              className="flex gap-3 w-full"
            >
              <span>New Board</span>
              <svg width="44" height="44" className="mt-[1px] w-6 h-6 text-white" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path opacity="0.2" d="M38.5 9.625V34.375C38.5 34.7397 38.3551 35.0894 38.0973 35.3473C37.8394 35.6051 37.4897 35.75 37.125 35.75H6.875C6.51033 35.75 6.16059 35.6051 5.90273 35.3473C5.64487 35.0894 5.5 34.7397 5.5 34.375V9.625C5.5 9.26033 5.64487 8.91059 5.90273 8.65273C6.16059 8.39487 6.51033 8.25 6.875 8.25H37.125C37.4897 8.25 37.8394 8.39487 38.0973 8.65273C38.3551 8.91059 38.5 9.26033 38.5 9.625Z" fill="currentColor" />
                <path d="M37.125 6.875C37.8543 6.875 38.5536 7.16494 39.0693 7.68066C39.5851 8.19639 39.875 8.89566 39.875 9.625V34.375C39.875 35.1043 39.5851 35.8036 39.0693 36.3193C38.5536 36.8351 37.8543 37.125 37.125 37.125H6.875C6.14565 37.125 5.44639 36.8351 4.93066 36.3193C4.41494 35.8036 4.125 35.1043 4.125 34.375V9.625C4.125 8.89565 4.41494 8.19639 4.93066 7.68066C5.44639 7.16494 6.14565 6.875 6.875 6.875H37.125ZM6.875 34.375H37.125V9.625H6.875V34.375ZM23 16C23.5523 16 24 16.4477 24 17V20H27C27.5523 20 28 20.4477 28 21V23C28 23.5523 27.5523 24 27 24H24V27C24 27.5523 23.5523 28 23 28H21C20.4477 28 20 27.5523 20 27V24H17C16.4477 24 16 23.5523 16 23V21C16 20.4477 16.4477 20 17 20H20V17C20 16.4477 20.4477 16 21 16H23ZM31 11C31.5523 11 32 11.4477 32 12C32 12.5523 31.5523 13 31 13C30.4477 13 30 12.5523 30 12C30 11.4477 30.4477 11 31 11ZM34 11C34.5523 11 35 11.4477 35 12C35 12.5523 34.5523 13 34 13C33.4477 13 33 12.5523 33 12C33 11.4477 33.4477 11 34 11Z" fill="currentColor" />
              </svg>
            </Button>
          </div>

          {/* <div className="flex flex-col gap-4 mt-8">
            <h2 className="text-2xl font-medium font-fredoka text-gray-900 dark:text-white">pinned boards</h2>
            <div className="flex flex-col gap-2">
              {pinnedBoardIds.map(id => {
                const board = allBoards.find(b => b.id === id)
                if (!board) return null
                return (
                  <BoardCard
                    key={board.id}
                    board={board}
                    onLoad={() => onOpenBoard(board, undefined)}
                    onRename={newName => handleRename(board.id, newName)}
                    onDelete={() => handleDelete(board.id)}
                    isPinned={true}
                    onTogglePin={() => togglePin(board.id)}
                  />
                )
              })}
            </div>
          </div> */}

          <div className="flex flex-col gap-4 mt-8">
            <h2 className="text-2xl font-medium font-fredoka text-gray-900 dark:text-white">task nodes</h2>
            {tasksLoading ? (
              <div className="text-sm text-gray-500 dark:text-gray-400">Loading tasks…</div>
            ) : (
              <div className="flex flex-col gap-2">
                {incompleteTasks.length === 0 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">No incomplete tasks. Nice work!</div>
                )}
                {incompleteTasks.slice(0, 10).map((t) => (
                  <button
                    key={`${t.boardId}-${t.nodeId}`}
                    onClick={() => {
                      const b = allBoards.find((bb) => bb.id === t.boardId) as any
                      if (b) onOpenBoard(b, undefined)
                    }}
                    className="text-left flex items-center justify-between gap-2 border border-gray-200 dark:border-gray-700 rounded px-3 py-2 bg-white/70 dark:bg-gray-900/60 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex w-4 h-4 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900" aria-hidden />
                      <div className="flex flex-col">
                        <span className="text-sm text-gray-800 dark:text-gray-100 truncate max-w-[220px]">{t.title}</span>
                        <span className="text-[11px] text-gray-500 dark:text-gray-400">{t.boardName}</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-primary-600 dark:text-primary-400">Open</span>
                  </button>
                ))}
                {incompleteTasks.length > 10 && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">Showing 10 of {incompleteTasks.length} tasks</div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4 mt-8">
            <h2 className="text-2xl font-medium font-fredoka text-gray-900 dark:text-white">nodal news</h2>
          </div>
        </div>
      </div>

      {/* Simple board name modal (fallback) */}
      <BoardNameModal
        isOpen={showNewBoardModal}
        onClose={() => setShowNewBoardModal(false)}
        onSave={handleCreateNewBoard}
        defaultName=""
        existingNames={boards.map(board => board.name)}
      />

      {/* Sophisticated board setup modal */}
      <BoardSetupModal
        isOpen={showBoardSetup}
        onComplete={handleBoardSetupComplete}
        onClose={handleCancelSetup}
      />
    </div>
  )
}

export default BoardRoom 