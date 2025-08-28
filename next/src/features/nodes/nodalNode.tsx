'use client'

import React, { useState, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useBoardStore } from '../board/boardSlice'
import { Trash, Pen, Target } from "@phosphor-icons/react/ssr";
import Modal from '../../components/ui/Modal'
import IconButton from '../../components/ui/IconButton'
import Button from '../../components/ui/Button'
import NodeEditModal from '../../components/NodeEditModal'
import { useSupabaseUser } from '../auth/authUtils'

interface NodalNodeProps {
  data: {
    label: string
    title?: string
    content?: string
    type?: string
    expanded?: boolean
    aiGenerated?: boolean
  }
  id: string
  onNodeDelete?: (nodeId: string) => void
  onNodeUpdate?: (nodeId: string, updates: Partial<{ label: string; title: string; content: string }>) => void
  selected?: boolean
  // Add locking props
  acquireNodeLock?: (nodeId: string) => Promise<boolean>
  releaseNodeLock?: (nodeId: string) => Promise<void>
  isNodeLocked?: (nodeId: string) => boolean
  getNodeLockOwner?: (nodeId: string) => string | undefined
  isNodeLockedByMe?: (nodeId: string) => boolean
  nodeLocks?: any[]
  // Focus props injected via stable handlers
  focusedNodeIds?: string[]
  toggleFocusOnNode?: (nodeId: string) => void
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

  const focusedNodeIds = useBoardStore((s) => s.focusedNodeIds || [])
  const focusAnchorIds = useBoardStore((s: any) => s.focusAnchorIds || [])
  const storeEdges = useBoardStore((s: any) => s.edges || [])
  const connectingSourceId = useBoardStore((s: any) => s.connectingSourceId)
  const toggleFocusOnNode = useBoardStore((s) => s.toggleFocusOnNode)
  const hasFocus = Array.isArray(focusedNodeIds) && focusedNodeIds.length > 0
  const isFocusedBase = hasFocus ? focusedNodeIds.includes(id) : false
  const isAdjacentToAnchor = Array.isArray(focusAnchorIds) && focusAnchorIds.length > 0
    ? (storeEdges || []).some((e: any) => {
        const src = typeof e.source === 'string' ? e.source : (e.source as any)?.id
        const tgt = typeof e.target === 'string' ? e.target : (e.target as any)?.id
        return (src === id && focusAnchorIds.includes(tgt)) || (tgt === id && focusAnchorIds.includes(src)) || focusAnchorIds.includes(id)
      })
    : false
  const isFocused = isFocusedBase || isAdjacentToAnchor
  const isReceiveMode = !!connectingSourceId && connectingSourceId !== id

  const glowClass = isFocused
    ? 'shadow-[0_0_0_3px_rgba(59,130,246,0.2)]'
    : isLocked && !isLockedByMe
      ? 'shadow-[0_0_0_3px_rgba(239,68,68,0.12)]'
      : ''

  const borderClass = (() => {
    if (isFocused) return '!border-primary-500'
    if (selected) return '!border-primary-500'
    if (isLocked && !isLockedByMe) return '!border-red-500'
    return 'border-transparent dark:border-transparent'
  })()

  return (
    <div
      className={`flex flex-col justify-start text-left p-3 min-w-[240px] max-w-[540px] bg-white dark:bg-gray-800 border border-transparent rounded-lg shadow-sm shadow-gray-400/20 dark:shadow-none group ${glowClass} ${borderClass} ${isFocused ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400/50' : ''} ${(hasFocus || focusAnchorIds.length > 0) && !isFocused ? 'opacity-40 blur-[1px]' : ''} ${isReceiveMode ? 'ring-2 ring-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-900/10' : ''}`}
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

      <IconButton
        variant="default"
        size="sm"
        aria-label="Focus node"
        className="absolute -top-2 -right-2"
        onClick={(e) => {
          e.stopPropagation()
          e.preventDefault()
          if (typeof toggleFocusOnNode === 'function') {
            toggleFocusOnNode(id)
          } else if ((window as any).__toggleFocusOnNode) {
            (window as any).__toggleFocusOnNode(id)
          }
        }}
      >
        <Target size={14} weight="duotone" className='text-primary-500' />
      </IconButton>

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

      <Handle
        type="source"
        position={Position.Bottom}
        className="rf-handle-hit-32"
      />
    </div>
  )
}
