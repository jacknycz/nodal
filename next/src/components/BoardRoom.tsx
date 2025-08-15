'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { SavedBoard } from '../features/storage/storage'
import type { BoardBrief } from '../features/board/boardTypes'
import BoardNameModal from './BoardNameModal'
import BoardSetupModal from './BoardSetupModal'
import Loader from './ui/Loader'
import { useSupabaseUser } from '../features/auth/authUtils'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import Checkbox from './ui/Checkbox'
import Button from './ui/Button'
import IconButton from './ui/IconButton'
import { CircuitBoard, FileText, Users, PencilIcon, PinIcon, CheckIcon } from 'lucide-react'
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
      className="group relative border-transparent bg-white/80 dark:bg-gray-950/50 hover:border-gray-300 dark:hover:border-primary-600/50 p-4 rounded-3xl border transition-all duration-200 hover:shadow-md cursor-pointer"
      onClick={handleCardClick}
    >

      <IconButton
        aria-label={isPinned ? 'Unpin board' : 'Pin board'}
        onClick={(e) => { e.stopPropagation(); onTogglePin() }}
        variant={isPinned ? 'primaryGhost' : 'secondaryGhost'}
        className={`absolute top-2 right-2 ${isPinned ? 'text-tertiary-500 hover:bg-tertiary-50' : 'text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200'}`}
      >
        <PinIcon className="w-4 h-4" />
      </IconButton>

      <div className="mb-4">
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
                className="text-xl font-thin text-gray-900 dark:text-white truncate cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
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
                <PencilIcon className="w-4 h-4" />
              </IconButton>
            </div>
          )}
        </div>
      </div>

      <div className="flex space-x-6 items-center">
        {/* Board Info (right column) */}
        <div className="flex flex-col flex-1 w-full items-start">
          {/* Shared with/by info */}
          <div className="mb-2 flex items-center gap-2">
            {board.shared && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-semibold">Shared</span>
            )}
          </div>
          {board.shared && (
            <div className="mb-1 text-xs text-gray-500 dark:text-gray-400">Invited by: {board.invited_by || 'unknown'}</div>
          )}
          {/* Board Stats */}
          <div className="flex flex space-x-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
            <div className="flex items-center gap-1">
              <span className="flex items-center justify-center w-8 h-8 text-lg font-fredoka font-medium bg-primary-100 dark:bg-primary-900 rounded-full text-primary-500 dark:text-primary-200">{board.nodeCount}</span>
              <span className="">nodes</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="flex items-center justify-center w-8 h-8 text-lg font-fredoka font-medium bg-primary-100 dark:bg-primary-900 rounded-full text-primary-500 dark:text-primary-200">{board.edgeCount}</span>
              <span className="">connections</span>
            </div>
          </div>
          {/* Last Modified */}
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {formatDate(board.lastModified)}
          </p>
        </div>

        {/* Board Thumbnail */}
        <div className="mb-2 flex flex-col justify-items-start">
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
      <div className="col-span-2 mt-4 flex items-center justify-between gap-2">
        <Button
          variant="secondary"
          onClick={e => { e.stopPropagation(); setShowShareModal(true) }}
          className="text-xs px-2 py-1"
          title="Share board"
        >
          Share
        </Button>
        {/* Edit button removed; inline edit via title icon */}
        <Button
          variant="dangerGhost"
          onClick={e => { e.stopPropagation(); setShowDeleteModal(true) }}
          className="text-xs px-2 py-1"
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
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)} className="text-sm px-3 py-1.5">
            Cancel
          </Button>
          <Button variant="danger" onClick={() => { setShowDeleteModal(false); onDelete() }} className="text-sm px-3 py-1.5">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Share link</label>
            <div className="flex gap-2">
              <TextInput readOnly value={shareLink} fullWidth />
              <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(shareLink) }} className="text-sm px-3 py-2">
                Copy
              </Button>
            </div>
          </div>

          {/* Share by email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Invite by email</label>
            <div className="flex gap-2">
              <TextInput
                type="email"
                placeholder="Add email and press Enter"
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
              <Button
                variant="secondary"
                onClick={() => {
                  const email = shareInput.trim()
                  if (email && !shareEmails.includes(email)) {
                    setShareEmails(prev => [...prev, email])
                    setShareInput('')
                  }
                }}
                className="text-sm px-3 py-2"
              >
                Add
              </Button>
            </div>
            {shareEmails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {shareEmails.map(email => (
                  <span key={email} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                    {email}
                    <button
                      onClick={() => setShareEmails(prev => prev.filter(e => e !== email))}
                      className="ml-1 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowShareModal(false)} className="text-sm px-3 py-1.5">
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
              className="text-sm px-3 py-1.5"
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
    <div className="relative min-h-screen pt-16 flex flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900" />
      </div>
      <div className="w-full max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        {/* Welcome + Stats Open */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-1 rounded-xl ">
            <h1 className="mb-4 text-xl md:text-5xl font-fredoka font-medium text-gray-900 dark:text-white">
              <span className="font-normal">Welcome back</span>{greetingName ? `, ${greetingName}` : ''}!
            </h1>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-400">
              Pick up where you left off or create something new.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="relative rounded-lg p-4 bg-white/80 dark:bg-gray-900/60 border border-primary-500/80 dark:border-primary-700/80">
              <div className="flex absolute top-4 right-4 items-center text-primary-500/80">
                <CircuitBoard size={32} />
              </div>
              <div className="font-fredoka font-semibold lowercase tracking-wide text-gray-500 dark:text-gray-400">Boards</div>
              <div className="text-4xl font-medium text-gray-900 dark:text-white">{boards.length}</div>
            </div>
            <div className="relative rounded-lg p-4 bg-white/80 dark:bg-gray-900/60 border border-secondary-500/80 dark:border-secondary-700/80">
              <div className="flex absolute top-4 right-4 items-center text-secondary-500/80">
                <Users size={32} />
              </div>
              <div className="font-fredoka font-semibold lowercase tracking-wide text-gray-500 dark:text-gray-400">Shared</div>
              <div className="text-4xl font-medium text-gray-900 dark:text-white">{sharedBoards.length}</div>
            </div>
            <div className="relative rounded-lg p-4 bg-white/80 dark:bg-gray-900/60 border border-tertiary-500/80 dark:border-tertiary-700/80">
              <div className="flex absolute top-4 right-4 items-center text-tertiary-500/80">
                <FileText size={32} />
              </div>
              <div className="font-fredoka font-semibold lowercase tracking-wide text-gray-500 dark:text-gray-400">Documents</div>
              <div className="text-4xl font-medium text-gray-900 dark:text-white">{statsLoading ? '—' : totalDocuments}</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 mt-16">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Boards</h2>

          <Button onClick={handleNewBoardClick} className="flex items-center gap-2 bg-tertiary-500 hover:bg-tertiary-600 text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Board</span>
          </Button>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <input
            type="text"
            placeholder="Search boards..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 rounded-4xl bg-white/80 border-0 dark:bg-gray-950/50 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <Checkbox
            label="Show shared only"
            checked={showSharedOnly}
            onChange={(v) => setShowSharedOnly(v)}
            labelTextClassName='text-sm text-gray-500 dark:text-gray-400'
          />
        </div>
        {error && (
          <div className="mb-4 text-red-600 dark:text-red-400">{error}</div>
        )}
        {loading ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <Loader />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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