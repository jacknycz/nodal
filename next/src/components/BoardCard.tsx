'use client'

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import IconButton from './ui/IconButton'
import Button from './ui/Button'
import Tag from './ui/Tag'
import Select from './ui/Select'
const DynamicModal = dynamic(() => import('./ui/Modal'), { ssr: false })
import { ArrowRight, CaretCircleRight, PushPin, Share, ShareFat } from '@phosphor-icons/react/dist/ssr'
import ShareBoardModal from './ShareBoardModal'
import { useSupabaseUser } from '../features/auth/authUtils'
import Menu from './ui/Menu'
import { GearSix, Trash } from '@phosphor-icons/react/dist/ssr'
import Image from 'next/image'
import BoardSettingsModal from './BoardSettingsModal'

interface BoardCardProps {
  id: string
  name: string
  ownerId?: string
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
  topic?: string | null
}

function BoardCard({
  id,
  name,
  ownerId,
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
  topic,
}: BoardCardProps) {
  const [newName, setNewName] = useState(name)

  const [isEditingTitle] = useState(false)
  const [originalName] = useState(name)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const user = useSupabaseUser()
  const canDelete = !!user?.id && (!!ownerId && user.id === ownerId)

  useEffect(() => { setNewName(name) }, [name])
  // All share logic moved into shared ShareBoardModal

  // Thumbnails removed

  const commitTitleEdit = useCallback(() => {
    const trimmed = newName.trim()
    if (!trimmed) { setNewName(originalName); return }
    if (trimmed !== originalName) { onRename?.(trimmed) }
  }, [newName, originalName, onRename])

  // Title editing removed from card view

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
      className="group relative flex flex-col 
      shadow-xl shadow-gray-200/20 hover:shadow-gray-400/20 hover:shadow-lg dark:hover:shadow-primary-800/20 dark:shadow-none dark:hover:shadow-xl 
      bg-white dark:bg-gray-950/60 dark:hover:bg-slate-700/98
      border-transparent  dark:hover:border-primary-600/20 p-4 rounded-2xl border transition-all duration-200"
      // onClick={handleCardClick}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '160px 160px' as any }}
    >
      {typeof isPinned !== 'undefined' && onTogglePin && (
        <IconButton
          aria-label={isPinned ? 'Unpin board' : 'Pin board'}
          onClick={(e) => { e.stopPropagation(); onTogglePin() }}
          variant={isPinned ? 'primaryGhost' : 'secondaryGhost'}
          className={`absolute top-0 right-0 z-20 ${isPinned ? '' : 'opacity-50 hover:opacity-100'}`}
          size="small"
        >
          <PushPin size={16} weight="duotone" />
        </IconButton>
      )}

      <div className="mb-1">
        <h3 className="flex-1 pr-2 md:line-clamp-2 text-xl font-fredoka font-normal text-gray-900 dark:text-white">
          {name}
        </h3>
        {typeof topic === 'string' && topic.trim().length > 0 && (
          <div className="mt-1">
            <Tag variant="secondary" className="max-w-full truncate">{topic}</Tag>
          </div>
        )}

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

      <div className="flex my-4 space-x-6 items-center">
        <div className="flex flex-col flex-1 w-full items-start">
          {(typeof nodeCount !== 'undefined' || typeof edgeCount !== 'undefined') && (
            <div className="flex space-x-4 font-medium text-gray-500 dark:text-gray-200">
              {typeof nodeCount !== 'undefined' && (
                <div className="flex items-center gap-1">
                  <span className="text-lg font-fredoka font-medium">{nodeCount}</span>
                  <span className="">nodes</span>
                </div>
              )}
              {typeof edgeCount !== 'undefined' && (
                <div className="flex items-center gap-1">
                  <span className="text-lg font-fredoka font-medium">{edgeCount}</span>
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
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt="Template cover" className="w-full h-32 object-cover rounded-md border border-gray-200 dark:border-gray-700" />
          )}
          {description && (
            <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-3">{description}</div>
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="col-span-2 mt-auto pt-3 flex items-center justify-between gap-2">
        {footerActions ? footerActions : (
          <>
            {/* Left: More menu */}
            <div className="flex items-center gap-2">
              <Menu
                trigger={
                  <IconButton aria-label="More actions" size="small" variant="primaryOutline">
                    <Image src="/nodal.svg" alt="More" width={16} height={16} className="opacity-90" />
                  </IconButton>
                }
                align="left"
                portal
                placement="above"
                items={[
                  { label: 'Board Settings', icon: GearSix, onClick: () => { setShowSettingsModal(true) } },
                  ...(canDelete ? [{ label: 'Delete', icon: Trash, onClick: () => { setShowDeleteModal(true) } }] : []),
                ]}
              />
              {enableSharing && (
                <IconButton
                  variant="secondaryOutline"
                  size="small"
                  onClick={e => { e.stopPropagation(); setShowShareModal(true) }}
                  aria-label="Share board"
                >
                  <ShareFat size={16} weight="duotone" className="w-4 h-4" />
                </IconButton>
              )}
            </div>

            {/* Right: Share + Edit */}
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="small"
                onClick={(e) => { e.stopPropagation(); onLoad() }}
                title="Open board"
                iconRight={<CaretCircleRight size={16} weight="duotone" className="w-5 h-4" />}
              >
                Open
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Delete Modal */}
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

      {/* Share Modal (shared) */}
      {enableSharing && (
        <ShareBoardModal open={showShareModal} onClose={() => setShowShareModal(false)} boardId={id} boardName={newName} />
      )}
      <BoardSettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} boardId={id} initialName={name} />
    </div>
  )
}

export default memo(BoardCard)
