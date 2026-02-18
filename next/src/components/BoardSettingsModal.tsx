'use client'

import React, { useEffect, useState } from 'react'
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

export default function BoardSettingsModal({ open, onClose, boardId, initialName, isOwnerView = false, className, backdropClassName, backdropInteractive, closeOnBackdropClick }: Props) {
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

  useEffect(() => { if (open) setPendingBoardName(initialName || '') }, [open, initialName])
  // no local tab state

  useEffect(() => {
    if (!open || !boardId) return
    ;(async () => {
      try {
        let data: any = null
        let err: any = null
        ;({ data, error: err } = await supabase.from('boards').select('is_public, ai_style, board_theme, board_ui_mode').eq('id', boardId).maybeSingle() as any)
        // Backward-compatible fallback when schema hasn't been migrated yet
        if (err && (
          String(err?.message || '').toLowerCase().includes('board_theme') ||
          String(err?.message || '').toLowerCase().includes('board_ui_mode')
        )) {
          ;({ data } = await supabase.from('boards').select('is_public, ai_style').eq('id', boardId).maybeSingle() as any)
        }
        const isPub = !!(data as any)?.is_public
        setPendingIsPublic(isPub)
        setLoadedIsPublic(isPub)
        const style = String((data as any)?.ai_style || 'balanced') as AIStyleKey
        setPendingAIStyle(style)
        try { setAIStyle?.(style) } catch {}
        const themeKey = String((data as any)?.board_theme || 'default')
        setPendingBoardTheme(themeKey)
        setLoadedBoardTheme(themeKey)
        const uiRaw = String((data as any)?.board_ui_mode || '').toLowerCase()
        const uiKey: any = (uiRaw === 'dark' || uiRaw === 'light') ? uiRaw : null
        setLoadedBoardUiMode(uiKey)
        setPendingBoardUiMode((uiKey as any) || 'light')
      } catch {
        setPendingIsPublic(false)
        setLoadedIsPublic(false)
        setPendingBoardTheme('default')
        setLoadedBoardTheme('default')
        setPendingBoardUiMode('light')
        setLoadedBoardUiMode(null)
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
      try { window.dispatchEvent(new CustomEvent('nodal:toast', { detail: { message: 'Demo link copied', variant: 'success' } })) } catch {}
    } catch {
      setDemoError('Failed to copy link')
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        // title="Board Settings"
        className={[
          // Transparent modal panel so the board stays visible behind settings.
          'bg-transparent dark:bg-transparent shadow-none p-0 max-w-2xl',
          className || '',
        ].filter(Boolean).join(' ')}
        backdropClassName={backdropClassName || 'bg-transparent'}
        backdropInteractive={typeof backdropInteractive === 'boolean' ? backdropInteractive : true}
        closeOnBackdropClick={typeof closeOnBackdropClick === 'boolean' ? closeOnBackdropClick : true}
        actions={
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
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
                if (canThemeBoard && (themeChanged || uiChanged)) {
                  setSavingTheme(true)
                  try {
                    const { data: sess } = await supabase.auth.getSession()
                    const token = sess?.session?.access_token
                    if (!token) throw new Error('Not signed in')
                    const resp = await fetch('/api/board/theme', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ boardId, theme: pendingBoardTheme, uiMode: uiModeToSave }),
                    })
                    if (!resp.ok) {
                      const j = await resp.json().catch(() => ({}))
                      throw new Error(j?.error || `Failed (${resp.status})`)
                    }
                    setLoadedBoardTheme(pendingBoardTheme)
                    try { useBoardStore.getState().setBoardTheme?.(pendingBoardTheme) } catch {}
                    setLoadedBoardUiMode(uiModeToSave)
                    try { useBoardStore.getState().setBoardUiMode?.(uiModeToSave) } catch {}
                  } catch (e: any) {
                    themeFailed = true
                    setThemeError(String(e?.message || 'Failed to save theme'))
                  } finally {
                    setSavingTheme(false)
                  }
                  if (themeFailed) return
                }

                onClose()
              } catch (e: any) {
                setVisibilityError(String(e?.message || 'Failed to save'))
                try { setSavingVisibility(false) } catch {}
                try { setSavingTheme(false) } catch {}
              }
            }}>Save</Button>
          </>
        }
      >
        <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-4xl shadow-2xl border border-gray-200/60 dark:border-gray-700/60 p-4 md:p-6">
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
                          onChange={() => {}}
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
                      try { window.dispatchEvent(new CustomEvent('nodal:grid-updated', { detail: { boardId, enabled: checked } })) } catch {}
                    } catch {}
                  }}
                  label="Snap to grid"
                  description="Snap nodes to a 10px grid and show the grid overlay."
                />
              </div>
            </div>
          </Tab>
          <Tab label="theme" headerLabel="Theme">
            <div className="space-y-6 py-4">
              <div className="rounded-md border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Board theme</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Themes change the board background (more customization coming later).</div>
                  {themeError && (
                    <div className="mt-1 text-xs text-red-600 dark:text-red-400">{themeError}</div>
                  )}
                  {!canThemeBoard && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">Upgrade to Pro to unlock board themes.</div>
                  )}
                </div>
                <Select
                  label=""
                  value={pendingBoardTheme as any}
                  onChange={(v: any) => {
                    // Live preview: apply theme immediately on selection.
                    const next = String(v || 'default')
                    setPendingBoardTheme(next)
                    try { useBoardStore.getState().setBoardTheme?.(next) } catch {}
                    if (next === 'default') {
                      try { useBoardStore.getState().setBoardUiMode?.(null as any) } catch {}
                    } else {
                      // Ensure we have a default UI mode when a theme is active.
                      const ui = (pendingBoardUiMode === 'dark') ? 'dark' : 'light'
                      setPendingBoardUiMode(ui)
                      try { useBoardStore.getState().setBoardUiMode?.(ui as any) } catch {}
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
                      try { useBoardStore.getState().setBoardUiMode?.(next as any) } catch {}
                    }}
                    options={[
                      { label: 'Light', value: 'light' },
                      { label: 'Dark', value: 'dark' },
                    ]}
                    fullWidth
                    disabled={!canThemeBoard}
                  />
                )}
              </div>
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
                  try { setAIStyle?.(next) } catch {}
                  try {
                    if (boardId) {
                      await (supabase.from('boards') as any).update({ ai_style: next } as any).eq('id', boardId)
                      try { window.dispatchEvent(new CustomEvent('nodal:board-ai-style-updated', { detail: { boardId, aiStyle: next } })) } catch {}
                    }
                  } catch {}
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
        </div>
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


