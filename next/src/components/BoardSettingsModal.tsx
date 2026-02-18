'use client'

import React, { useEffect, useRef, useState } from 'react'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import Select from './ui/Select'
import Range from './ui/Range'
import Button from './ui/Button'
import { boardStorage } from '../features/storage/storage'
import { useBoardStore } from '../features/board/boardSlice'
import BoardMembersRoleEditor from './BoardMembersRoleEditor'
import { useAISettingsStore } from '../features/ai/aiSettingsSlice'
import type { OpenAIModel } from '../features/ai/aiTypes'
import { MODELS } from '../features/ai/models'
import { AI_STYLE_OPTIONS, type AIStyleKey } from '../features/ai/aiStyle'
import Toggle from './ui/Toggle'
import { useTheme } from '../contexts/ThemeContext'
import ColorgoryManager from './ColorgoryManager'
import Tabs, { Tab } from './ui/Tabs'
import IconButton from './ui/IconButton'
import Toast from './ui/Toast'
import { useSupabaseUser } from '../features/auth/authUtils'
import Tag from './ui/Tag'
import { getSupabaseClient } from '../features/auth/supabaseClient'
import { isAdmin, useUserRole } from '../features/auth/roles'
import { getBoardTheme } from '../themes/board'

function toHexColor(raw: string): string | null {
  const v0 = String(raw || '').trim()
  if (!v0) return null
  let v = v0

  // Resolve var(--token) from :root if possible
  const m = v.match(/^var\((--[^)\s]+)\)$/)
  if (m && typeof window !== 'undefined') {
    try {
      const resolved = window.getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim()
      if (resolved) v = resolved
    } catch { }
  }

  // rgb/rgba → hex (ignore alpha)
  const rgb = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (rgb) {
    const r = Math.max(0, Math.min(255, Number(rgb[1] || 0)))
    const g = Math.max(0, Math.min(255, Number(rgb[2] || 0)))
    const b = Math.max(0, Math.min(255, Number(rgb[3] || 0)))
    const hex = (n: number) => n.toString(16).padStart(2, '0')
    return `#${hex(r)}${hex(g)}${hex(b)}`.toLowerCase()
  }

  // Normalize hex
  const hex = v.startsWith('#') ? v : `#${v}`
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(hex)) return null
  const h = hex.toLowerCase()
  if (h.length === 4) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`
  }
  if (h.length === 9) {
    // Drop alpha for <input type="color" />
    return h.slice(0, 7)
  }
  return h
}

interface Props {
  open: boolean
  onClose: () => void
  boardId: string
  initialName?: string
  isOwnerView?: boolean
  className?: string
  backdropClassName?: string
  backdropInteractive?: boolean
  closeOnBackdropClick?: boolean
}

export default function BoardSettingsModal({ open, onClose: onCloseRaw, boardId, initialName, isOwnerView = false, className, backdropClassName, backdropInteractive, closeOnBackdropClick }: Props) {
  // Using UI Tabs component instead of manual tabs
  const [pendingBoardName, setPendingBoardName] = useState(initialName || '')
  const edgeType = useBoardStore((s: any) => s.edgeType || 'floating')
  const setEdgeType = useBoardStore((s: any) => s.setEdgeType)
  const topic = useBoardStore((s: any) => s.topic || '')
  const setTopic = useBoardStore((s: any) => s.setTopic)
  const aiStyle = useBoardStore((s: any) => (s as any).aiStyle || 'balanced')
  const setAIStyle = useBoardStore((s: any) => (s as any).setAIStyle)
  const { model, setModel, temperature, setTemperature } = useAISettingsStore()
  const { isDark, setTheme } = useTheme()
  const user = useSupabaseUser()
  const supabase = getSupabaseClient()
  const { isPro, isAdmin: isAdminRole } = useUserRole()
  const admin = isAdmin(user) || isAdminRole
  const canThemeBoard = admin || (isOwnerView && isPro)
  const [pendingIsPublic, setPendingIsPublic] = useState<boolean>(false)
  const [loadedIsPublic, setLoadedIsPublic] = useState<boolean | null>(null)
  const [savingVisibility, setSavingVisibility] = useState(false)
  const [visibilityError, setVisibilityError] = useState<string | null>(null)
  const [pendingBoardTheme, setPendingBoardTheme] = useState<string>('default')
  const [loadedBoardTheme, setLoadedBoardTheme] = useState<string | null>(null)
  const [pendingBoardUiMode, setPendingBoardUiMode] = useState<'light' | 'dark'>('light')
  const [loadedBoardUiMode, setLoadedBoardUiMode] = useState<'light' | 'dark' | null>(null)
  const [pendingBoardThemeOverrides, setPendingBoardThemeOverrides] = useState<Record<string, string>>({})
  const [loadedBoardThemeOverrides, setLoadedBoardThemeOverrides] = useState<Record<string, string> | null>(null)
  const [advancedThemeOpen, setAdvancedThemeOpen] = useState(false)
  const [savingTheme, setSavingTheme] = useState(false)
  const [themeError, setThemeError] = useState<string | null>(null)
  const [gridEnabled, setGridEnabled] = useState<boolean>(true)
  const [pendingAIStyle, setPendingAIStyle] = useState<AIStyleKey>('balanced')
  const [demoCreating, setDemoCreating] = useState(false)
  const [demoError, setDemoError] = useState<string | null>(null)
  const [demoUrl, setDemoUrl] = useState<string>('')
  const [demoCopiedToast, setDemoCopiedToast] = useState(false)

  // Inline share/invite state (mirrors ShareBoardModal)
  const [shareInput, setShareInput] = useState('')
  const [selectedRole, setSelectedRole] = useState<'owner' | 'editor' | 'viewer'>('editor')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Array<{ id: string; username?: string | null; email?: string | null; avatar_url?: string | null }>>([])
  const [shareInvites, setShareInvites] = useState<Array<{ email: string; role: 'owner' | 'editor' | 'viewer' }>>([])
  const [shareError, setShareError] = useState<string | null>(null)
  const [showSentToast, setShowSentToast] = useState(false)

  // Snapshot current live-preview settings so Cancel/Escape/backdrop click can restore them.
  const previewSnapshotRef = useRef<{
    edgeType: string
    boardTheme: string
    boardUiMode: any
    boardThemeOverrides: any
  } | null>(null)

  useEffect(() => {
    if (!open) { previewSnapshotRef.current = null; return }
    try {
      const s: any = useBoardStore.getState()
      previewSnapshotRef.current = {
        edgeType: String(s?.edgeType || 'floating'),
        boardTheme: String(s?.boardTheme || 'default'),
        boardUiMode: s?.boardUiMode ?? null,
        boardThemeOverrides: s?.boardThemeOverrides ?? null,
      }
    } catch { }
  }, [open, boardId])

  const restorePreviewSnapshot = () => {
    const snap = previewSnapshotRef.current
    if (!snap) return
    try { useBoardStore.getState().setEdgeType?.(snap.edgeType as any) } catch { }
    try { useBoardStore.getState().setBoardTheme?.(snap.boardTheme as any) } catch { }
    try { useBoardStore.getState().setBoardUiMode?.(snap.boardUiMode as any) } catch { }
    try { useBoardStore.getState().setBoardThemeOverrides?.(snap.boardThemeOverrides as any) } catch { }
  }

  const handleCancelClose = () => {
    restorePreviewSnapshot()
    onCloseRaw()
  }

  useEffect(() => { if (open) setPendingBoardName(initialName || '') }, [open, initialName])
  // no local tab state

  useEffect(() => {
    if (!open || !boardId) return
      ; (async () => {
        try {
          let data: any = null
          let err: any = null
            ; ({ data, error: err } = await supabase.from('boards').select('is_public, ai_style, board_theme, board_ui_mode, board_theme_overrides').eq('id', boardId).maybeSingle() as any)
          // Backward-compatible fallback when schema hasn't been migrated yet
          if (err && (
            String(err?.message || '').toLowerCase().includes('board_theme') ||
            String(err?.message || '').toLowerCase().includes('board_ui_mode') ||
            String(err?.message || '').toLowerCase().includes('board_theme_overrides')
          )) {
            ; ({ data } = await supabase.from('boards').select('is_public, ai_style').eq('id', boardId).maybeSingle() as any)
          }
          const isPub = !!(data as any)?.is_public
          setPendingIsPublic(isPub)
          setLoadedIsPublic(isPub)
          const style = String((data as any)?.ai_style || 'balanced') as AIStyleKey
          setPendingAIStyle(style)
          try { setAIStyle?.(style) } catch { }
          const themeKey = String((data as any)?.board_theme || 'default')
          setPendingBoardTheme(themeKey)
          setLoadedBoardTheme(themeKey)
          const uiRaw = String((data as any)?.board_ui_mode || '').toLowerCase()
          const uiKey: any = (uiRaw === 'dark' || uiRaw === 'light') ? uiRaw : null
          setLoadedBoardUiMode(uiKey)
          setPendingBoardUiMode((uiKey as any) || 'light')
          const ovRaw = (data as any)?.board_theme_overrides
          const ov = (ovRaw && typeof ovRaw === 'object') ? (ovRaw as any) : null
          setLoadedBoardThemeOverrides(ov)
          setPendingBoardThemeOverrides(ov || {})
          try { useBoardStore.getState().setBoardThemeOverrides?.(ov || null) } catch { }
        } catch {
          setPendingIsPublic(false)
          setLoadedIsPublic(false)
          setPendingBoardTheme('default')
          setLoadedBoardTheme('default')
          setPendingBoardUiMode('light')
          setLoadedBoardUiMode(null)
          setPendingBoardThemeOverrides({})
          setLoadedBoardThemeOverrides(null)
        }
      })()
  }, [open, boardId, supabase])

  useEffect(() => {
    if (!open) return
    setVisibilityError(null)
    setSavingVisibility(false)
    setThemeError(null)
    setSavingTheme(false)
    setDemoCreating(false)
    setDemoError(null)
    setDemoUrl('')
  }, [open])

  // UX: collapse advanced overrides when switching base theme
  useEffect(() => {
    setAdvancedThemeOpen(false)
  }, [pendingBoardTheme])

  // Load grid setting from localStorage on open
  useEffect(() => {
    if (!open || !boardId) return
    try {
      const key = `nodal:board:${boardId}:gridEnabled`
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
      setGridEnabled(raw === null ? true : raw === 'true')
    } catch { setGridEnabled(true) }
  }, [open, boardId])

  useEffect(() => {
    if (!open) return
    setShareInput(''); setShareInvites([]); setShareError(null); setResults([])
  }, [open])

  useEffect(() => {
    const run = async () => {
      const q = shareInput.trim()
      if (q.length < 2) { setResults([]); return }
      setSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        const list = Array.isArray(json.results) ? json.results : []
        const existing = new Set(shareInvites.map(i => (i.email || '').toLowerCase()))
        setResults(list.filter((r: any) => r.id !== user?.id).filter((r: any) => !r.email || !existing.has(String(r.email).toLowerCase())))
      } catch { setResults([]) }
      finally { setSearching(false) }
    }
    const t = setTimeout(run, 250)
    return () => clearTimeout(t)
  }, [shareInput, user?.id, shareInvites])

  const isValidEmail = (e: string) => /[^@\s]+@[^@\s]+\.[^@\s]+/.test(e)
  const addEmail = (email: string) => {
    const e = (email || '').trim()
    if (!e || !isValidEmail(e)) { setShareError('Enter a valid email'); return }
    if (!shareInvites.some(inv => inv.email.toLowerCase() === e.toLowerCase())) {
      setShareInvites(prev => [...prev, { email: e, role: selectedRole }])
    }
    setShareInput(''); setShareError(null)
  }
  const shareLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/board/${boardId}`
  const handleSendInvites = async () => {
    setShareError(null)
    try {
      const invites = shareInvites.filter(i => isValidEmail(i.email))
      for (const { email, role } of invites) {
        await fetch('/api/board/invitations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boardId, email, role, invitedBy: user?.id, boardName: pendingBoardName || initialName, boardUrl: shareLink })
        })
      }
      try { window.dispatchEvent(new CustomEvent('nodal:board-members-updated', { detail: { boardId } })) } catch { }
      setShareInvites([]); setResults([])
      setShowSentToast(true); setTimeout(() => setShowSentToast(false), 1800)
    } catch { setShareError('Failed to send invites') }
  }

  const createDemoBoardCopy = async () => {
    setDemoError(null)
    setDemoCreating(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      if (!token) throw new Error('Not signed in')
      const resp = await fetch('/api/board/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ boardId }),
      })
      const json = await resp.json().catch(() => ({}))
      if (!resp.ok) throw new Error(json?.error || `Failed (${resp.status})`)
      const id = String(json?.id || '')
      if (!id) throw new Error('Missing demo board id')
      const url = `${window.location.origin}/board/${id}`
      setDemoUrl(url)
    } catch (e: any) {
      setDemoError(String(e?.message || 'Failed to create demo board'))
    } finally {
      setDemoCreating(false)
    }
  }

  const copyDemoLink = async () => {
    if (!demoUrl) return
    try {
      await navigator.clipboard.writeText(demoUrl)
      setDemoCopiedToast(true)
      setTimeout(() => setDemoCopiedToast(false), 1600)
      try { window.dispatchEvent(new CustomEvent('nodal:toast', { detail: { message: 'Demo link copied', variant: 'success' } })) } catch { }
    } catch {
      setDemoError('Failed to copy link')
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={handleCancelClose}
        // title="Board Settings"
        className={[
          // Transparent modal panel so the board stays visible behind settings.
          'bg-transparent dark:bg-transparent p-0 max-w-3xl!',
          className || '',
        ].filter(Boolean).join(' ')}
        backdropClassName={backdropClassName || 'bg-transparent'}
        backdropInteractive={typeof backdropInteractive === 'boolean' ? backdropInteractive : true}
        closeOnBackdropClick={typeof closeOnBackdropClick === 'boolean' ? closeOnBackdropClick : true}
        actions={
          <>
            <Button variant="secondary" onClick={handleCancelClose}>Cancel</Button>
            <Button disabled={savingVisibility || savingTheme} onClick={async () => {
              try {
                setVisibilityError(null)
                setThemeError(null)
                let themeFailed = false
                const newName = (pendingBoardName || '').trim()
                if (isOwnerView && boardId && newName && newName !== (initialName || '')) {
                  try {
                    await boardStorage.renameBoard(boardId, newName)
                    try { window.dispatchEvent(new CustomEvent('nodal:board-name-updated', { detail: { boardId, name: newName } })) } catch { }
                  } catch { }
                }

                // Persist visibility ONLY on Save (client-side Supabase update may be blocked by RLS)
                if (isOwnerView && loadedIsPublic !== null && pendingIsPublic !== loadedIsPublic) {
                  setSavingVisibility(true)
                  try {
                    const { data: sess } = await supabase.auth.getSession()
                    const token = sess?.session?.access_token
                    if (!token) throw new Error('Not signed in')
                    const resp = await fetch('/api/board/public', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ boardId, isPublic: pendingIsPublic }),
                    })
                    if (!resp.ok) {
                      const j = await resp.json().catch(() => ({}))
                      throw new Error(j?.error || `Failed (${resp.status})`)
                    }
                    setLoadedIsPublic(pendingIsPublic)
                  } finally {
                    setSavingVisibility(false)
                  }
                }

                // Persist board theme + UI mode ONLY on Save (and only for Pro/Admin; admins can override ownership)
                const uiModeToSave: any = pendingBoardTheme === 'default' ? null : (pendingBoardUiMode || 'light')
                const themeChanged = loadedBoardTheme !== null && pendingBoardTheme !== loadedBoardTheme
                const uiChanged = pendingBoardTheme !== 'default' && uiModeToSave !== loadedBoardUiMode
                const overridesToSave: any = pendingBoardTheme === 'default'
                  ? null
                  : (Object.keys(pendingBoardThemeOverrides || {}).length ? pendingBoardThemeOverrides : null)
                const overridesChanged = JSON.stringify(overridesToSave || null) !== JSON.stringify(loadedBoardThemeOverrides || null)
                if (canThemeBoard && (themeChanged || uiChanged || overridesChanged)) {
                  setSavingTheme(true)
                  try {
                    const { data: sess } = await supabase.auth.getSession()
                    const token = sess?.session?.access_token
                    if (!token) throw new Error('Not signed in')
                    const resp = await fetch('/api/board/theme', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ boardId, theme: pendingBoardTheme, uiMode: uiModeToSave, overrides: overridesToSave }),
                    })
                    if (!resp.ok) {
                      const j = await resp.json().catch(() => ({}))
                      throw new Error(j?.error || `Failed (${resp.status})`)
                    }
                    setLoadedBoardTheme(pendingBoardTheme)
                    try { useBoardStore.getState().setBoardTheme?.(pendingBoardTheme) } catch { }
                    setLoadedBoardUiMode(uiModeToSave)
                    try { useBoardStore.getState().setBoardUiMode?.(uiModeToSave) } catch { }
                    setLoadedBoardThemeOverrides(overridesToSave || null)
                    try { useBoardStore.getState().setBoardThemeOverrides?.(overridesToSave || null) } catch { }
                  } catch (e: any) {
                    themeFailed = true
                    setThemeError(String(e?.message || 'Failed to save theme'))
                  } finally {
                    setSavingTheme(false)
                  }
                  if (themeFailed) return
                }

                onCloseRaw()
              } catch (e: any) {
                setVisibilityError(String(e?.message || 'Failed to save'))
                try { setSavingVisibility(false) } catch { }
                try { setSavingTheme(false) } catch { }
              }
            }}>Save</Button>
          </>
        }
      >
        <Tabs disableRouting>
          <Tab label="board" headerLabel="Board">
            <div className="space-y-6 py-4">
              {admin && (
                <div className="flex items-start justify-between gap-3 rounded-md border border-gray-200 dark:border-gray-700 p-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Demo board</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Create a public demo copy where anyone can edit, but nothing saves (refresh resets).
                    </div>
                    {demoError && (
                      <div className="mt-1 text-xs text-red-600 dark:text-red-400">{demoError}</div>
                    )}
                    {demoUrl && (
                      <div className="mt-2 flex flex-col sm:flex-row gap-2">
                        <TextInput
                          label=""
                          value={demoUrl}
                          onChange={() => { }}
                          fullWidth
                        />
                        <Button size="sm" onClick={copyDemoLink}>Copy link</Button>
                      </div>
                    )}
                  </div>
                  <div className="flex-none">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={demoCreating || !boardId}
                      onClick={createDemoBoardCopy}
                    >
                      {demoCreating ? 'Creating…' : 'Save as demo board'}
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between gap-2 rounded-md border border-gray-200 dark:border-gray-700 p-3">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Visibility</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Private boards are members-only. Public boards can be viewed by anyone with the link (editing is members-only).</div>
                  {visibilityError && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">{visibilityError}</div>
                  )}
                </div>
                <div>
                  <Select
                    label=""
                    value={pendingIsPublic ? 'public' : 'private'}
                    onChange={async (v: any) => {
                      const next = v === 'public'
                      setPendingIsPublic(next)
                      if (!isOwnerView) return
                    }}
                    options={[{ label: 'Private', value: 'private' }, { label: 'Public', value: 'public' }]}
                    className="w-24!"
                    disabled={!isOwnerView}
                  />
                </div>
              </div>
              <TextInput
                label="Board title"
                value={pendingBoardName}
                onChange={(e) => setPendingBoardName((e.target as HTMLInputElement).value)}
                placeholder="Enter board title..."
                fullWidth
                disabled={!isOwnerView}
              />
              <TextInput
                label="Board topic"
                value={topic}
                onChange={(e) => setTopic((e.target as HTMLInputElement).value)}
                placeholder="Enter topic..."
                fullWidth
              />

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
              <div className="pt-1">
                <Toggle
                  checked={gridEnabled}
                  onChange={(checked) => {
                    setGridEnabled(checked)
                    try {
                      const key = `nodal:board:${boardId}:gridEnabled`
                      if (typeof window !== 'undefined') window.localStorage.setItem(key, String(checked))
                      try { window.dispatchEvent(new CustomEvent('nodal:grid-updated', { detail: { boardId, enabled: checked } })) } catch { }
                    } catch { }
                  }}
                  label="Snap to grid"
                  description="Snap nodes to a 10px grid and show the grid overlay."
                />
              </div>
            </div>
          </Tab>
          <Tab label="theme" headerLabel="Theme">
            <div className="space-y-6 py-4">
              <div>
                {themeError && (
                  <div className="mt-1 text-xs text-red-600 dark:text-red-400">{themeError}</div>
                )}
                {!canThemeBoard && (
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Upgrade to Pro to unlock board themes.</div>
                )}
              </div>

              <Select
                label="Select theme"
                value={pendingBoardTheme as any}
                onChange={(v: any) => {
                  // Live preview: apply theme immediately on selection.
                  const next = String(v || 'default')
                  setPendingBoardTheme(next)
                  try { useBoardStore.getState().setBoardTheme?.(next) } catch { }
                  if (next === 'default') {
                    try { useBoardStore.getState().setBoardUiMode?.(null as any) } catch { }
                    setPendingBoardThemeOverrides({})
                    try { useBoardStore.getState().setBoardThemeOverrides?.(null as any) } catch { }
                  } else {
                    // Ensure we have a default UI mode when a theme is active.
                    const ui = (pendingBoardUiMode === 'dark') ? 'dark' : 'light'
                    setPendingBoardUiMode(ui)
                    try { useBoardStore.getState().setBoardUiMode?.(ui as any) } catch { }

                    // Switching base theme nukes overrides; switching back restores loaded overrides.
                    const shouldRestore = loadedBoardTheme && next === loadedBoardTheme
                    const ov = shouldRestore ? (loadedBoardThemeOverrides || null) : null
                    setPendingBoardThemeOverrides((ov as any) || {})
                    try { useBoardStore.getState().setBoardThemeOverrides?.(ov as any) } catch { }
                  }
                }}
                options={[
                  { label: 'Default', value: 'default' },
                  { label: 'Red', value: 'red' },
                  { label: 'Presentation', value: 'presentation' },
                  { label: 'Education', value: 'education' },
                  { label: 'Creative', value: 'creative' },
                  { label: 'Technical', value: 'technical' },
                  { label: 'Sci-fi', value: 'scifi' },
                ]}
                fullWidth
                disabled={!canThemeBoard}
              />
              {pendingBoardTheme !== 'default' && (
                <Select
                  label="UI Colors"
                  value={pendingBoardUiMode as any}
                  onChange={(v: any) => {
                    // Live preview: apply UI mode immediately on selection.
                    const next = String(v || 'light').toLowerCase() === 'dark' ? 'dark' : 'light'
                    setPendingBoardUiMode(next as any)
                    try { useBoardStore.getState().setBoardUiMode?.(next as any) } catch { }
                  }}
                  options={[
                    { label: 'Light', value: 'light' },
                    { label: 'Dark', value: 'dark' },
                  ]}
                  fullWidth
                  disabled={!canThemeBoard}
                />
              )}
              {pendingBoardTheme === 'default' && (
                <div className="pt-1">
                  <Toggle
                    checked={isDark}
                    onChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                    label="Dark mode"
                    description="Toggle between light and dark themes."
                  />
                </div>
              )}

              {pendingBoardTheme !== 'default' && (
                <div className="space-y-4 pt-2">
                  <div className="rounded-md border border-gray-200/80 dark:border-gray-700/80 bg-white/70 dark:bg-gray-900/50 backdrop-blur-sm overflow-hidden">
                    <button
                      type="button"
                      className="w-full flex items-start justify-between gap-3 px-3 py-2 text-left"
                      onClick={() => setAdvancedThemeOpen((v) => !v)}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-900 dark:text-white">Advanced theme settings</div>
                        <div className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                          Advanced theme settings are cleared if you switch the theme.
                        </div>
                      </div>
                      <div className="flex-none pt-0.5">
                        <span
                          className={[
                            'inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 transition-transform',
                            advancedThemeOpen ? 'rotate-180' : 'rotate-0',
                          ].join(' ')}
                          aria-hidden="true"
                        >
                          ▾
                        </span>
                      </div>
                    </button>

                    {advancedThemeOpen && (
                      <div className="px-3 pb-3 pt-1 space-y-6">
                        {/* Background */}
                        <div className="space-y-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Background</div>
                          {(() => {
                            const def: any = getBoardTheme(String(pendingBoardTheme || 'default'))
                            const baseRaw = String(def?.background || '')
                            const overrideRaw = String((pendingBoardThemeOverrides as any)?.background || '')
                            const appliedRaw = overrideRaw || baseRaw
                            const baseHex = toHexColor(baseRaw)
                            const appliedHex = toHexColor(appliedRaw)
                            const overrideHex = toHexColor(overrideRaw)
                            const pickerValue = overrideHex || appliedHex || baseHex || '#000000'

                            const setOverride = (value: string | null) => {
                              setPendingBoardThemeOverrides((prev) => {
                                const next = { ...(prev || {}) } as any
                                if (!value) delete next.background
                                else next.background = value
                                try { useBoardStore.getState().setBoardThemeOverrides?.(Object.keys(next).length ? next : null) } catch { }
                                return next
                              })
                            }

                            return (
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">Board background</div>
                                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                                    Applied: {appliedHex || appliedRaw || '—'}{baseHex && !overrideHex ? ` (theme ${baseHex})` : ''}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={pickerValue}
                                    onChange={(e) => setOverride(toHexColor((e.target as any).value))}
                                    disabled={!canThemeBoard}
                                    className="h-9 w-10 rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50"
                                    aria-label="Board background color picker"
                                  />
                                  <input
                                    value={overrideRaw}
                                    onChange={(e) => {
                                      const raw = String((e.target as HTMLInputElement).value || '')
                                      const normalized = toHexColor(raw)
                                      setPendingBoardThemeOverrides((prev) => ({ ...(prev || {}), background: raw } as any))
                                      if (normalized) setOverride(normalized)
                                    }}
                                    placeholder={appliedHex || '#000000'}
                                    disabled={!canThemeBoard}
                                    className="h-9 w-28 px-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 text-sm text-gray-900 dark:text-white font-mono"
                                    aria-label="Board background hex"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setOverride(null)}
                                    disabled={!canThemeBoard || !overrideRaw}
                                    className="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-50"
                                  >
                                    Reset
                                  </button>
                                </div>
                              </div>
                            )
                          })()}
                        </div>

                        {/* Nodes */}
                        <div className="space-y-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Nodes</div>
                          {(() => {
                            const def: any = getBoardTheme(String(pendingBoardTheme || 'default'))
                            const base: any = {
                              nodeColor: String(def?.nodeColor || ''),
                              nodeTitleColor: String(def?.nodeTitleColor || ''),
                              nodeContentColor: String(def?.nodeContentColor || ''),
                              headlineColor: String(def?.headlineColor || ''),
                            }
                            const setKey = (key: string, value: string | null) => {
                              setPendingBoardThemeOverrides((prev) => {
                                const next = { ...(prev || {}) } as any
                                if (!value) delete next[key]
                                else next[key] = value
                                try { useBoardStore.getState().setBoardThemeOverrides?.(Object.keys(next).length ? next : null) } catch { }
                                return next
                              })
                            }
                            const row = (key: string, label: string) => {
                              const overrideRaw = String((pendingBoardThemeOverrides as any)?.[key] || '')
                              const appliedRaw = overrideRaw || base[key] || ''
                              const baseHex = toHexColor(base[key] || '')
                              const appliedHex = toHexColor(appliedRaw)
                              const overrideHex = toHexColor(overrideRaw)
                              const pickerValue = overrideHex || appliedHex || baseHex || '#000000'
                              return (
                                <div key={key} className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
                                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                                      Applied: {appliedHex || appliedRaw || '—'}{baseHex && !overrideHex ? ` (theme ${baseHex})` : ''}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="color"
                                      value={pickerValue}
                                      onChange={(e) => setKey(key, toHexColor((e.target as any).value))}
                                      disabled={!canThemeBoard}
                                      className="h-9 w-10 rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50"
                                      aria-label={`${label} color picker`}
                                    />
                                    <input
                                      value={overrideRaw}
                                      onChange={(e) => {
                                        const raw = String((e.target as HTMLInputElement).value || '')
                                        const normalized = toHexColor(raw)
                                        setPendingBoardThemeOverrides((prev) => ({ ...(prev || {}), [key]: raw } as any))
                                        if (normalized) setKey(key, normalized)
                                      }}
                                      placeholder={appliedHex || '#000000'}
                                      disabled={!canThemeBoard}
                                      className="h-9 w-28 px-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 text-sm text-gray-900 dark:text-white font-mono"
                                      aria-label={`${label} hex`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setKey(key, null)}
                                      disabled={!canThemeBoard || !overrideRaw}
                                      className="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-50"
                                    >
                                      Reset
                                    </button>
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <div className="space-y-3">
                                {row('nodeColor', 'Node background')}
                                {row('nodeTitleColor', 'Node title')}
                                {row('nodeContentColor', 'Node content')}
                                {row('headlineColor', 'Headline')}
                              </div>
                            )
                          })()}
                        </div>

                        {/* Edges */}
                        <div className="space-y-3">
                          <div className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">Edges</div>
                          {(() => {
                            const def: any = getBoardTheme(String(pendingBoardTheme || 'default'))
                            const base: any = {
                              edgeColor: String(def?.edgeColor || ''),
                              edgeHighlightColor: String(def?.edgeHighlightColor || ''),
                              edgeHighlightPulseColor: String(def?.edgeHighlightPulseColor || def?.edgeAccentColor || ''),
                              edgeArrowColor: String(def?.edgeArrowColor || def?.edgeAccentColor || ''),
                            }
                            const setKey = (key: string, value: string | null) => {
                              setPendingBoardThemeOverrides((prev) => {
                                const next = { ...(prev || {}) } as any
                                if (!value) delete next[key]
                                else next[key] = value
                                try { useBoardStore.getState().setBoardThemeOverrides?.(Object.keys(next).length ? next : null) } catch { }
                                return next
                              })
                            }
                            const row = (key: string, label: string) => {
                              const overrideRaw = String((pendingBoardThemeOverrides as any)?.[key] || '')
                              const appliedRaw = overrideRaw || base[key] || ''
                              const baseHex = toHexColor(base[key] || '')
                              const appliedHex = toHexColor(appliedRaw)
                              const overrideHex = toHexColor(overrideRaw)
                              const pickerValue = overrideHex || appliedHex || baseHex || '#000000'
                              return (
                                <div key={key} className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
                                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-mono break-all">
                                      Applied: {appliedHex || appliedRaw || '—'}{baseHex && !overrideHex ? ` (theme ${baseHex})` : ''}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="color"
                                      value={pickerValue}
                                      onChange={(e) => setKey(key, toHexColor((e.target as any).value))}
                                      disabled={!canThemeBoard}
                                      className="h-9 w-10 rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50"
                                      aria-label={`${label} color picker`}
                                    />
                                    <input
                                      value={overrideRaw}
                                      onChange={(e) => {
                                        const raw = String((e.target as HTMLInputElement).value || '')
                                        const normalized = toHexColor(raw)
                                        setPendingBoardThemeOverrides((prev) => ({ ...(prev || {}), [key]: raw } as any))
                                        if (normalized) setKey(key, normalized)
                                      }}
                                      placeholder={appliedHex || '#000000'}
                                      disabled={!canThemeBoard}
                                      className="h-9 w-28 px-2 rounded-md border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-900/50 text-sm text-gray-900 dark:text-white font-mono"
                                      aria-label={`${label} hex`}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setKey(key, null)}
                                      disabled={!canThemeBoard || !overrideRaw}
                                      className="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white disabled:opacity-50"
                                    >
                                      Reset
                                    </button>
                                  </div>
                                </div>
                              )
                            }
                            return (
                              <div className="space-y-3">
                                {row('edgeColor', 'Edge color')}
                                {row('edgeHighlightColor', 'Edge highlight')}
                                {row('edgeHighlightPulseColor', 'Direction pulse')}
                                {row('edgeArrowColor', 'Arrow')}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Tab>
          <Tab label="aisettings" headerLabel="AI Settings">
            <div className="space-y-6 py-4">
              <Select
                label="AI behavior (Style)"
                value={pendingAIStyle as any}
                onChange={async (v: any) => {
                  const next = String(v || 'balanced') as AIStyleKey
                  setPendingAIStyle(next)
                  try { setAIStyle?.(next) } catch { }
                  try {
                    if (boardId) {
                      await (supabase.from('boards') as any).update({ ai_style: next } as any).eq('id', boardId)
                      try { window.dispatchEvent(new CustomEvent('nodal:board-ai-style-updated', { detail: { boardId, aiStyle: next } })) } catch { }
                    }
                  } catch { }
                }}
                options={AI_STYLE_OPTIONS as any}
                fullWidth
                description="This affects how the AI responds on this board, not what features are available."
              />
              <Select
                label="AI mode"
                value={model as any}
                onChange={(v) => setModel(v as OpenAIModel)}
                options={MODELS as any}
                fullWidth
              />
              <Range
                label={`Creativity (Temperature: ${temperature})`}
                min={0}
                max={1}
                step={0.05}
                value={temperature}
                onChange={(v) => setTemperature(v)}
                fullWidth
                startLabel="Focused"
                endLabel="Creative"
              />
            </div>
          </Tab>
          <Tab label="members" headerLabel="Members">
            <div className="pt-4 space-y-3">
              {/* Invite section */}
              <div>
                <div className="flex flex-col sm:flex-row gap-2 items-end md:items-end space-y-2 md:space-y-0">
                  <div className="flex grow w-full">
                    <TextInput
                      type="email"
                      size="md"
                      fullWidth
                      placeholder="Add email and press Enter"
                      label="Invite by email"
                      value={shareInput}
                      onChange={(e) => setShareInput((e.target as HTMLInputElement).value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addEmail(shareInput) } }}
                    />
                  </div>
                  <div className="flex gap-2 items-end w-full sm:w-auto">
                    <Select
                      label="Role"
                      value={selectedRole}
                      onChange={(v: any) => setSelectedRole(v as any)}
                      options={[{ label: 'Editor', value: 'editor' }, { label: 'Viewer', value: 'viewer' }]}
                      className="w-36 sm:w-40 flex-none"
                    />
                    <IconButton aria-label="Add email" size="md" variant="secondary" onClick={() => addEmail(shareInput)}>
                      <span className="w-4 h-4">+</span>
                    </IconButton>
                  </div>
                </div>
                {shareError && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{shareError}</div>}
                {(searching || results.length > 0) && (
                  <div className="mt-2 border rounded-md border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700 max-h-56 overflow-auto">
                    {searching && <div className="p-2 text-xs text-gray-500 dark:text-gray-400">Searching…</div>}
                    {!searching && results.length === 0 && (
                      <div className="p-2 text-xs text-gray-500 dark:text-gray-400">No matches</div>
                    )}
                    {!searching && results.map((r) => (
                      <div key={r.id} className="p-2 flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="text-sm text-gray-900 dark:text-white truncate">{r.username || r.email || r.id}</div>
                          {r.email && <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{r.email}</div>}
                        </div>
                        <Button size="sm" onClick={() => r.email && addEmail(r.email)} disabled={!r.email}>Share as {selectedRole}</Button>
                      </div>
                    ))}
                  </div>
                )}
                {shareInvites.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {shareInvites.map(inv => (
                      <Tag key={inv.email} variant="secondary" onRightIconClick={() => setShareInvites(prev => prev.filter(e => e.email !== inv.email))}>
                        {inv.email} ({inv.role})
                      </Tag>
                    ))}
                  </div>
                )}
                <div className="flex justify-end gap-2 mt-3">
                  <Button onClick={handleSendInvites} disabled={shareInvites.length === 0}>Send Invites</Button>
                </div>
              </div>
              <div className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Board Members</div>
              <BoardMembersRoleEditor boardId={boardId} isOwnerView={isOwnerView} />
            </div>
          </Tab>
          <Tab label="colorgories" headerLabel="Colorgories">
            <div className="pt-4">
              <ColorgoryManager inline boardId={boardId} />
            </div>
          </Tab>
        </Tabs>
      </Modal>
      <Toast open={showSentToast} onClose={() => setShowSentToast(false)} variant="success" autoHideMs={1800}>
        Invites sent!
      </Toast>
      <Toast open={demoCopiedToast} onClose={() => setDemoCopiedToast(false)} variant="success" autoHideMs={1600}>
        Demo link copied!
      </Toast>
    </>
  )
}


