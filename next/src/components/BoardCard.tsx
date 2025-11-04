'use client'

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import dynamic from 'next/dynamic'
import IconButton from './ui/IconButton'
import Button from './ui/Button'
import Tag from './ui/Tag'
import Select from './ui/Select'
const DynamicModal = dynamic(() => import('./ui/Modal'), { ssr: false })
import { ArrowRight, CaretCircleRight, Pencil, PushPin, ShareFat, SignOut, Tag as TagIcon, Users } from '@phosphor-icons/react/dist/ssr'
import ShareBoardModal from './ShareBoardModal'
import { useSupabaseUser } from '../features/auth/authUtils'
import Menu from './ui/Menu'
import { GearSix, Trash } from '@phosphor-icons/react/dist/ssr'
import Image from 'next/image'
import BoardSettingsModal from './BoardSettingsModal'
import { useRouter } from 'next/navigation'

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
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const user = useSupabaseUser()
  const canDelete = !!user?.id && (!!ownerId && user.id === ownerId)
  const [ownerLabel, setOwnerLabel] = useState<string>('')
  const [otherMembers, setOtherMembers] = useState<Array<{ user_id: string; role: string; label: string }>>([])
  const router = useRouter()

  // Load members for board (include owner and self)
  useEffect(() => {
    const loadMembers = async () => {
      try {
        if (!id || !ownerId || !user?.id) { setOtherMembers([]); return }
        const res = await fetch(`/api/board/members?boardId=${encodeURIComponent(id)}`)
        const json = await res.json().catch(() => ({ members: [] }))
        const members: Array<{ user_id: string; role: string; email?: string | null; username?: string | null }> = Array.isArray(json?.members) ? json.members : []
        const mapped = members.map(m => ({ user_id: m.user_id, role: String(m.role || ''), label: String(m.username || m.email || m.user_id) }))
        setOtherMembers(mapped)
      } catch {
        setOtherMembers([])
      }
    }
    loadMembers()
  }, [id, ownerId, invitedBy, user?.id])

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

  const getRoleRank = (role?: string) => {
    const r = String(role || '').toLowerCase()
    if (r === 'owner') return 0
    if (r === 'editor') return 1
    if (r === 'viewer' || r === 'reader') return 2
    return 3
  }

  // Resolve owner display (username/email) for shared boards
  useEffect(() => {
    const load = async () => {
      try {
        if (!ownerId || !user?.id || ownerId === user.id) { setOwnerLabel(''); return }
        const res = await fetch('/api/users/by-ids', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds: [ownerId] }) })
        const json = await res.json()
        const u = Array.isArray(json.users) ? json.users[0] : null
        setOwnerLabel(String(u?.username || u?.email || ''))
      } catch { setOwnerLabel('') }
    }
    load()
  }, [ownerId, user?.id])

  const handleCardClick = () => {
    if (showShareModal || showDeleteModal || isEditingTitle) return
    onLoad()
  }

  const isSharedForUser = !!ownerId && !!user?.id && ownerId !== user.id

  // Board is shared if current user is not the owner OR (owner and there are other members)
  const isSharedBoard = !!ownerId && !!user?.id && (
    ownerId !== user.id || otherMembers.some(m => m.user_id !== ownerId)
  )

  const handleLeaveBoard = async () => {
    try {
      await fetch('/api/board/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(user?.id || '') },
        body: JSON.stringify({ boardId: id })
      })
    } catch {}
    setShowLeaveModal(false)
    router.refresh()
  }

  return (
    <div
      className={`group relative flex flex-col 
      shadow-xl shadow-gray-200/20 hover:shadow-gray-400/20 hover:shadow-lg dark:hover:shadow-primary-800/20 dark:shadow-none dark:hover:shadow-xl 
      bg-white dark:bg-gray-950/60 dark:hover:bg-gray-950/70
      ${isSharedBoard ? 'border-primary-200 dark:border-primary-700/40' : 'border-transparent'}  
      dark:hover:border-primary-600/10 p-4 rounded-3xl border transition-all duration-200`}
      // onClick={handleCardClick}
      style={{ contentVisibility: 'auto', containIntrinsicSize: '160px 160px' as any }}
    >
      {typeof isPinned !== 'undefined' && onTogglePin && (
        <IconButton
          aria-label={isPinned ? 'Unpin board' : 'Pin board'}
          onClick={(e) => { e.stopPropagation(); onTogglePin() }}
          variant={isPinned ? 'primaryGhost' : 'secondaryGhost'}
          className={`absolute top-2 right-2 z-20 ${isPinned ? '' : 'opacity-50 hover:opacity-100'}`}
          size="small"
        >
          <PushPin size={16} weight="duotone" />
        </IconButton>
      )}

      <div className="mb-4">
        <h3 className="flex-1 pr-2 md:line-clamp-2 text-xl font-fredoka font-medium text-gray-900 dark:text-white">
          {name}
        </h3>
        {typeof topic === 'string' && topic.trim().length > 0 && (
          <div className="mt-2 gap-1 flex items-center">
            <TagIcon weight="duotone" className="w-3 h-3 text-gray-900 dark:text-white" size={12} />
            <span className="text-sm text-gray-800 dark:text-gray-100">{topic}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {lastModified !== undefined && (
            <span className="flex gap-1 items-center justify-center text-sm text-gray-400 dark:text-gray-400">
              <Pencil size={16} weight="duotone" className="w-3 h-3" /> {formatDate(lastModified)}
            </span>
          )}
        </div>

        {invitedBy && (
          <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">Invited by: {invitedBy}</span>
        )}

      </div>

      {/* <div className="flex my-4 space-x-6 items-center">
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
      </div> */}

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
      <div className="col-span-2 mt-auto pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between gap-2">
        {footerActions ? footerActions : (
          <>
            {/* Left: More menu */}
            <div className="flex items-center gap-2">
              <Menu
                trigger={
                  <IconButton aria-label="More actions" size="small" variant="secondaryOutline">
                    <Image src="/nodal.svg" alt="More" width={16} height={16} className="opacity-90" />
                  </IconButton>
                }
                align="left"
                portal
                placement="above"
                items={[
                  { label: 'Board Settings', icon: GearSix, onClick: () => { setShowSettingsModal(true) } },
                  ...(isSharedForUser ? [{ label: 'Leave Board', icon: SignOut, danger: true, onClick: () => { setShowLeaveModal(true) } }] : []),
                  ...(canDelete ? [{ label: 'Delete', icon: Trash, danger: true, onClick: () => { setShowDeleteModal(true) } }] : []),
                ]}
              />
              {/* Shared board: show members menu only */}
              {ownerId && user?.id && (
                ownerId !== user.id
                  ? (
                    <Menu
                      trigger={
                        <IconButton
                          variant="secondaryGhost"
                          size="small"
                          aria-label="Show members"
                        >
                          <Users size={16} weight="duotone" className="w-4 h-4" />
                        </IconButton>
                      }
                      align="left"
                      placement="above"
                      portal
                      width="w-64"
                      customContent={
                        <div className="py-2">
                          {otherMembers.length > 0 ? (
                            <ul className="flex flex-col gap-1">
                              {[...otherMembers]
                                .sort((a, b) => getRoleRank(a.role) - getRoleRank(b.role))
                                .map(m => {
                                  const isSelf = m.user_id === user.id
                                  const nameCls = isSelf ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-800 dark:text-gray-100'
                                  const pillCls = isSelf ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                  return (
                                    <li key={`${id}-menu-${m.user_id}`} className="px-3 py-0.5">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-sm truncate max-w-[160px] ${nameCls}`}>{m.label}</span>
                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide ${pillCls}`}>{m.role}</span>
                                      </div>
                                    </li>
                                  )
                                })}
                            </ul>
                          ) : (
                            <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No other members</div>
                          )}
                        </div>
                      }
                    />
                  )
                  : (
                    // Show only if there is at least one member besides the owner (shared)
                    (otherMembers.some(m => m.user_id !== ownerId)) ? (
                      <Menu
                        trigger={
                          <IconButton
                            variant="primaryGhost"
                            size="small"
                            aria-label="Show members"
                          >
                            <Users size={16} weight="duotone" className="w-4 h-4" />
                          </IconButton>
                        }
                        align="left"
                        portal
                        width="w-64"
                        customContent={
                          <div className="py-2">
                            {otherMembers.length > 0 ? (
                              <ul className="flex flex-col gap-1">
                                {[...otherMembers]
                                  .sort((a, b) => getRoleRank(a.role) - getRoleRank(b.role))
                                  .map(m => {
                                    const isSelf = m.user_id === user.id
                                    const nameCls = isSelf ? 'text-primary-700 dark:text-primary-300 font-medium' : 'text-gray-800 dark:text-gray-100'
                                    const pillCls = isSelf ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300' : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                                    return (
                                      <li key={`${id}-menu-${m.user_id}`} className="px-3 py-0.5">
                                        <div className="flex items-center gap-2">
                                          <span className={`text-sm truncate max-w-[160px] ${nameCls}`}>{m.label}</span>
                                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wide ${pillCls}`}>{m.role}</span>
                                        </div>
                                      </li>
                                    )
                                  })}
                              </ul>
                            ) : (
                              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No other members</div>
                            )}
                          </div>
                        }
                      />
                    ) : null
                  )
              )}

              {enableSharing && (
                <IconButton
                  variant="secondaryGhost"
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

      {/* Leave Board Modal */}
      <DynamicModal
        open={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        title="Leave Board"
        description="Are you sure you want to leave this board? You will lose access until re-invited."
      >
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" size="small" onClick={() => setShowLeaveModal(false)}>Cancel</Button>
          <Button variant="danger" size="small" onClick={handleLeaveBoard}>Leave Board</Button>
        </div>
      </DynamicModal>

      {/* Share Modal (shared) */}
      {enableSharing && (
        <ShareBoardModal open={showShareModal} onClose={() => setShowShareModal(false)} boardId={id} boardName={newName} />
      )}
      <BoardSettingsModal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} boardId={id} initialName={name} />
    </div>
  )
}

export default memo(BoardCard)
