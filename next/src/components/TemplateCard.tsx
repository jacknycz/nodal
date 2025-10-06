'use client'

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import IconButton from './ui/IconButton'
import Button from './ui/Button'
import TextInput from './ui/TextInput'
const DynamicModal = dynamic(() => import('./ui/Modal'), { ssr: false })
import { PushPin, CheckCircle, Copy, Plus } from '@phosphor-icons/react/dist/ssr'
import { useSupabaseUser } from '../features/auth/authUtils'

interface TemplateCardProps {
  id: string
  name: string
  lastModified?: number
  nodeCount?: number
  edgeCount?: number
  coverUrl?: string | null
  description?: string | null
  published?: boolean
  invitedBy?: string
  isPinned?: boolean
  onTogglePin?: () => void
  onLoad: () => void
  onRename?: (newName: string) => void
  onDelete?: () => void
  enableSharing?: boolean
  footerActions?: React.ReactNode
  admin?: boolean
}

function TemplateCard({
  id,
  name,
  lastModified,
  nodeCount,
  edgeCount,
  coverUrl,
  description,
  published,
  invitedBy,
  isPinned,
  onTogglePin,
  onLoad,
  onRename,
  onDelete,
  enableSharing = true,
  footerActions,
  admin,
}: TemplateCardProps) {
  const [newName, setNewName] = useState(name)
  
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [originalName, setOriginalName] = useState(name)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareEmails, setShareEmails] = useState<string[]>([])
  const [shareInput, setShareInput] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<Array<{ id: string; username?: string | null; email?: string | null; avatar_url?: string | null }>>([])
  const [shareError, setShareError] = useState<string | null>(null)
  const shareLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/board/${id}`
  const user = useSupabaseUser()

  useEffect(() => { setNewName(name) }, [name])
  // Debounced search for users by username/email
  useEffect(() => {
    let t: any
    const run = async () => {
      const q = shareInput.trim()
      if (q.length < 2) { setResults([]); return }
      setSearching(true)
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        const list = Array.isArray(json.results) ? json.results : []
        setResults(list)
      } catch { setResults([]) }
      finally { setSearching(false) }
    }
    t = setTimeout(run, 250)
    return () => clearTimeout(t)
  }, [shareInput])

  const isValidEmail = (e: string) => /[^@\s]+@[^@\s]+\.[^@\s]+/.test(e)

  const addEmail = (email: string) => {
    const e = email.trim()
    if (!e || !isValidEmail(e)) { setShareError('Enter a valid email'); return }
    if (!shareEmails.includes(e)) {
      setShareEmails(prev => [...prev, e])
    }
    setShareInput('')
    setShareError(null)
  }

  const handleSendInvites = async () => {
    setShareError(null)
    try {
      const invites = shareEmails.filter(isValidEmail)
      for (const email of invites) {
        await fetch('/api/board/invitations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ boardId: id, email, invitedBy: user?.id })
        })
      }
      setShowShareModal(false)
      setShareEmails([])
    } catch {
      setShareError('Failed to send invites')
    }
  }

  // Thumbnails removed

  const commitTitleEdit = useCallback(() => {
    const trimmed = newName.trim()
    if (!trimmed) { setNewName(originalName); setIsEditingTitle(false); return }
    if (trimmed !== originalName) { onRename?.(trimmed) }
    setIsEditingTitle(false)
  }, [newName, originalName, onRename])

  useEffect(() => {
    if (!isEditingTitle) return
    const handleMouseDown = (e: MouseEvent) => {
      const inputEl = titleInputRef.current
      if (inputEl && !inputEl.contains(e.target as Node)) commitTitleEdit()
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [isEditingTitle, commitTitleEdit])

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return undefined
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = diffMs / (1000 * 60 * 60)
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${Math.floor(diffHours)}h ago`
    if (diffDays < 7) return `${Math.floor(diffDays)}d ago`
    return date.toLocaleDateString()
  }

  const handleCardClick = () => {
    if (showShareModal || showDeleteModal || isEditingTitle) return
    onLoad()
  }

  return (
    <div
      className="group relative 
      shadow-xl shadow-gray-200/20 hover:shadow-gray-400/20 hover:shadow-lg dark:hover:shadow-primary-800/20 dark:shadow-none dark:hover:shadow-xl 
      bg-white dark:bg-gray-950/60 dark:hover:bg-slate-700/98
      border-transparent  dark:hover:border-primary-600/20 p-4 rounded-2xl border transition-all duration-200 cursor-pointer"
      onClick={handleCardClick}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '160px 160px' as any }}
    >
      {typeof isPinned !== 'undefined' && onTogglePin && (
        <IconButton
          aria-label={isPinned ? 'Unpin board' : 'Pin board'}
          onClick={(e) => { e.stopPropagation(); onTogglePin() }}
          variant={isPinned ? 'primaryGhost' : 'secondaryGhost'}
          className={`absolute top-2 right-2 z-20 ${isPinned ? 'text-tertiary-500 bg-tertiary-50/50! dark:bg-transparent! hover:bg-tertiary-50' : 'text-gray-400 hover:text-gray-600 dark:text-gray-400 dark:hover:text-gray-200'}`}
        >
          <PushPin size={16} weight="duotone" />
        </IconButton>
      )}

      <div className="mb-1">
        <div className="group relative">
          {onRename && isEditingTitle ? (
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
                <CheckCircle size={24} weight="duotone" className="w-4 h-4" />
              </IconButton>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h3
                className="text-xl font-normal text-gray-900 dark:text-white truncate cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                onClick={(e) => { if (!onRename) return; e.stopPropagation(); setOriginalName(newName); setIsEditingTitle(true) }}
              >
                {newName}
              </h3>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
        {lastModified !== undefined && (
          <span className="flex mt-1 gap-1 items-center text-xs text-gray-400 dark:text-gray-400">
            {formatDate(lastModified)}
          </span>
        )}
        {published && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 text-[10px] font-medium mt-1">Published</span>
        )}
        </div>
        {invitedBy && (
          <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">Invited by: {invitedBy}</span>
        )}
      </div>

      <div className="flex space-x-6 items-center">
        <div className="flex flex-col flex-1 w-full items-start">
          {admin && (typeof nodeCount !== 'undefined' || typeof edgeCount !== 'undefined') && (
            <div className="flex space-x-4 font-medium text-gray-500 dark:text-gray-200">
              {typeof nodeCount !== 'undefined' && (
                <div className="flex items-center gap-1">
                  <span className="flex items-center justify-center w-8 h-8 text-base font-fredoka font-medium dark:bg-primary-900 border-2 border-primary-500 bg-primary-50/50 dark:border-none rounded-full text-primary-600 dark:text-primary-200">{nodeCount}</span>
                  <span className="">nodes</span>
                </div>
              )}
              {typeof edgeCount !== 'undefined' && (
                <div className="flex items-center gap-1">
                  <span className="flex items-center justify-center w-8 h-8 text-base font-fredoka font-medium dark:bg-primary-900 border-2 border-primary-500 bg-primary-50/50 dark:border-none rounded-full text-primary-600 dark:text-primary-200">{edgeCount}</span>
                  <span className="">connections</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {(coverUrl || description) && (
        <div className="mt-3 space-y-2">
          {coverUrl && (
            <div className="relative w-full h-64">
              <Image
                src={coverUrl}
                alt="Template cover"
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover rounded-md border border-gray-200 dark:border-gray-700"
                priority={false}
              />
            </div>
          )}
          {description && (
            <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">{description}</div>
          )}
        </div>
      )}

      <div className="col-span-2 mt-3 flex items-center justify-between gap-2">
        {footerActions ? footerActions : (
          <>
            {enableSharing && (
              <Button
                variant="secondary"
                size="small"
                onClick={e => { e.stopPropagation(); setShowShareModal(true) }}
                title="Share board"
              >
                Share
              </Button>
            )}
            {onDelete && (
              <Button
                variant="dangerGhost"
                size="small"
                onClick={e => { e.stopPropagation(); setShowDeleteModal(true) }}
                title="Delete board"
              >
                Delete
              </Button>
            )}
          </>
        )}
      </div>

      {onDelete && (
        <DynamicModal
          open={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Board"
          description={`Are you sure you want to delete "${newName}"? This action cannot be undone.`}
        >
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="secondary" size="small" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button variant="danger" size="small" onClick={() => { setShowDeleteModal(false); onDelete() }}>Delete</Button>
          </div>
        </DynamicModal>
      )}

      {enableSharing && (
        <DynamicModal
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
          title="Share Board"
          description="Copy a link or invite people by email."
        >
          <div className="space-y-4">
            <div>
              <div className="flex gap-2">
                <TextInput readOnly value={shareLink} fullWidth label="Share link" size="lg" />
                <IconButton aria-label="Copy share link" size="lg" variant="secondary" onClick={() => { navigator.clipboard.writeText(shareLink) }}>
                  <Copy size={24} weight="duotone" className="w-4 h-4" />
                </IconButton>
              </div>
            </div>

            <div>
              <div className="flex gap-2">
                <TextInput
                  type="email"
                  size="lg"
                  placeholder="Add email and press Enter"
                  label="Invite by email"
                  value={shareInput}
                  onChange={e => setShareInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addEmail(shareInput)
                    }
                  }}
                  fullWidth
                />
                <IconButton
                  aria-label="Add email"
                  size="lg"
                  variant="secondary"
                  onClick={() => addEmail(shareInput)}
                >
                  <Plus size={24} weight="duotone" className="w-4 h-4" />
                </IconButton>
              </div>
              {shareError && <div className="text-xs text-red-600 dark:text-red-400 mt-1">{shareError}</div>}

              {/* Instant results */}
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
                      <Button size="sm" onClick={() => r.email && addEmail(r.email)} disabled={!r.email}>Share</Button>
                    </div>
                  ))}
                </div>
              )}
              {shareEmails.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {shareEmails.map(email => (
                    <span key={email} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs">
                      {email}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowShareModal(false)}>Close</Button>
              <Button onClick={handleSendInvites} disabled={shareEmails.length === 0}>Send Invites</Button>
            </div>
          </div>
        </DynamicModal>
      )}
    </div>
  )
}

export default memo(TemplateCard)


