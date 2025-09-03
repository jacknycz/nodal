'use client'

import React, { useState, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useBoardStore } from '../board/boardSlice'
import { Trash, Pen } from "@phosphor-icons/react/ssr";
import Modal from '../../components/ui/Modal'
import IconButton from '../../components/ui/IconButton'
import Button from '../../components/ui/Button'
import NodeEditModal from '../../components/NodeEditModal'
import { useSupabaseUser } from '../auth/authUtils'
import Tag from '../../components/ui/Tag'
import Checkbox from '../../components/ui/Checkbox'

interface NodalNodeProps {
  data: {
    label: string
    title?: string
    content?: string
    type?: string
    expanded?: boolean
    aiGenerated?: boolean
    colorgoryIds?: string[]
  }
  id: string
  onNodeDelete?: (nodeId: string) => void
  onNodeUpdate?: (nodeId: string, updates: Record<string, any>) => void
  selected?: boolean
  // Add locking props
  acquireNodeLock?: (nodeId: string) => Promise<boolean>
  releaseNodeLock?: (nodeId: string) => Promise<void>
  isNodeLocked?: (nodeId: string) => boolean
  getNodeLockOwner?: (nodeId: string) => string | undefined
  isNodeLockedByMe?: (nodeId: string) => boolean
  nodeLocks?: any[]
  onNodeShiftClickConnect?: (targetId: string) => void
}

