'use client'

import Loader from './ui/Loader'
import Button from './ui/Button'
import TemplateCard from './TemplateCard'
import { templateStorage } from '../features/storage/templateStorage'
import { isAdmin } from '../features/auth/roles'
import React from 'react'
import Modal from './ui/Modal'
import TextInput from './ui/TextInput'
import TextArea from './ui/TextArea'

interface TemplatesTabProps {
  templates: Array<any>
  templatesLoading: boolean
  templatesError: string | null
  user: any
  setTemplates: (updater: (prev: any[]) => any[]) => void
  onOpenBoard: (board: any) => void
}

export default function TemplatesTab({
  templates,
  templatesLoading,
  templatesError,
  user,
  setTemplates,
  onOpenBoard,
}: TemplatesTabProps) {
  const adminView = isAdmin(user)
  const filteredTemplates = React.useMemo(() => adminView ? templates : templates.filter((t: any) => !!t.published), [adminView, templates])
  // Default viewport for Welcome templates (tweak as desired)
  const welcomeViewport = React.useMemo(() => ({ x: -300, y: 0, zoom: 1 }), [])

  // Helper: create a board from a template with a unique name and optional welcome viewport
  const createBoardFromTemplate = React.useCallback(async (tpl: any, baseName: string) => {
    const { boardStorage } = await import('../features/storage/storage')
    // Build a unique name (… copy, … copy 2, … copy 3, …)
    let candidate = baseName
    try {
      const existing = await boardStorage.getAllBoards()
      const names = new Set((existing || []).map((b: any) => String(b.name)))
      if (names.has(candidate)) {
        let i = 2
        while (names.has(`${baseName} ${i}`)) i += 1
        candidate = `${baseName} ${i}`
      }
    } catch { }
    const payloadData = tpl?.welcome ? { ...(tpl?.data || {}), viewport: welcomeViewport } : tpl?.data
    const id = await boardStorage.saveBoard(candidate, payloadData)
    return { id }
  }, [welcomeViewport])
  const [visibleCount, setVisibleCount] = React.useState(() => Math.min(filteredTemplates.length, 24))
  const [editOpen, setEditOpen] = React.useState(false)
  const [editId, setEditId] = React.useState<string | null>(null)
  const [editName, setEditName] = React.useState('')
  const [editCoverUrl, setEditCoverUrl] = React.useState('')
  const [editDescription, setEditDescription] = React.useState('')
  const [editPublished, setEditPublished] = React.useState(false)
  const [editWelcome, setEditWelcome] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [uploadingCover, setUploadingCover] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    setVisibleCount(Math.min(filteredTemplates.length, 24))
    let cancelled = false
    const pump = () => {
      if (cancelled) return
      if (visibleCount >= filteredTemplates.length) return
      setVisibleCount((c) => Math.min(filteredTemplates.length, c + 24))
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        ; (window as any).requestIdleCallback(pump, { timeout: 1200 })
      } else {
        setTimeout(pump, 0)
      }
    }
    if (filteredTemplates.length > 30) {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        ; (window as any).requestIdleCallback(pump, { timeout: 1200 })
      } else {
        setTimeout(pump, 0)
      }
    }
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTemplates])

  const openEdit = (tpl: any) => {
    setEditId(tpl.id)
    setEditName(tpl.name || '')
    setEditCoverUrl(tpl.coverUrl || '')
    setEditDescription(tpl.description || '')
    setEditPublished(!!tpl.published)
    setEditWelcome(!!tpl.welcome)
    setEditOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editId) return
    try {
      setSaving(true)
      const updated = await templateStorage.updateTemplate(editId, { name: editName, description: editDescription || null, coverUrl: editCoverUrl || null, published: editPublished, welcome: editWelcome } as any)
      setTemplates(prev => prev.map((p: any) => p.id === editId ? updated : p))
      setEditOpen(false)
    } catch {
      alert('Failed to update template')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTemplate = async () => {
    if (!editId) return
    const confirm = window.confirm('Delete this template? This cannot be undone.')
    if (!confirm) return
    try {
      setSaving(true)
      await templateStorage.deleteTemplate(editId)
      setTemplates(prev => prev.filter((p: any) => p.id !== editId))
      setEditOpen(false)
    } catch {
      alert('Failed to delete template')
    } finally {
      setSaving(false)
    }
  }

  const handleEditBoard = async () => {
    if (!editId) return
    const tpl = templates.find((x: any) => x.id === editId)
    if (!tpl) return
    try {
      const { id } = await createBoardFromTemplate(tpl, tpl.name)
      try { localStorage.setItem(`templateMapping:${id}`, tpl.id) } catch { }
      const { boardStorage } = await import('../features/storage/storage')
      const newBoard = await boardStorage.loadBoard(id)
      setEditOpen(false)
      if (newBoard) {
        onOpenBoard(newBoard)
      } else if (typeof window !== 'undefined') {
        window.location.href = `/board/${id}`
      }
    } catch (err) {
      alert('Failed to open template for editing')
    }
  }

  return (
    <div className="w-full mx-auto px-4 sm:px-6 lg:px-12 py-10 min-h-screen">
      {templatesError && (
        <div className="mb-4 text-red-600 dark:text-red-400">{templatesError}</div>
      )}
      {templatesLoading ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <Loader />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
          {filteredTemplates.length === 0 ? (
            <div className="col-span-full text-center text-gray-500 dark:text-gray-400 py-16">
              No templates yet.
            </div>
          ) : (
            (filteredTemplates
              .slice(0, visibleCount)
              .sort((a: any, b: any) => {
                // Welcome templates come first
                const aw = a?.welcome ? 1 : 0
                const bw = b?.welcome ? 1 : 0
                if (aw !== bw) return bw - aw
                return 0
              })
            ).map((t: any) => {
              const admin = adminView
              const footer = (
                <>
                  {admin && (
                    <Button
                      variant="secondaryGhost"
                      size="small"
                      onClick={(e) => { e.stopPropagation(); openEdit(t) }}
                    >
                      Edit Template
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="small"
                    onClick={async (e) => {
                      e.stopPropagation()
                      try {
                        (e.currentTarget as HTMLButtonElement).disabled = true
                          ; (e.currentTarget as HTMLButtonElement).classList.add('opacity-70')
                        const base = `${t.name} (copy)`
                        const { id } = await createBoardFromTemplate(t, base)
                        const { boardStorage } = await import('../features/storage/storage')
                        const newBoard = await boardStorage.loadBoard(id)
                        if (newBoard) {
                          onOpenBoard(newBoard)
                        } else if (typeof window !== 'undefined') {
                          window.location.href = `/board/${id}`
                        }
                      } catch (e) {
                        alert('Failed to use template')
                      } finally {
                        try {
                          (e.currentTarget as HTMLButtonElement).disabled = false
                            ; (e.currentTarget as HTMLButtonElement).classList.remove('opacity-70')
                        } catch { }
                      }
                    }}
                  >
                    Use
                  </Button>
                </>
              )
              const highlightWelcome = !!t.welcome
              return (
                <div key={t.id} className={highlightWelcome ? 'border-2 border-tertiary-500 rounded-xl' : undefined}>
                  <TemplateCard
                    id={t.id}
                    name={t.name}
                    nodeCount={t.nodeCount}
                    edgeCount={t.edgeCount}
                    coverUrl={t.coverUrl}
                    description={t.description}
                    published={admin ? t.published : undefined}
                    admin={admin}
                    // Show cover and description under the counts
                    // We wedge in via name by appending description visually below using a custom footer
                    onLoad={() => { if (admin) openEdit(t) }}
                    onRename={admin ? async (newName) => {
                      try {
                        const updated = await templateStorage.updateTemplate(t.id, { name: newName })
                        setTemplates(prev => prev.map((p: any) => p.id === t.id ? updated : p))
                      } catch {
                        alert('Failed to rename template')
                      }
                    } : undefined}
                    enableSharing={false}
                    footerActions={footer}
                  />
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Edit Template Modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Template"
        // description="Update template details. Use Edit Template Board to modify the underlying board."
        actions={
          <>
            <div className="flex-1 text-left">
              <Button variant="dangerGhost" onClick={handleDeleteTemplate} disabled={saving}>Delete</Button>
            </div>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} loading={saving} disabled={saving}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-6 py-2">
          <div className="space-y-3">
            <TextInput label="Name" value={editName} onChange={(e) => setEditName((e.target as HTMLInputElement).value)} fullWidth />
            <div className="pb-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input id="tpl-published" type="checkbox" checked={editPublished} onChange={(e) => setEditPublished(e.target.checked)} />
                  <label htmlFor="tpl-published" className="text-sm text-gray-700 dark:text-gray-300">Published</label>
                </div>
                <div className="flex items-center gap-2">
                  <input id="tpl-welcome" type="checkbox" checked={editWelcome} onChange={(e) => setEditWelcome(e.target.checked)} />
                  <label htmlFor="tpl-welcome" className="text-sm text-gray-700 dark:text-gray-300">Welcome Board</label>
                </div>
              </div>
              <Button variant="secondaryGhost" onClick={handleEditBoard}>Edit Template Board</Button>
            </div>
          </div>
          <div className="space-y-3">
            {editCoverUrl ? (
              <img src={editCoverUrl} alt="Template cover" className="w-full h-40 object-cover rounded-md border border-gray-200 dark:border-gray-700" />
            ) : (
              <div className="w-full h-40 rounded-md border border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center text-xs text-gray-500 dark:text-gray-400">
                No cover image
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try {
                    setUploadingCover(true)
                    const fd = new FormData()
                    fd.append('file', f)
                    const res = await fetch('/api/admin/template-cover', { method: 'POST', body: fd })
                    const json = await res.json()
                    if (!res.ok) throw new Error(json.error || 'Upload failed')
                    setEditCoverUrl(json.url)
                  } catch (err) {
                    alert('Failed to upload cover image')
                  } finally {
                    setUploadingCover(false)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }
                }}
              />
              <Button variant="secondary" onClick={() => fileInputRef.current?.click()} loading={uploadingCover} disabled={uploadingCover}>
                {editCoverUrl ? 'Replace Image' : 'Upload Image'}
              </Button>
              {editCoverUrl && (
                <Button variant="dangerGhost" onClick={() => setEditCoverUrl('')} disabled={uploadingCover}>
                  Remove
                </Button>
              )}
            </div>
          </div>
          <TextArea label="Description" value={editDescription} onChange={(e) => setEditDescription((e.target as HTMLTextAreaElement).value)} rows={3} fullWidth />
          {/* <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button variant="secondaryGhost" onClick={handleEditBoard}>Edit Template Board</Button>
          </div> */}

        </div>
      </Modal>
    </div>
  )
}


