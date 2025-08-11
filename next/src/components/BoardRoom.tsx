'use client'
import { useState, useEffect, useRef } from 'react'
import type { SavedBoard } from '../features/storage/storage'
import type { BoardBrief } from '../features/board/boardTypes'
import BoardNameModal from './BoardNameModal'
import BoardSetupModal from './BoardSetupModal'
import Loader from './ui/Loader'
import { useSupabaseUser } from '../features/auth/authUtils'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import Button from './ui/Button'
import IconButton from './ui/IconButton'
import { PencilIcon } from 'lucide-react'

interface BoardRoomProps {
  onOpenBoard: (board: SavedBoard | null, brief?: BoardBrief | null) => void;
}

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
        console.log('Updating thumbnail URL:', newUrl);
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

  const commitTitleEdit = () => {
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
  }

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
  }, [isEditingTitle, newName, originalName])

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
      className="group relative grid grid-cols-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950/50 hover:border-gray-300 dark:hover:bg-gray-600 p-4 rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer"
      onClick={handleCardClick}
    >

      {/* Title row (full width) */}
      <div className="col-span-2 mb-2 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
        {isEditingTitle ? (
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
            fullWidth
            maxLength={50 as any}
          />
        ) : (
          <h3 className="w-full text-lg font-semibold text-gray-900 dark:text-white truncate">{newName}</h3>
        )}
        {!isEditingTitle && (
          <IconButton
            aria-label="Edit title"
            onClick={(e) => { e.stopPropagation(); setOriginalName(newName); setIsEditingTitle(true) }}
            className="ml-2"
          >
            <PencilIcon className="w-4 h-4" />
          </IconButton>
        )}
      </div>

      {/* Board Info (left column) */}
      <div className="flex flex-col items-start">
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
        <div className="flex flex-col text-sm text-gray-500 dark:text-gray-400 mb-2">
          <span>{board.nodeCount} nodes</span>
          <span>{board.edgeCount} connections</span>
        </div>
        {/* Last Modified */}
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {formatDate(board.lastModified)}
        </p>
        {/* Action Buttons - persistent bottom row */}
        <div className="col-span-2 mt-3 flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={e => { e.stopPropagation(); setShowShareModal(true) }}
            className="text-xs px-2 py-1"
            title="Share board"
          >
            Share
          </Button>
          <Button
            variant="secondary"
            onClick={e => { e.stopPropagation(); onTogglePin() }}
            className="text-xs px-2 py-1"
            title={isPinned ? 'Unpin board' : 'Pin board'}
          >
            {isPinned ? 'Unpin' : 'Pin'}
          </Button>
          {/* Edit button removed; inline edit via title icon */}
          <Button
            variant="danger"
            onClick={e => { e.stopPropagation(); setShowDeleteModal(true) }}
            className="text-xs px-2 py-1"
            title="Delete board"
          >
            Delete
          </Button>
        </div>
      </div>

      {/* Board Thumbnail */}
      <div className="mb-2 w-full flex justify-center items-center">
        {loading && (
          <div className="flex items-center justify-center w-32 h-32 bg-gray-100 dark:bg-gray-900 rounded animate-pulse">
            <span className="text-gray-400 text-xs">Generating...</span>
          </div>
        )}
        {!loading && !imgError && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt="Board thumbnail"
            className="rounded shadow max-h-32 max-w-full object-cover bg-gray-100 dark:bg-gray-900"
            style={{ minHeight: 64, minWidth: 64, background: '#f3f4f6' }}
            onError={() => {
              setImgError(true);
            }}
          />
        ) : (
          <div
            className="w-32 h-32 rounded shadow flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-gray-800 dark:to-gray-700"
            style={{ minHeight: 64, minWidth: 64 }}
          >
            <span className="text-lg font-semibold text-gray-700 dark:text-gray-200 select-none">
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
  const [sharedBoards, setSharedBoards] = useState<any[]>([])
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
  const [boardBrief, setBoardBrief] = useState<BoardBrief | null>(null)

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
      // Compute total documents across all boards (owned + shared)
      try {
        setStatsLoading(true)
        const allIds = [
          ...loadedBoards.map(b => b.id),
          ...((Array.isArray((await (user?.email ? fetch(`/api/board/shared?email=${encodeURIComponent(user!.email)}`) : null))?.json) ? [] : []) as any)
        ]
        // Fallback: rely on state after sharedBoards set in next tick
      } catch {}
    } catch (err) {
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
    } catch {}
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
          ...sharedBoards.map((b: any) => b.id)
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
      try { localStorage.setItem('pinnedBoards', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const handleRename = async (boardId: string, newName: string) => {
    // Optimistic update: avoid full reload/loader flicker
    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, name: newName, lastModified: Date.now() } : b))
    setSharedBoards(prev => prev.map((b: any) => b.id === boardId ? { ...b, name: newName, lastModified: Date.now() } : b))
    try {
      const { boardStorage } = await import('../features/storage/storage')
      await boardStorage.renameBoard(boardId, newName)
    } catch (err) {
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
    } catch (err) {
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
    } catch (error) {
      console.error('Failed to create new board:', error)
      setError('Failed to create new board')
    }
  }

  // Handle board setup completion (now creates the board directly)
  const handleBoardSetupComplete = (brief: BoardBrief) => {
    setBoardBrief(brief)
    setShowBoardSetup(false)
    onOpenBoard(null, brief) // Pass brief to App/Board
  }

  // Handle cancellation of any modal in the flow
  const handleCancelSetup = () => {
    setShowBoardSetup(false)
    setBoardBrief(null)
  }

  const handleNewBoardClick = () => {
    setShowBoardSetup(true)
  }

  const allBoards = [...boards, ...sharedBoards]
  const filteredBoards = allBoards
    .filter(board =>
      board.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .filter(board => !showSharedOnly || (board as any).shared === true)

  // Sort: pinned first, then by lastModified desc
  const sortedBoards = [...filteredBoards].sort((a, b) => {
    const aPinned = pinnedBoardIds.includes(a.id)
    const bPinned = pinnedBoardIds.includes(b.id)
    if (aPinned && !bPinned) return -1
    if (!aPinned && bPinned) return 1
    return (b.lastModified || 0) - (a.lastModified || 0)
  })

  return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col">
      <div className="w-full max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
        {/* Welcome + Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1 md:col-span-2 rounded-xl p-5 bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">
              Welcome back{user ? `, ${
                (user.user_metadata?.full_name as string) ||
                (user.user_metadata?.name as string) ||
                (user.email ? (user.email as string).split('@')[0] : '')
              }` : ''}!
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Pick up where you left off or create something new.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg p-4 bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Boards</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{boards.length}</div>
            </div>
            <div className="rounded-lg p-4 bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Shared</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{sharedBoards.length}</div>
            </div>
            <div className="rounded-lg p-4 bg-white/80 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700 text-center">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Documents</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{statsLoading ? '—' : totalDocuments}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Boards</h2>
          <button
            onClick={handleNewBoardClick}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>New Board</span>
          </button>
        </div>
        
        <div className="mb-6 flex items-center gap-4">
          <input
            type="text"
            placeholder="Search boards..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full max-w-md px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <label className="flex items-center gap-2 select-none text-sm text-gray-700 dark:text-gray-200">
            <input
              type="checkbox"
              checked={showSharedOnly}
              onChange={e => setShowSharedOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Show shared only
          </label>
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