export default function NodalNode({
  data,
  id,
  onNodeDelete,
  onNodeUpdate,
  selected,
  acquireNodeLock,
  releaseNodeLock,
  isNodeLocked,
  getNodeLockOwner,
  isNodeLockedByMe,
  nodeLocks,
  onNodeShiftClickConnect
}: NodalNodeProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const justOpenedRef = useRef(false)
  const lockReleasedRef = useRef(false)
  const user = useSupabaseUser()
  const [showColorgoryModal, setShowColorgoryModal] = useState(false)
  const [pendingColorgoryIds, setPendingColorgoryIds] = useState<string[]>(data.colorgoryIds || [])

  const displayTitle = data.label || data.title || 'Untitled'

  // Use DB state for lock
  const isLocked = isNodeLocked?.(id) || false
  const isLockedByMe = isNodeLockedByMe?.(id) || false

  // Debug logs for lock state
  // console.log(`[NodalNode ${id}] isLocked: ${isLocked}, isLockedByMe: ${isLockedByMe}, showEditModal: ${showEditModal}, nodeLocks count: ${nodeLocks?.length || 0}`)
  // console.log(`[NodalNode ${id}] user:`, user, 'user?.id:', user?.id)
  // if (nodeLocks && nodeLocks.length > 0) {
  //   console.log(`[NodalNode ${id}] All nodeLocks:`, nodeLocks)
  //   console.log(`[NodalNode ${id}] Filtered nodeLocks for this node:`, nodeLocks.filter(lock => lock.node_id === id))
  // }

  // Open modal and acquire lock
  const handleEdit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (isLocked && !isLockedByMe) return
    if (showEditModal) return

    // Check if user is authenticated before trying to lock
    console.log('[DEBUG] handleEdit - user state:', user, 'user?.id:', user?.id)
    if (!user || !user.id) {
      alert('Please wait for authentication to complete before editing.')
      return
    }

    if (acquireNodeLock) {
      console.log('[DEBUG] About to call acquireNodeLock for node:', id)
      const lockAcquired = await acquireNodeLock(id)
      console.log('[DEBUG] Lock acquired?', lockAcquired, 'for node:', id)
      if (!lockAcquired) {
        alert('This node is being edited by another user. Please wait.')
        return
      }
    } else {
      console.log('[DEBUG] acquireNodeLock function not available')
    }
    setShowEditModal(true)
    lockReleasedRef.current = false // Reset lock release flag
    console.log('[DEBUG] Modal opened for node:', id)
    justOpenedRef.current = true
    setTimeout(() => { justOpenedRef.current = false }, 100)
  }

  // Close modal and release lock
  const handleCloseEdit = async () => {
    if (justOpenedRef.current) return
    setShowEditModal(false)
    console.log('[DEBUG] Modal closed for node:', id)
    if (releaseNodeLock && !lockReleasedRef.current) {
      try {
        await releaseNodeLock(id)
        lockReleasedRef.current = true
        console.log('[DEBUG] Lock released (close) for node:', id)
      } catch (error) {
        console.error('[DEBUG] Failed to release lock (close) for node:', id, error)
      }
    } else if (lockReleasedRef.current) {
      console.log('[DEBUG] Lock already released, skipping close release for node:', id)
    }
  }

  const handleSaveEdit = async (title: string, content: string) => {
    if (onNodeUpdate) onNodeUpdate(id, { title, content })
    // Release lock BEFORE closing modal
    if (releaseNodeLock && !lockReleasedRef.current) {
      try {
        await releaseNodeLock(id)
        lockReleasedRef.current = true
        console.log('[DEBUG] Lock released (save) for node:', id)
      } catch (error) {
        console.error('[DEBUG] Failed to release lock (save) for node:', id, error)
      }
    } else if (lockReleasedRef.current) {
      console.log('[DEBUG] Lock already released, skipping save release for node:', id)
    }
    setShowEditModal(false)
    console.log('[DEBUG] Modal closed (save) for node:', id)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = () => {
    setShowDeleteModal(false)
    if (onNodeDelete) {
      onNodeDelete(id)
    }
  }

  // Function to render rich content safely
  const renderRichContent = (htmlContent: string) => {
    return (
      <div
        className="text-xs text-gray-600 dark:text-gray-200 mb-3 prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    )
  }

  const connectingSourceId = useBoardStore((s: any) => s.connectingSourceId)
  const isReceiveMode = !!connectingSourceId && connectingSourceId !== id

  const glowClass = isLocked && !isLockedByMe
      ? 'shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
      : ''

  const borderClass = (() => {
    if (selected) return '!border-primary-500'
    if (isLocked && !isLockedByMe) return '!border-red-500'
    return 'border-transparent dark:border-transparent'
  })()

  return (
    <div
      className={`flex flex-col justify-start text-left p-3 min-w-[240px] max-w-[240px] bg-white dark:bg-gray-800 border border-transparent rounded-lg shadow-sm shadow-gray-400/20 dark:shadow-none group ${glowClass} ${borderClass} ${isReceiveMode ? 'ring-2 ring-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-900/10' : ''}`}
      onClick={(e) => {
        if (e.shiftKey) {
          e.preventDefault()
          e.stopPropagation()
          onNodeShiftClickConnect?.(id)
        }
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="rf-handle-hit-32"
      />

      

      <div className="nodal-drag-handle cursor-move">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {displayTitle}
          </h3>
          {(isLocked || showEditModal) && (
            <div className="flex items-center gap-1 text-xs">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-600 dark:text-red-400">
                {isLockedByMe || showEditModal ? 'Editing...' : 'Locked'}
              </span>
            </div>
          )}
        </div>
        {data.content && (
          <div className="mb-3">
            {renderRichContent(data.content)}
          </div>
        )}
      </div>
      {/* Colorgories */}
      {Array.isArray((data as any).colorgoryIds) && (data as any).colorgoryIds.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {(useBoardStore.getState().colorgories || [])
            .filter(c => (data as any).colorgoryIds?.includes(c.id))
            .map(c => {
              const color = c.color.toLowerCase()
              const variant = color === 'red' ? 'danger'
                : color === 'yellow' || color === 'orange' ? 'warning'
                : color === 'green' ? 'success'
                : color === 'blue' || color === 'cyan' ? 'primary'
                : 'secondary'
              return (
                <Tag key={c.id} variant={variant as any}>{c.name}</Tag>
              )
            })}
        </div>
      )}
      {/* Colorgories add button */}
      <div className="mb-2">
        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setPendingColorgoryIds(data.colorgoryIds || []); setShowColorgoryModal(true) }}>
          Colorgories
        </Button>
      </div>
      {/* Action buttons - only show on hover and if not locked by someone else */}
      <div className="flex w-full items-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <IconButton
          variant="default"
          size="sm"
          aria-label="Edit node"
          onClick={handleEdit}
          disabled={isLocked && !isLockedByMe || showEditModal}
        >
          <Pen size={14} weight="duotone" />
        </IconButton>
        <IconButton
          variant="danger"
          size="sm"
          aria-label="Delete node"
          onClick={handleDelete}
          disabled={isLocked && !isLockedByMe}
        >
          <Trash size={14} weight="duotone" />
        </IconButton>
      </div>

      {/* Modals */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Node"
        description="Are you sure you want to delete this node? This action cannot be undone."
        actions={
          <>
            <Button onClick={() => setShowDeleteModal(false)} variant="secondary">
              Cancel
            </Button>
            <Button onClick={handleConfirmDelete} variant="danger">
              Delete
            </Button>
          </>
        }
      />

      {showEditModal && (
        <NodeEditModal
          open={showEditModal}
          onClose={handleCloseEdit}
          onSave={handleSaveEdit}
          initialTitle={displayTitle}
          initialContent={data.content || ''}
        />
      )}

      {/* Colorgories Modal */}
      <Modal
        open={showColorgoryModal}
        onClose={() => setShowColorgoryModal(false)}
        title="Colorgories"
        description="Choose categories to apply to this node"
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowColorgoryModal(false)}>Cancel</Button>
            <Button onClick={() => {
              onNodeUpdate?.(id, { colorgoryIds: pendingColorgoryIds })
              setShowColorgoryModal(false)
            }}>Save</Button>
          </>
        }
      >
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(useBoardStore.getState().colorgories || []).map((c: any) => (
            <Checkbox
              key={c.id}
              checked={pendingColorgoryIds.includes(c.id)}
              onChange={(checked) => {
                setPendingColorgoryIds((prev) => {
                  const has = prev.includes(c.id)
                  if (checked && !has) return [...prev, c.id]
                  if (!checked && has) return prev.filter(id0 => id0 !== c.id)
                  return prev
                })
              }}
              label={c.name}
              labelTextClassName="text-sm"
            />
          ))}
        </div>
      </Modal>

      <Handle
        type="source"
        position={Position.Bottom}
        className="rf-handle-hit-32"
      />
    </div>
  )
}
