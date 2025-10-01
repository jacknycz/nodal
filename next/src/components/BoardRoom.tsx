'use client'
import { useState, useEffect, useDeferredValue, useRef, startTransition } from 'react'
import type { SavedBoard } from '../features/storage/storage'
import type { BoardBrief } from '../features/board/boardTypes'
import BoardSetupModal from './BoardSetupModal'
import Loader from './ui/Loader'
import { templateStorage, type TemplateRecord } from '../features/storage/templateStorage'
import { isAdmin } from '../features/auth/roles'
import { useSupabaseUser } from '../features/auth/authUtils'
import Checkbox from './ui/Checkbox'
import Button from './ui/Button'
import { Graph, TreeStructure, Users } from '@phosphor-icons/react/dist/ssr'
import Search from './ui/Search'
import { Tab, Tabs } from './ui/Tabs'
import dynamic from 'next/dynamic'
import BoardCard from './BoardCard'
import BoardsTab from './BoardsTab'
// Gradient background only (no external images)

interface BoardRoomProps {
  onOpenBoard: (board: SavedBoard | null, brief?: BoardBrief | null) => void;
}

type SharedBoard = SavedBoard & { shared?: boolean; invited_by?: string }

const BoardRoom: React.FC<BoardRoomProps> = ({ onOpenBoard }) => {
  const TemplatesTab = dynamic(() => import('./TemplatesTab'), {
    ssr: false,
    loading: () => (
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-12 py-10">
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Loader />
        </div>
      </div>
    ),
  })
  const CommunityTab = dynamic(() => import('./CommunityTab'), { ssr: false })
  const user = useSupabaseUser()
  const [boards, setBoards] = useState<SavedBoard[]>([])
  const [sharedBoards, setSharedBoards] = useState<SharedBoard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [pinnedBoardIds, setPinnedBoardIds] = useState<string[]>([])
  const [showSharedOnly, setShowSharedOnly] = useState(false)
  
  const [templates, setTemplates] = useState<TemplateRecord[]>([])
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(false)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const templatesRef = useRef<TemplateRecord[] | null>(null)
  const [tasksLoading, setTasksLoading] = useState<boolean>(false)
  const [incompleteTasks, setIncompleteTasks] = useState<Array<{ boardId: string; boardName: string; nodeId: string; title: string }>>([])
  const incompleteTasksRef = useRef<Array<{ boardId: string; boardName: string; nodeId: string; title: string }> | null>(null)

  // New board flow states
  const [showBoardSetup, setShowBoardSetup] = useState(false)

  const loadBoards = async () => {
    try {
      // mark start of board load for perf debugging
      try { performance.mark('loadBoards-start') } catch {}
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
      try { performance.mark('loadBoards-end') } catch {}
      try { performance.measure('loadBoards', 'loadBoards-start', 'loadBoards-end'); console.log('perf: loadBoards', performance.getEntriesByName('loadBoards')[0]?.duration) } catch {}
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
        try { performance.mark('loadTemplates-start') } catch {}
        setTemplatesLoading(true)
        setTemplatesError(null)
        const list = await templateStorage.getAllTemplates()
        // keep equality guard but also mark perf
        startTransition(() => {
          try {
            const prev = templatesRef.current
            const same = prev && prev.length === list.length && JSON.stringify(prev) === JSON.stringify(list)
            if (!same) {
              setTemplates(list)
              templatesRef.current = list
            }
          } catch {
        setTemplates(list)
            templatesRef.current = list
          }
        })
        try { performance.mark('loadTemplates-end') } catch {}
        try { performance.measure('loadTemplates', 'loadTemplates-start', 'loadTemplates-end'); console.log('perf: loadTemplates', performance.getEntriesByName('loadTemplates')[0]?.duration) } catch {}
      } catch {
        setTemplatesError('Failed to load templates')
      } finally {
        setTemplatesLoading(false)
      }
    }
    loadTemplates()
  }, [])

  // Compute incomplete task nodes across all boards (deferred and chunked to avoid blocking)
  useEffect(() => {
    const computeTasks = async () => {
      let cancelled = false
      const waitForIdle = () => new Promise<void>(resolve => {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          ;(window as any).requestIdleCallback(() => resolve(), { timeout: 1000 })
        } else {
          setTimeout(() => resolve(), 50)
        }
      })

      try {
        try { performance.mark('computeTasks-start') } catch {}
        setTasksLoading(true)
        // Use precomputed task summary from board.data.meta if available
        const all: Array<SavedBoard | SharedBoard> = [...boards, ...sharedBoards]
        const results: Array<{ boardId: string; boardName: string; nodeId: string; title: string } | null> = []

        for (const b of all) {
          if (cancelled) break
          await waitForIdle()
          const summary = (b as any)?.data?.meta?.taskSummary as Array<{ id: string; title: string; completed?: boolean }> | undefined
          if (Array.isArray(summary)) {
            for (let i = 0; i < summary.length; i++) {
              const t = summary[i]
              if (!t?.completed) {
                results.push({ boardId: b.id, boardName: b.name, nodeId: t.id, title: t.title || 'Untitled' })
              }
              if (i % 100 === 0) await waitForIdle()
            }
          } else {
            // Fallback: if no meta present, skip heavy fetch (leave for later refresh)
          }
        }

        if (!cancelled) {
          startTransition(() => {
            try {
              const compact = results.filter(Boolean) as Array<{ boardId: string; boardName: string; nodeId: string; title: string }>
              const prev = incompleteTasksRef.current
              const same = prev && prev.length === compact.length && JSON.stringify(prev) === JSON.stringify(compact)
              if (!same) {
                setIncompleteTasks(compact)
                incompleteTasksRef.current = compact
              }
            } catch {
              const compact = results.filter(Boolean) as Array<{ boardId: string; boardName: string; nodeId: string; title: string }>
              setIncompleteTasks(compact)
              incompleteTasksRef.current = compact
            }
          })
        }

        try { performance.mark('computeTasks-end') } catch {}
        try { performance.measure('computeTasks', 'computeTasks-start', 'computeTasks-end'); console.log('perf: computeTasks', performance.getEntriesByName('computeTasks')[0]?.duration) } catch {}
      } catch {
        if (!cancelled) setIncompleteTasks([])
      } finally {
        if (!cancelled) setTasksLoading(false)
      }
      return () => { cancelled = true }
    }

    if (loading) return
    let idleId: any
    let timeoutId: any
    const run = () => { void computeTasks() }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = (window as any).requestIdleCallback(run, { timeout: 2000 })
      return () => (window as any).cancelIdleCallback?.(idleId)
    } else {
      timeoutId = setTimeout(run, 0)
      return () => clearTimeout(timeoutId)
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
  const deferredSearch = useDeferredValue(searchQuery)
  const filteredBoards = allBoards
    .filter(board =>
      board.name.toLowerCase().includes(deferredSearch.toLowerCase())
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
    <div className="relative min-h-screen pt-12" role="main" aria-labelledby="welcome-heading">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden>
        <div className="absolute inset-0 
        bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 
        dark:from-gray-950 dark:via-primary-950 dark:to-gray-950" />
      </div>

      {/* Sticky Welcome Section */}
      <div className="sticky top-12 z-10">
        <div className="w-full mx-auto py-8 md:pt-8 pb-2 px-4 sm:px-6 lg:px-8">
          {/* Welcome + Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="col-span-1 rounded-xl">
              <h1 id="welcome-heading" className="mb-4 text-2xl md:text-3xl xl:text-4xl font-fredoka text-transform-lowercase font-medium text-gray-900 dark:text-white">
                <span className="font-normal">welcome to the boardroom</span>{greetingName ? `, ${greetingName}` : ''}
              </h1>
              {/* <p className="mt-1 text-sm text-gray-700 dark:text-gray-400">Pick up where you left off or create something new.</p> */}
            </div>

            {/* <div className="grid grid-cols-3 mt-4 md:mt-0 gap-2 md:gap-3">
              <div className="relative rounded-xl px-2 lg:px-4 py-2 lg:py-4 bg-white/80 dark:bg-gray-900/60 border border-primary-500/80 dark:border-primary-700/80">
                <div className="flex absolute bottom-2 lg:bottom-4 right-2 lg:right-4 w-8 h-8 lg:w-10 lg:h-10 items-center text-primary-500/80">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" aria-hidden="true">
                    <path opacity="0.2" d="M38.5 9.625V34.375C38.5 34.7397 38.3551 35.0894 38.0973 35.3473C37.8394 35.6051 37.4897 35.75 37.125 35.75H6.875C6.51033 35.75 6.16059 35.6051 5.90273 35.3473C5.64487 35.0894 5.5 34.7397 5.5 34.375V9.625C5.5 9.26033 5.64487 8.91059 5.90273 8.65273C6.16059 8.39487 6.51033 8.25 6.875 8.25H37.125C37.4897 8.25 37.8394 8.39487 38.0973 8.65273C38.3551 8.91059 38.5 9.26033 38.5 9.625Z" fill="currentColor" />
                    <path d="M37.125 6.875C37.8543 6.875 38.5536 7.16494 39.0693 7.68066C39.5851 8.19639 39.875 8.89566 39.875 9.625V34.375C39.875 35.1043 39.5851 35.8036 39.0693 36.3193C38.5536 36.8351 37.8543 37.125 37.125 37.125H6.875C6.14565 37.125 5.44639 36.8351 4.93066 36.3193C4.41494 35.8036 4.125 35.1043 4.125 34.375V9.625C4.125 8.89565 4.41494 8.19639 4.93066 7.68066C5.44639 7.16494 6.14565 6.875 6.875 6.875H37.125ZM6.875 34.375H37.125V9.625H6.875V34.375ZM16 28C16.5523 28 17 28.4477 17 29V31C17 31.5523 16.5523 32 16 32H10C9.44772 32 9 31.5523 9 31V29C9 28.4477 9.44772 28 10 28H16ZM34 28C34.5523 28 35 28.4477 35 29V31C35 31.5523 34.5523 32 34 32H28C27.4477 32 27 31.5523 27 31V29C27 28.4477 27.4477 28 28 28H34ZM25 20C25.5523 20 26 20.4477 26 21V23C26 23.5523 25.5523 24 25 24H19C18.4477 24 18 23.5523 18 23V21C18 20.4477 18.4477 20 19 20H25ZM31 11C31.5523 11 32 11.4477 32 12C32 12.5523 31.5523 13 31 13C30.4477 13 30 12.5523 30 12C30 11.4477 30.4477 11 31 11ZM34 11C34.5523 11 35 11.4477 35 12C35 12.5523 34.5523 13 34 13C33.4477 13 33 12.5523 33 12C33 11.4477 33.4477 11 34 11Z" fill="currentColor" />
                  </svg>
                </div>
                <div className="font-fredoka font-medium lowercase tracking-wide text-gray-500 dark:text-gray-400">Boards</div>
                <div className="text-2xl lg:text-4xl font-fredoka font-normal text-gray-900 dark:text-white">{boards.length}</div>
              </div>

              <div className="relative rounded-xl lg:rounded-xl p-2 lg:p-4 bg-white/80 dark:bg-gray-900/60 border border-secondary-500/80 dark:border-secondary-700/80">
                <div className="flex absolute bottom-2 lg:bottom-4 right-2 lg:right-4 w-8 h-8 lg:w-10 lg:h-10 items-center text-secondary-500/80" aria-hidden>
                  <Graph size={48} weight="duotone" aria-hidden />
                </div>
                <div className="font-fredoka font-semibold lowercase tracking-wide text-gray-500 dark:text-gray-400">nodes</div>
                <div className="text-2xl lg:text-4xl font-fredoka font-normal text-gray-900 dark:text-white">
                  {boards.reduce((total, board) => total + (board.nodeCount || 0), 0)}
                </div>
              </div>

              <div className="relative rounded-xl p-2 lg:p-4 bg-white/80 dark:bg-gray-900/60 border border-tertiary-500/80 dark:border-tertiary-700/80">
                <div className="flex absolute bottom-2 lg:bottom-4 right-2 lg:right-4 w-8 h-8 lg:w-10 lg:h-10 items-center text-tertiary-500/80" aria-hidden>
                  <TreeStructure size={48} weight="duotone" aria-hidden />
                </div>
                <div className="font-fredoka font-semibold lowercase tracking-wide text-gray-500 dark:text-gray-400">connections</div>
                <div className="text-2xl lg:text-4xl font-fredoka font-normal text-gray-900 dark:text-white">
                  {boards.reduce((total, board) => total + (board.edgeCount || 0), 0)}
                </div>
              </div>
            </div> */}
          </div>
        </div>
      </div>

      {/*
        ANNOYINGLY LARGE SEPERATOR (ALS) BETWEEN WELCOME AND BOARD CARDS JUST LIKE THE UI YEEEEAAAAHHHHH
      */}

      {/* Scrollable Board/Sidebar Section */}
      <div className="relative flex flex-col md:flex-row mx-4 md:mx-6 lg:mx-8 z-20 
      shadow dark:shadow-2xl dark:shadow-gray-950/70 
      backdrop-blur-sm bg-white/70 dark:bg-slate-950/70
      border-t border-gray-200/50 dark:border-gray-800/50 rounded-4xl">

        <Tabs>

          {/* TAB 1 */}
          <Tab
            label="boards"
            icon={<svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 ml-2">
              <path opacity="0.2" d="M38.5 9.625V34.375C38.5 34.7397 38.3551 35.0894 38.0973 35.3473C37.8394 35.6051 37.4897 35.75 37.125 35.75H6.875C6.51033 35.75 6.16059 35.6051 5.90273 35.3473C5.64487 35.0894 5.5 34.7397 5.5 34.375V9.625C5.5 9.26033 5.64487 8.91059 5.90273 8.65273C6.16059 8.39487 6.51033 8.25 6.875 8.25H37.125C37.4897 8.25 37.8394 8.39487 38.0973 8.65273C38.3551 8.91059 38.5 9.26033 38.5 9.625Z" fill="currentColor" />
              <path d="M37.125 6.875C37.8543 6.875 38.5536 7.16494 39.0693 7.68066C39.5851 8.19639 39.875 8.89566 39.875 9.625V34.375C39.875 35.1043 39.5851 35.8036 39.0693 36.3193C38.5536 36.8351 37.8543 37.125 37.125 37.125H6.875C6.14565 37.125 5.44639 36.8351 4.93066 36.3193C4.41494 35.8036 4.125 35.1043 4.125 34.375V9.625C4.125 8.89565 4.41494 8.19639 4.93066 7.68066C5.44639 7.16494 6.14565 6.875 6.875 6.875H37.125ZM6.875 34.375H37.125V9.625H6.875V34.375ZM16 28C16.5523 28 17 28.4477 17 29V31C17 31.5523 16.5523 32 16 32H10C9.44772 32 9 31.5523 9 31V29C9 28.4477 9.44772 28 10 28H16ZM34 28C34.5523 28 35 28.4477 35 29V31C35 31.5523 34.5523 32 34 32H28C27.4477 32 27 31.5523 27 31V29C27 28.4477 27.4477 28 28 28H34ZM25 20C25.5523 20 26 20.4477 26 21V23C26 23.5523 25.5523 24 25 24H19C18.4477 24 18 23.5523 18 23V21C18 20.4477 18.4477 20 19 20H25ZM31 11C31.5523 11 32 11.4477 32 12C32 12.5523 31.5523 13 31 13C30.4477 13 30 12.5523 30 12C30 11.4477 30.4477 11 31 11ZM34 11C34.5523 11 35 11.4477 35 12C35 12.5523 34.5523 13 34 13C33.4477 13 33 12.5523 33 12C33 11.4477 33.4477 11 34 11Z" fill="currentColor" />
            </svg>}
            // headerClassName="bg-white text-slate-900"
            // activeHeaderClassName="bg-white text-slate-900"
          >
            <BoardsTab
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              showSharedOnly={showSharedOnly}
              setShowSharedOnly={setShowSharedOnly}
              error={error}
              loading={loading}
              sortedBoards={sortedBoards}
              pinnedBoardIds={pinnedBoardIds}
              onOpenBoard={(b: any) => onOpenBoard(b, undefined)}
              onRename={handleRename}
              onDelete={handleDelete}
              togglePin={togglePin}
            />
          </Tab>

          {/* TAB 2 */}
          <Tab
            label="templates"
            icon={<svg width="44" height="44" className="h-6 w-6" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path opacity="0.2" d="M38.5 9.625V34.375C38.5 34.7397 38.3551 35.0894 38.0973 35.3473C37.8394 35.6051 37.4897 35.75 37.125 35.75H6.875C6.51033 35.75 6.16059 35.6051 5.90273 35.3473C5.64487 35.0894 5.5 34.7397 5.5 34.375V9.625C5.5 9.26033 5.64487 8.91059 5.90273 8.65273C6.16059 8.39487 6.51033 8.25 6.875 8.25H37.125C37.4897 8.25 37.8394 8.39487 38.0973 8.65273C38.3551 8.91059 38.5 9.26033 38.5 9.625Z" fill="currentColor"/>
              <path d="M37.125 6.875C37.8543 6.875 38.5536 7.16494 39.0693 7.68066C39.5851 8.19639 39.875 8.89566 39.875 9.625V34.375C39.875 35.1043 39.5851 35.8036 39.0693 36.3193C38.5536 36.8351 37.8543 37.125 37.125 37.125H6.875C6.14565 37.125 5.44639 36.8351 4.93066 36.3193C4.41494 35.8036 4.125 35.1043 4.125 34.375V9.625C4.125 8.89565 4.41494 8.19639 4.93066 7.68066C5.44639 7.16494 6.14565 6.875 6.875 6.875H37.125ZM6.875 34.375H37.125V9.625H6.875V34.375ZM24.1025 18.0049C24.573 18.0528 24.9472 18.427 24.9951 18.8975C24.9985 18.9312 25 18.9654 25 19V29C25 29.0346 24.9985 29.0688 24.9951 29.1025C24.9472 29.573 24.573 29.9472 24.1025 29.9951C24.0688 29.9985 24.0346 30 24 30H14C13.4823 30 13.0562 29.6067 13.0049 29.1025C13.0015 29.0688 13 29.0346 13 29V19C13 18.4477 13.4477 18 14 18H24C24.0346 18 24.0688 18.0015 24.1025 18.0049ZM16 27H22V21H16V27ZM29 13C29.0346 13 29.0688 13.0015 29.1025 13.0049C29.573 13.0528 29.9472 13.427 29.9951 13.8975C29.9985 13.9312 30 13.9654 30 14V24C30 24.5523 29.5523 25 29 25H28C27.4477 25 27 24.5523 27 24V16H19C18.4477 16 18 15.5523 18 15V14C18 13.4477 18.4477 13 19 13H29Z" fill="currentColor"/>
              </svg>              
              }
          >
            <TemplatesTab
              templates={templates}
              templatesLoading={templatesLoading}
              templatesError={templatesError}
              user={user}
              setTemplates={setTemplates}
              onOpenBoard={(b: any) => onOpenBoard(b, undefined)}
            />
          </Tab>

          {/* TAB 3 */}
          <Tab
            label="community"
            icon={<Users size={44} className="h-6 w-6" weight="duotone" />}
          >
            <CommunityTab />
          </Tab>
        </Tabs>
        
        {/* SIDEBAR */}
        <div className="w-full md:w-96 mt-8 md:-mt-16 min-h-screen rounded-t-4xl 
        bg-white dark:bg-slate-950/90 p-6 shadow-2xl shadow-gray-400/20 dark:shadow-primary-950/70 sticky top-12 self-start z-30">
          <div className="flex flex-none justify-end">
            <Button
              onClick={handleNewBoardClick}
              className="flex gap-3 w-full"
            >
              <span>new board</span>
              <svg width="44" height="44" className="mt-[1px] w-6 h-6 text-white" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path opacity="0.2" d="M38.5 9.625V34.375C38.5 34.7397 38.3551 35.0894 38.0973 35.3473C37.8394 35.6051 37.4897 35.75 37.125 35.75H6.875C6.51033 35.75 6.16059 35.6051 5.90273 35.3473C5.64487 35.0894 5.5 34.7397 5.5 34.375V9.625C5.5 9.26033 5.64487 8.91059 5.90273 8.65273C6.16059 8.39487 6.51033 8.25 6.875 8.25H37.125C37.4897 8.25 37.8394 8.39487 38.0973 8.65273C38.3551 8.91059 38.5 9.26033 38.5 9.625Z" fill="currentColor" />
                <path d="M37.125 6.875C37.8543 6.875 38.5536 7.16494 39.0693 7.68066C39.5851 8.19639 39.875 8.89566 39.875 9.625V34.375C39.875 35.1043 39.5851 35.8036 39.0693 36.3193C38.5536 36.8351 37.8543 37.125 37.125 37.125H6.875C6.14565 37.125 5.44639 36.8351 4.93066 36.3193C4.41494 35.8036 4.125 35.1043 4.125 34.375V9.625C4.125 8.89565 4.41494 8.19639 4.93066 7.68066C5.44639 7.16494 6.14565 6.875 6.875 6.875H37.125ZM6.875 34.375H37.125V9.625H6.875V34.375ZM23 16C23.5523 16 24 16.4477 24 17V20H27C27.5523 20 28 20.4477 28 21V23C28 23.5523 27.5523 24 27 24H24V27C24 27.5523 23.5523 28 23 28H21C20.4477 28 20 27.5523 20 27V24H17C16.4477 24 16 23.5523 16 23V21C16 20.4477 16.4477 20 17 20H20V17C20 16.4477 20.4477 16 21 16H23ZM31 11C31.5523 11 32 11.4477 32 12C32 12.5523 31.5523 13 31 13C30.4477 13 30 12.5523 30 12C30 11.4477 30.4477 11 31 11ZM34 11C34.5523 11 35 11.4477 35 12C35 12.5523 34.5523 13 34 13C33.4477 13 33 12.5523 33 12C33 11.4477 33.4477 11 34 11Z" fill="currentColor" />
              </svg>
            </Button>
          </div>

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
                    className="group text-left flex items-center justify-between gap-3 rounded-lg px-3 py-2 bg-white/80 dark:bg-gray-900/70 border border-gray-200/80 dark:border-gray-700/80 hover:bg-white dark:hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span aria-hidden className="inline-flex w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 group-hover:border-primary-400" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-[220px]">{t.title}</span>
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
            <span className="text-sm text-gray-500 dark:text-gray-400">Coming soon (for real, excited for this piece)</span>
          </div>
        </div>
      </div>

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