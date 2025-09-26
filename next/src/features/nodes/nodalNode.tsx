'use client'

import React, { useState, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useBoardStore } from '../board/boardSlice'
import { Trash, Pen, PlusCircle, TreeView } from "@phosphor-icons/react/ssr";
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
import Tooltip from '../../components/ui/Tooltip'
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
    titleSize?: 'sm' | 'md' | 'lg'
  }
  id: string
  onNodeDelete?: (nodeId: string) => void
  onNodeUpdate?: (nodeId: string, updates: Record<string, any>) => void
  selected?: boolean
  onNodeShiftClickConnect?: (targetId: string) => void
  onQuickAddNodes?: (nodeId: string) => void
  onOrganizeSubtree?: (nodeId: string) => void
}

export default function NodalNode({
  data,
  id,
  onNodeDelete,
  onNodeUpdate,
  selected,
  onNodeShiftClickConnect,
  onQuickAddNodes,
  onOrganizeSubtree
}: NodalNodeProps) {
  const SHOW_ADD_CONNECTED = false
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const user = useSupabaseUser()
  const [showColorgoryModal, setShowColorgoryModal] = useState(false)
  const [pendingColorgoryIds, setPendingColorgoryIds] = useState<string[]>(data.colorgoryIds || [])

  const displayTitle = data.label || data.title || 'Untitled'

  // Debug logs for lock state
  // console.log(`[NodalNode ${id}] isLocked: ${isLocked}, isLockedByMe: ${isLockedByMe}, showEditModal: ${showEditModal}, nodeLocks count: ${nodeLocks?.length || 0}`)
  // console.log(`[NodalNode ${id}] user:`, user, 'user?.id:', user?.id)
  // if (nodeLocks && nodeLocks.length > 0) {
  //   console.log(`[NodalNode ${id}] All nodeLocks:`, nodeLocks)
  //   console.log(`[NodalNode ${id}] Filtered nodeLocks for this node:`, nodeLocks.filter(lock => lock.node_id === id))
  // }

  // Open modal (collab locks disabled)
  const handleEdit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setShowEditModal(true)
  }

  // Close modal
  const handleCloseEdit = async () => {
    setShowEditModal(false)
  }

  const handleSaveEdit = async (title: string, content: string, colorgoryIds?: string[], titleSize?: 'sm' | 'md' | 'lg') => {
    if (onNodeUpdate) onNodeUpdate(id, { title, content, ...(colorgoryIds ? { colorgoryIds } : {}), ...(titleSize ? { titleSize } : {}) })
    setShowEditModal(false)
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
    : (() => {
        const n = swatchColors.length
        const segment = 100 / n
        const blendWidth = segment * 0.3 // 30% of each band blends into the next
        const half = blendWidth / 2
        const stops: string[] = []
        stops.push(`${swatchColors[0]} 0%`)
        for (let i = 0; i < n - 1; i++) {
          const boundary = segment * (i + 1)
          const p0 = Math.max(0, boundary - half)
          const p1 = Math.min(100, boundary + half)
          stops.push(`${swatchColors[i]} ${p0}%`, `${swatchColors[i + 1]} ${p1}%`)
        }
        stops.push(`${swatchColors[n - 1]} 100%`)
        return stops.join(', ')
      })()

  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div
      className={getNodeContainerClasses({ selected, receiveMode: isReceiveMode, extra: 'min-w-[240px] max-w-[240px]' })}
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
            padding: 4,
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
          <h3 className={`${data.titleSize === 'lg' ? 'text-lg' : data.titleSize === 'md' ? 'text-base' : 'text-sm'} font-medium text-gray-900 dark:text-white`}>
            {displayTitle}
          </h3>
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
        <Tooltip content="Edit">
          <IconButton
            variant="default"
            
            aria-label="Edit node"
            onClick={handleEdit}
          >
            <Pen size={14} weight="duotone" />
          </IconButton>
        </Tooltip>
       
        {SHOW_ADD_CONNECTED && (
          <Tooltip content="Add connected">
            <IconButton
              variant="default"
              
              aria-label="Add Connected Nodes"
              onClick={() => onQuickAddNodes?.(id)}
            >
              <PlusCircle size={14} weight="duotone" />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip content="Reorganize nodes">
          <IconButton
            variant="default"
            
            aria-label="Reorganize nodes"
            onClick={() => onOrganizeSubtree?.(id)}
          >
            <TreeView size={14} weight="duotone" />
          </IconButton>
        </Tooltip>

        <ColorgoryQuickMenu
          nodeId={id}
          selectedIds={data.colorgoryIds || []}
          onChange={(next) => onNodeUpdate?.(id, { colorgoryIds: next })}
          onNodeUpdate={onNodeUpdate}
        />

        <Tooltip content="Delete">
          <IconButton
            variant="danger"
            
            aria-label="Delete node"
            onClick={handleDelete}
          >
            <Trash size={14} weight="duotone" />
          </IconButton>
        </Tooltip>
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
          initialTitleSize={data.titleSize || 'sm'}
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
