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
import { colorgoryHexById } from '../board/colorgoryColors'
import Checkbox from '../../components/ui/Checkbox'
import { getNodeContainerClasses } from './nodeStyles'
import NodeActionDrawer from './NodeActionDrawer'
import ColorgoryQuickMenu from './ColorgoryQuickMenu'

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

  const handleSaveEdit = async (title: string, content: string, colorgoryIds?: string[]) => {
    if (onNodeUpdate) onNodeUpdate(id, { title, content, ...(colorgoryIds ? { colorgoryIds } : {}) })
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

  // Build colorgory swatch colors
  const colorgories = useBoardStore.getState().colorgories || []
  const swatchColors: string[] = Array.isArray(data.colorgoryIds)
    ? colorgories
        .filter((c: any) => data.colorgoryIds!.includes(c.id))
        .map((c: any) => colorgoryHexById[c.id] || '#9ca3af')
    : []

  // Build colorgory ring gradient
  const gradientStops = swatchColors.length <= 1
    ? (swatchColors[0] || '')
    : swatchColors.map((color, index) => {
        const percentage = (index / (swatchColors.length - 1)) * 100
        return `${color} ${percentage}%`
      }).join(', ')

  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div
      className={getNodeContainerClasses({ selected, isLocked, isLockedByMe, receiveMode: isReceiveMode, extra: 'min-w-[240px] max-w-[240px]' })}
      style={{ position: 'relative' }}
      onClick={(e) => {
        if (e.shiftKey) {
          e.preventDefault()
          e.stopPropagation()
          onNodeShiftClickConnect?.(id)
        }
        // Toggle drawer on tap for touch devices; keep desktop behavior via hover
        if ((e as any).pointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches) {
          setDrawerOpen((prev) => !prev)
        }
      }}
    >
      {swatchColors.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{
            padding: 3,
            background: swatchColors.length === 1 ? gradientStops : `linear-gradient(to right, ${gradientStops})`,
            // Draw only the ring via masking (outer minus inner)
            ...( { WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' } as any )
          }}
        />
      )}
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
      {/* Colorgories button moved to drawer */}
      {/* Slide-out action panel on hover */}
      <NodeActionDrawer open={drawerOpen}>
        <IconButton
          variant="default"
          size="sm"
          aria-label="Edit node"
          onClick={handleEdit}
          disabled={isLocked && !isLockedByMe || showEditModal}
        >
          <Pen size={14} weight="duotone" />
        </IconButton>
        <ColorgoryQuickMenu
          nodeId={id}
          selectedIds={data.colorgoryIds || []}
          onChange={(next) => onNodeUpdate?.(id, { colorgoryIds: next })}
          disabled={isLocked && !isLockedByMe}
          onNodeUpdate={onNodeUpdate}
        />
        <IconButton
          variant="danger"
          size="sm"
          aria-label="Delete node"
          onClick={handleDelete}
          disabled={isLocked && !isLockedByMe}
        >
          <Trash size={14} weight="duotone" />
        </IconButton>
      </NodeActionDrawer>

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
          initialColorgoryIds={data.colorgoryIds || []}
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
