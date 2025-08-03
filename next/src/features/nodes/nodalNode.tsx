'use client'

import React, { useState, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash2, Edit3 } from 'lucide-react'
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
  const user = useSupabaseUser()

  const displayTitle = data.label || data.title || 'Untitled'

  // Use DB state for lock
  const isLocked = isNodeLocked?.(id) || false
  const isLockedByMe = isNodeLockedByMe?.(id) || false

  // Open modal and acquire lock
  const handleEdit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (isLocked && !isLockedByMe) return
    if (showEditModal) return

    if (acquireNodeLock) {
      const lockAcquired = await acquireNodeLock(id)
      console.log('[DEBUG] Lock acquired?', lockAcquired, 'for node:', id)
      if (!lockAcquired) {
        alert('This node is being edited by another user. Please wait.')
        return
      }
    }
    setShowEditModal(true)
    console.log('[DEBUG] Modal opened for node:', id)
    justOpenedRef.current = true
    setTimeout(() => { justOpenedRef.current = false }, 100)
  }

  // Close modal and release lock
  const handleCloseEdit = () => {
    if (justOpenedRef.current) return
    setShowEditModal(false)
    console.log('[DEBUG] Modal closed for node:', id)
    if (releaseNodeLock) {
      releaseNodeLock(id)
      console.log('[DEBUG] Lock released (close) for node:', id)
    }
  }

  const handleSaveEdit = (title: string, content: string) => {
    if (onNodeUpdate) onNodeUpdate(id, { title, content })
    if (releaseNodeLock) {
      releaseNodeLock(id)
      console.log('[DEBUG] Lock released (save) for node:', id)
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

  return (
    <div
      className={`flex flex-col justify-start text-left p-4 min-w-[240px] max-w-[540px] bg-white dark:bg-gray-800 border rounded-lg shadow-sm group ${
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : isLocked && !isLockedByMe
          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
          : 'border-gray-200 dark:border-gray-700'
      }`}
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
      {showDeleteModal && (
        <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)}>
          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">Delete Node</h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete this node? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <Button onClick={handleConfirmDelete} variant="danger">
                Delete
              </Button>
              <Button onClick={() => setShowDeleteModal(false)} variant="secondary">
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}

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
