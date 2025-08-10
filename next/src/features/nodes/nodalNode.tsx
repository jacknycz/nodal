'use client'

import React, { useState, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useBoardStore } from '../board/boardSlice'
import { Trash2, Edit3, Focus } from 'lucide-react'
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
  nodeLocks
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
  const toggleFocusOnNode = useBoardStore((s) => s.toggleFocusOnNode)
  const hasFocus = Array.isArray(focusedNodeIds) && focusedNodeIds.length > 0
  const isFocused = hasFocus ? focusedNodeIds.includes(id) : false

  const glowClass = isFocused
    ? 'border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.2)]'
    : selected
    ? 'border-blue-500'
    : isLocked && !isLockedByMe
    ? 'border-red-500'
    : 'border-gray-200 dark:border-gray-700'

  return (
    <div
      className={`flex flex-col justify-start text-left p-4 min-w-[240px] max-w-[540px] bg-white dark:bg-gray-800 border rounded-lg shadow-sm group ${glowClass} ${isFocused ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400/50' : ''} ${hasFocus && !isFocused ? 'opacity-40 blur-[1px]' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="nodal-drag-handle cursor-move">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
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
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <IconButton
          variant="default"
          size="sm"
          aria-label="Focus node"
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
          <Focus size={14} />
        </IconButton>
        <IconButton
          variant="default"
          size="sm"
          aria-label="Edit node"
          onClick={handleEdit}
          disabled={isLocked && !isLockedByMe || showEditModal}
        >
          <Edit3 size={14} />
        </IconButton>
        <IconButton
          variant="danger"
          size="sm"
          aria-label="Delete node"
          onClick={handleDelete}
          disabled={isLocked && !isLockedByMe}
        >
          <Trash2 size={14} />
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

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
}
