'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import IconButton from './ui/IconButton'
import Button from './ui/Button'
import TextInput from './ui/TextInput'
import Modal from './ui/Modal'
import { PushPin } from '@phosphor-icons/react/dist/ssr'
import { Check as CheckIcon, Copy, Plus } from 'lucide-react'

interface BoardCardProps {
  id: string
  name: string
  lastModified?: number
  nodeCount?: number
  edgeCount?: number
  thumbnailUrl?: string
  invitedBy?: string
  isPinned?: boolean
  onTogglePin?: () => void
  onLoad: () => void
  onRename?: (newName: string) => void
  onDelete?: () => void
  enableSharing?: boolean
  footerActions?: React.ReactNode
}

export default function BoardCard({
  id,
  name,
  lastModified,
  nodeCount,
  edgeCount,
  thumbnailUrl: initialThumb,
  invitedBy,
  isPinned,
  onTogglePin,
  onLoad,
  onRename,
  onDelete,
  enableSharing = true,
  footerActions,
}: BoardCardProps) {
  const [newName, setNewName] = useState(name)
  const [imgError, setImgError] = useState(false)
  const [thumbnailUrl, setThumbnailUrl] = useState(initialThumb || `https://xghncimqbauvtytdfkkx.supabase.co/storage/v1/object/public/thumbnails/thumbnail-${id}.jpg`)
  const [loading, setLoading] = useState(false)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [originalName, setOriginalName] = useState(name)
  const titleInputRef = useRef<HTMLInputElement | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareEmails, setShareEmails] = useState<string[]>([])
  const [shareInput, setShareInput] = useState('')
  const shareLink = `${typeof window !== 'undefined' ? window.location.origin : ''}/board/${id}`

  useEffect(() => { setNewName(name) }, [name])

  // Optional thumbnail refresh hook via window event
  useEffect(() => {
    if (!loading) return
    const timeout = setTimeout(() => {
      const newUrl = `https://xghncimqbauvtytdfkkx.supabase.co/storage/v1/object/public/thumbnails/thumbnail-${id}.jpg?${Date.now()}`
      setThumbnailUrl(newUrl)
      setLoading(false)
    }, 2000)
    return () => clearTimeout(timeout)
  }, [loading, id])

  useEffect(() => {
    const handler = (e: CustomEvent) => { if (e.detail === id) setLoading(true) }
    window.addEventListener('thumbnail-generation', handler as EventListener)
    return () => window.removeEventListener('thumbnail-generation', handler as EventListener)
  }, [id])

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
      className="group relative shadow-xl shadow-gray-200/20 hover:shadow-gray-400/20 hover:shadow-lg dark:hover:shadow-primary-800/20 dark:shadow-none dark:hover:shadow-xl border-transparent bg-white/80 dark:bg-gray-950/70 dark:hover:border-primary-600/20 p-4 rounded-2xl border transition-all duration-200 cursor-pointer"
      onClick={handleCardClick}
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
                <CheckIcon className="w-4 h-4" />
              </IconButton>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h3
                className="text-xl font-fredoka font-normal text-gray-900 dark:text-white truncate cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                onClick={(e) => { if (!onRename) return; e.stopPropagation(); setOriginalName(newName); setIsEditingTitle(true) }}
              >
                {newName}
              </h3>
            </div>
          )}
        </div>

        {lastModified !== undefined && (
          <span className="flex mt-1 gap-1 items-center text-xs text-gray-400 dark:text-gray-400">
            {formatDate(lastModified)}
          </span>
        )}
        {invitedBy && (
          <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">Invited by: {invitedBy}</span>
        )}
      </div>

      <div className="flex space-x-6 items-center">
        <div className="flex flex-col flex-1 w-full items-start">
          {(typeof nodeCount !== 'undefined' || typeof edgeCount !== 'undefined') && (
            <div className="flex space-x-4 text-sm text-gray-500 dark:text-gray-400">
              {typeof nodeCount !== 'undefined' && (
                <div className="flex items-center gap-1">
                  <span className="flex items-center justify-center w-8 h-8 text-lg font-fredoka font-medium dark:bg-primary-900 border-2 border-primary-500 bg-primary-50/50 dark:border-none rounded-full text-primary-600 dark:text-primary-200">{nodeCount}</span>
                  <span className="font-medium font-fredoka text-base">nodes</span>
                </div>
              )}
              {typeof edgeCount !== 'undefined' && (
                <div className="flex items-center gap-1">
                  <span className="flex items-center justify-center w-8 h-8 text-lg font-fredoka font-medium dark:bg-primary-900 border-2 border-primary-500 bg-primary-50/50 dark:border-none rounded-full text-primary-600 dark:text-primary-200">{edgeCount}</span>
                  <span className="font-medium font-fredoka text-base">connections</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Thumbnail */}
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
                onError={() => { setImgError(true) }}
              />
            </div>
          ) : (
            <div className="w-16 h-16 rounded shadow flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-gray-800 dark:to-gray-700">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 select-none">
                {(newName || '').trim().split(/\s+/).slice(0, 2).map(s => (s[0] ? s[0].toUpperCase() : '')).join('') || 'NB'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Footer actions */}
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

      {/* Delete Modal */}
      {onDelete && (
        <Modal
          open={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          title="Delete Board"
          description={`Are you sure you want to delete "${newName}"? This action cannot be undone.`}
        >
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="secondary" size="small" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
            <Button variant="danger" size="small" onClick={() => { setShowDeleteModal(false); onDelete() }}>Delete</Button>
          </div>
        </Modal>
      )}

      {/* Share Modal */}
      {enableSharing && (
        <Modal
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
          title="Share Board"
          description="Copy a link or invite people by email."
        >
          <div className="space-y-4">
            <div>
              <div className="flex gap-2">
                <TextInput readOnly value={shareLink} fullWidth label="Share link" />
                <IconButton aria-label="Copy share link" size="lg" variant="secondary" onClick={() => { navigator.clipboard.writeText(shareLink) }}>
                  <Copy className="w-4 h-4" />
                </IconButton>
              </div>
            </div>

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
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="secondary" onClick={() => setShowShareModal(false)}>Close</Button>
              <Button onClick={() => { setShowShareModal(false); setShareEmails([]) }} disabled={shareEmails.length === 0}>Send Invites</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}


