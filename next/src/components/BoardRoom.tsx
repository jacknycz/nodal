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
import { Graph, TreeStructure, UserCircle, Users } from '@phosphor-icons/react/dist/ssr'
import Search from './ui/Search'
import { Tab, Tabs } from './ui/Tabs'
import ProfileTab from './ProfileTab'
import dynamic from 'next/dynamic'
import BoardCard from './BoardCard'
import ConnectionsSidebar from './ConnectionsSidebar'
import TasksSidebar from './TasksSidebar'
import BoardsTab from './BoardsTab'
// Gradient background only (no external images)
import Tooltip from './ui/Tooltip'
import Toast from './ui/Toast'
import { getSupabaseClient } from '../features/auth/supabaseClient'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import DateInput from './ui/DateInput'
import TipTapEditor from './TipTapEditor'
import { PencilSimple, Plus } from '@phosphor-icons/react/dist/ssr'

interface BoardRoomProps {
  onOpenBoard: (board: SavedBoard | null, brief?: BoardBrief | null) => void;
}

type SharedBoard = SavedBoard & { shared?: boolean; invited_by?: string }

const BoardRoom: React.FC<BoardRoomProps> = ({ onOpenBoard }) => {
  const SHOW_COMMUNITY = false
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
  const [tabPath, setTabPath] = useState<string>(typeof window !== 'undefined' ? (window.location.pathname || '/boards') : '/boards')
  const hasAnyBoards = (Array.isArray(boards) ? boards.length : 0) + (Array.isArray(sharedBoards) ? sharedBoards.length : 0) > 0
  const canShowTemplatesHint = !loading && !hasAnyBoards

  // Derive active tab key from path
  type TabKey = 'boards' | 'templates' | 'community' | 'profile'
  const getActiveTab = (p: string): TabKey => {
    const seg = (p.replace(/^\/+/, '').toLowerCase().split('/')[0]) || 'boards'
    return (['boards', 'templates', 'community', 'profile'] as const).includes(seg as TabKey) ? seg as TabKey : 'boards'
  }
  const activeTab: TabKey = getActiveTab(tabPath)

  // Sidebar helper for per-tab widget visibility
  const SidebarSection: React.FC<{ showOn: TabKey[]; children: React.ReactNode }> = ({ showOn, children }) => {
    return showOn.includes(activeTab) ? <>{children}</> : null
  }
  const [templatesLoading, setTemplatesLoading] = useState<boolean>(false)
  const [templatesError, setTemplatesError] = useState<string | null>(null)
  const templatesRef = useRef<TemplateRecord[] | null>(null)
  const [tasksLoading, setTasksLoading] = useState<boolean>(false)
  const [incompleteTasks, setIncompleteTasks] = useState<Array<{ boardId: string; boardName: string; nodeId: string; title: string }>>([])
  const incompleteTasksRef = useRef<Array<{ boardId: string; boardName: string; nodeId: string; title: string }> | null>(null)

  // New board flow states
  const [showBoardSetup, setShowBoardSetup] = useState(false)
  const [upgradeToast, setUpgradeToast] = useState(false)
  // Nodal News
  type NewsArticle = { id: string; title: string; content: string; published: boolean; created_at: string }
  const [news, setNews] = useState<NewsArticle[]>([])
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsError, setNewsError] = useState<string | null>(null)
  const [showNewsModal, setShowNewsModal] = useState(false)
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null)
  const [newsTitle, setNewsTitle] = useState('')
  const [newsContent, setNewsContent] = useState('')
  const [newsPublished, setNewsPublished] = useState(true)
  const [newsSaving, setNewsSaving] = useState(false)
  const [newsDate, setNewsDate] = useState<string>('')
  const [showDeleteNews, setShowDeleteNews] = useState(false)

  // Handle Stripe success return: verify and refresh session
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const success = url.searchParams.get('upgrade') === 'success'
      const sessionId = url.searchParams.get('session_id')
      if (!success || !sessionId) return
      (async () => {
        try {
          const supa = getSupabaseClient()
          const { data } = await supa.auth.getSession()
          const token = data?.session?.access_token
          const res = await fetch(`/api/billing/verify?session_id=${encodeURIComponent(sessionId)}`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} })
          if (res.ok) {
            try { await supa.auth.refreshSession() } catch {}
            setUpgradeToast(true)
          }
        } finally {
          // Clean params
          url.searchParams.delete('upgrade')
          url.searchParams.delete('session_id')
          window.history.replaceState({}, '', url.toString())
        }
      })()
    } catch {}
  }, [])

  // Load Nodal News
  useEffect(() => {
    const loadNews = async () => {
      try {
        setNewsLoading(true)
        setNewsError(null)
        const supa = getSupabaseClient()
        const base = supa.from('nodal_news').select('id,title,content,published,created_at').order('created_at', { ascending: false })
        const { data, error } = isAdmin(user) ? await base : await base.eq('published', true).limit(3)
        if (error) throw error
        setNews((data || []) as any)
      } catch (e: any) {
        setNewsError(e?.message || 'Failed to load news')
        setNews([])
      } finally {
        setNewsLoading(false)
      }
    }
    loadNews()
  }, [user])

  const openCreateArticle = () => {
    setEditingArticle(null)
    setNewsTitle('')
    setNewsContent('')
    setNewsPublished(true)
    try { setNewsDate(new Date().toISOString().slice(0,10)) } catch { setNewsDate('') }
    setShowNewsModal(true)
  }

  const openEditArticle = (a: NewsArticle) => {
    setEditingArticle(a)
    setNewsTitle(a.title || '')
    setNewsContent(a.content || '')
    setNewsPublished(!!a.published)
    try { setNewsDate(new Date(a.created_at).toISOString().slice(0,10)) } catch { setNewsDate('') }
    setShowNewsModal(true)
  }

  const saveArticle = async () => {
    try {
      setNewsSaving(true)
      const supa = getSupabaseClient()
      const payload: any = {
        title: newsTitle.trim() || 'Untitled',
        content: newsContent || '',
        published: !!newsPublished,
        ...(newsDate ? { created_at: new Date(newsDate).toISOString() } : {})
      }
      if (editingArticle?.id) payload.id = editingArticle.id
      const { data, error } = await supa.from('nodal_news').upsert(payload, { onConflict: 'id' }).select('*').limit(1)
      if (error) throw error
      // Refresh list
      const created = (data || [])[0] as NewsArticle | undefined
      if (created) {
        // Optimistic: merge/replace in list
        setNews(prev => {
          const idx = prev.findIndex(x => x.id === created.id)
          if (idx >= 0) {
            const copy = [...prev]
            copy[idx] = created
            return copy
          }
          return [created, ...prev].sort((a,b) => (b.created_at || '').localeCompare(a.created_at || ''))
        })
      }
      setShowNewsModal(false)
    } catch (e) {
      alert((e as any)?.message || 'Failed to save')
    } finally {
      setNewsSaving(false)
    }
  }

  const deleteArticle = async () => {
    if (!editingArticle?.id) return
    try {
      setNewsSaving(true)
      const supa = getSupabaseClient()
      const { error } = await supa.from('nodal_news').delete().eq('id', editingArticle.id)
      if (error) throw error
      setNews(prev => prev.filter(x => x.id !== editingArticle.id))
      setShowDeleteNews(false)
      setShowNewsModal(false)
    } catch (e) {
      alert((e as any)?.message || 'Failed to delete')
    } finally {
      setNewsSaving(false)
    }
  }

  const loadBoards = async () => {
    try {
      // mark start of board load for perf debugging
      try { performance.mark('loadBoards-start') } catch { }
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
      try { performance.mark('loadBoards-end') } catch { }
      try { performance.measure('loadBoards', 'loadBoards-start', 'loadBoards-end'); console.log('perf: loadBoards', performance.getEntriesByName('loadBoards')[0]?.duration) } catch { }
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

  // Track selected tab via path to conditionally show sections
  useEffect(() => {
    const onPop = () => setTabPath(window.location.pathname || '/boards')
    const onTabChanged = (e: Event) => {
      try {
        const label = String((e as CustomEvent).detail?.label || '').toLowerCase()
        if (label) setTabPath(`/${label}`)
      } catch { }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', onPop)
      window.addEventListener('nodal:tab-changed', onTabChanged as any)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', onPop)
        window.removeEventListener('nodal:tab-changed', onTabChanged as any)
      }
    }
  }, [])

  // Load templates (public)
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        try { performance.mark('loadTemplates-start') } catch { }
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
        try { performance.mark('loadTemplates-end') } catch { }
        try { performance.measure('loadTemplates', 'loadTemplates-start', 'loadTemplates-end'); console.log('perf: loadTemplates', performance.getEntriesByName('loadTemplates')[0]?.duration) } catch { }
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
          ; (window as any).requestIdleCallback(() => resolve(), { timeout: 1000 })
        } else {
          setTimeout(() => resolve(), 50)
        }
      })

      try {
        try { performance.mark('computeTasks-start') } catch { }
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

        try { performance.mark('computeTasks-end') } catch { }
        try { performance.measure('computeTasks', 'computeTasks-start', 'computeTasks-end'); console.log('perf: computeTasks', performance.getEntriesByName('computeTasks')[0]?.duration) } catch { }
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
    // Show loader immediately; delete can take a second
    setLoading(true)
    try {
      const { boardStorage } = await import('../features/storage/storage')
      await boardStorage.deleteBoard(boardId)
      await loadBoards()
    } catch {
      setError('Failed to delete board')
    } finally {
      // loadBoards() toggles loading as well; ensure it's not stuck
      setLoading(false)
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
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-white dark:bg-black" aria-hidden>
        <div className="absolute left-0 right-0 top-0 h-[200dvh]">
          <div className="absolute inset-0 
          bg-gradient-to-br from-gray-200 via-gray-100 to-gray-200 
          dark:from-gray-950 dark:via-primary-950 dark:to-gray-950" />
        </div>
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
      <div className="relative flex flex-col lg:flex-row mx-4 md:mx-6 lg:mx-8 z-20 
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
            headerLabel={
              <div className="relative inline-flex items-center">
                {canShowTemplatesHint ? (
                  <Tooltip content="Start here!" side="top" variant="danger" open>
                    <span>templates</span>
                  </Tooltip>
                ) : (
                  <span>templates</span>
                )}
              </div>
            }
            icon={<svg width="44" height="44" className="h-6 w-6" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path opacity="0.2" d="M38.5 9.625V34.375C38.5 34.7397 38.3551 35.0894 38.0973 35.3473C37.8394 35.6051 37.4897 35.75 37.125 35.75H6.875C6.51033 35.75 6.16059 35.6051 5.90273 35.3473C5.64487 35.0894 5.5 34.7397 5.5 34.375V9.625C5.5 9.26033 5.64487 8.91059 5.90273 8.65273C6.16059 8.39487 6.51033 8.25 6.875 8.25H37.125C37.4897 8.25 37.8394 8.39487 38.0973 8.65273C38.3551 8.91059 38.5 9.26033 38.5 9.625Z" fill="currentColor" />
              <path d="M37.125 6.875C37.8543 6.875 38.5536 7.16494 39.0693 7.68066C39.5851 8.19639 39.875 8.89566 39.875 9.625V34.375C39.875 35.1043 39.5851 35.8036 39.0693 36.3193C38.5536 36.8351 37.8543 37.125 37.125 37.125H6.875C6.14565 37.125 5.44639 36.8351 4.93066 36.3193C4.41494 35.8036 4.125 35.1043 4.125 34.375V9.625C4.125 8.89565 4.41494 8.19639 4.93066 7.68066C5.44639 7.16494 6.14565 6.875 6.875 6.875H37.125ZM6.875 34.375H37.125V9.625H6.875V34.375ZM24.1025 18.0049C24.573 18.0528 24.9472 18.427 24.9951 18.8975C24.9985 18.9312 25 18.9654 25 19V29C25 29.0346 24.9985 29.0688 24.9951 29.1025C24.9472 29.573 24.573 29.9472 24.1025 29.9951C24.0688 29.9985 24.0346 30 24 30H14C13.4823 30 13.0562 29.6067 13.0049 29.1025C13.0015 29.0688 13 29.0346 13 29V19C13 18.4477 13.4477 18 14 18H24C24.0346 18 24.0688 18.0015 24.1025 18.0049ZM16 27H22V21H16V27ZM29 13C29.0346 13 29.0688 13.0015 29.1025 13.0049C29.573 13.0528 29.9472 13.427 29.9951 13.8975C29.9985 13.9312 30 13.9654 30 14V24C30 24.5523 29.5523 25 29 25H28C27.4477 25 27 24.5523 27 24V16H19C18.4477 16 18 15.5523 18 15V14C18 13.4477 18.4477 13 19 13H29Z" fill="currentColor" />
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

          {/* TAB 3 - Community (temporarily hidden for launch) */}
          {SHOW_COMMUNITY && (
            <Tab
              label="community"
              icon={<Users size={44} className="h-6 w-6" weight="duotone" />}
            >
              <CommunityTab />
            </Tab>
          )}

          {/* TAB 4 */}
          <Tab
            label="profile"
            icon={<UserCircle size={44} className="h-6 w-6" weight="duotone" />}
          >
            <ProfileTab />
          </Tab>
        </Tabs>

        {/* SIDEBAR */}
        <div className="w-full lg:w-96 lg:min-w-[24rem] lg:max-w-[24rem] flex-none shrink-0 mt-8 lg:-mt-16 lg:min-h-screen rounded-t-4xl bg-white dark:bg-slate-950/90 
        p-6 shadow-2xl shadow-gray-400/20 dark:shadow-primary-950/70 lg:sticky lg:top-12 self-start z-30" style={{ scrollbarGutter: 'stable' }}>
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

          <SidebarSection showOn={['boards', 'profile']}>
            <TasksSidebar
              incompleteTasks={incompleteTasks}
              tasksLoading={tasksLoading}
              allBoards={allBoards}
              onOpenBoard={onOpenBoard}
            />
          </SidebarSection>

          <SidebarSection showOn={['boards']}>
            <div className="flex flex-col gap-3 mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-medium font-fredoka text-gray-900 dark:text-white">nodal news</h2>
                {isAdmin(user) && (
                  <Button size="sm" variant="secondary" onClick={openCreateArticle}><Plus className="w-4 h-4 mr-1" />Add article</Button>
                )}
              </div>
              {newsLoading && <div className="text-xs text-gray-500 dark:text-gray-400">Loading…</div>}
              {newsError && <div className="text-xs text-red-600 dark:text-red-400">{newsError}</div>}
              {!newsLoading && news.length === 0 && (
                <div className="text-xs text-gray-500 dark:text-gray-400">No articles yet.</div>
              )}
              <div className="flex flex-col gap-3">
                {news.map((a) => (
                  <div key={a.id} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white truncate">{a.title || 'Untitled'}</div>
                        <div className="text-[11px] text-gray-500 dark:text-gray-400">{new Date(a.created_at).toLocaleDateString()}</div>
                      </div>
                      {isAdmin(user) && (
                        <Button size="sm" variant="secondary" onClick={() => openEditArticle(a)}><PencilSimple className="w-3 h-3 mr-1" />Edit</Button>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-700 dark:text-gray-300 tiptap-content" dangerouslySetInnerHTML={{ __html: a.content || '' }} />
                    {isAdmin(user) && !a.published && (
                      <div className="mt-2 inline-block text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">Draft</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </SidebarSection>
          
          <SidebarSection showOn={['profile']}>
            <ConnectionsSidebar />
          </SidebarSection>
        </div>
      </div>

      {/* Sophisticated board setup modal */}
      <BoardSetupModal
        isOpen={showBoardSetup}
        onComplete={handleBoardSetupComplete}
        onClose={handleCancelSetup}
      />

      {/* Nodal News Modal */}
      <Modal
        open={showNewsModal}
        onClose={() => { if (!newsSaving) setShowNewsModal(false) }}
        title={editingArticle ? 'Edit Article' : 'Add Article'}
        actions={
          <div className="w-full flex items-center justify-between">
            <div>
              {editingArticle && (
                <Button variant="danger" onClick={() => setShowDeleteNews(true)} disabled={newsSaving}>Delete</Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setShowNewsModal(false)} disabled={newsSaving}>Cancel</Button>
              <Button onClick={saveArticle} loading={newsSaving}>Save</Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <TextInput label="Title" value={newsTitle} onChange={(e) => setNewsTitle((e.target as HTMLInputElement).value)} fullWidth required />
          <DateInput label="Date" value={newsDate} onChange={(e) => setNewsDate((e.target as HTMLInputElement).value)} fullWidth required />
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Content</div>
            <TipTapEditor content={newsContent} onChange={setNewsContent} />
          </div>
          <Checkbox checked={newsPublished} onChange={setNewsPublished} label="Published" />
        </div>
      </Modal>

      {/* Confirm Delete Article */}
      <Modal
        open={showDeleteNews}
        onClose={() => setShowDeleteNews(false)}
        title="Delete article"
        description="Are you sure you want to delete this article? This cannot be undone."
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowDeleteNews(false)} disabled={newsSaving}>Cancel</Button>
            <Button variant="danger" onClick={deleteArticle} loading={newsSaving}>Delete</Button>
          </>
        }
      >
        <div className="text-sm text-gray-600 dark:text-gray-300">{editingArticle?.title}</div>
      </Modal>
      <Toast open={upgradeToast} onClose={() => setUpgradeToast(false)} variant="success">Welcome to Pro!</Toast>
    </div>
  )
}

export default BoardRoom 