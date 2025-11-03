'use client'

import React, { useState, useRef, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useBoardStore } from '../board/boardSlice'
import { ArrowsOut, ArrowsIn, BookOpenText, Resize, Lock } from "@phosphor-icons/react/ssr";
import Modal from '../../components/ui/Modal'
import IconButton from '../../components/ui/IconButton'
import Button from '../../components/ui/Button'
import NodeEditModal from '../../components/NodeEditModal'
import { useSupabaseUser } from '../auth/authUtils'
import Tag from '../../components/ui/Tag'
import { getColorgoryHex } from '../board/colorgoryColors'
import Checkbox from '../../components/ui/Checkbox'
import { getNodeContainerClasses, NODE_HANDLE_CLASS, NODE_HANDLE_VISIBILITY_CLASS } from './nodeStyles'
import { useTheme } from '../../contexts/ThemeContext'
 
 

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
    pageMode?: boolean
    width?: number
  }
  id: string
  onNodeDelete?: (nodeId: string) => void
  onNodeUpdate?: (nodeId: string, updates: Record<string, any>) => void
  selected?: boolean
  onNodeShiftClickConnect?: (targetId: string) => void
  onQuickAddNodes?: (nodeId: string) => void
  onOrganizeSubtree?: (nodeId: string) => void
}

export default function NodalNode(props: any) {
  const { isDark } = useTheme()
  const {
    data,
    id,
    onNodeDelete,
    onNodeUpdate,
    selected,
    onNodeShiftClickConnect,
    onQuickAddNodes,
    onOrganizeSubtree
  } = props
  const SHOW_ADD_CONNECTED = false
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const user = useSupabaseUser()
  const [showColorgoryModal, setShowColorgoryModal] = useState(false)
  const [pendingColorgoryIds, setPendingColorgoryIds] = useState<string[]>(data.colorgoryIds || [])

  const displayTitle = data.label || data.title || 'Untitled'
  const pageMode = !!data.pageMode
  const [expanded, setExpanded] = useState(false)
  // Resizable width for default nodes
  const minWidth = 240
  const maxWidth = 600
  const initialWidth = Math.max(minWidth, Math.min(typeof data.width === 'number' ? data.width : 240, maxWidth))
  const [nodeWidth, setNodeWidth] = useState<number>(initialWidth)
  const currentWidthRef = useRef<number>(initialWidth)
  const isResizingRef = useRef<boolean>(false)
  // Sync external width updates (e.g., live resize from another user)
  React.useEffect(() => {
    if (isResizingRef.current) return
    const incoming = typeof data.width === 'number' ? data.width : undefined
    if (typeof incoming === 'number') {
      const clamped = Math.max(minWidth, Math.min(incoming, maxWidth))
      if (clamped !== nodeWidth) {
        setNodeWidth(clamped)
        currentWidthRef.current = clamped
      }
    }
  }, [data.width])
  const resizeStartRef = useRef<{ startX: number; startW: number } | null>(null)
  const onResizeDown = (e: React.MouseEvent) => {
    if ((props as any)?.readOnly) return
    if (pageMode) return
    e.stopPropagation(); e.preventDefault()
    resizeStartRef.current = { startX: e.clientX, startW: nodeWidth }
    isResizingRef.current = true
    const onMove = (ev: MouseEvent) => {
      if (!resizeStartRef.current) return
      const dx = ev.clientX - resizeStartRef.current.startX
      const next = Math.max(minWidth, Math.min(resizeStartRef.current.startW + dx, maxWidth))
      setNodeWidth(next)
      currentWidthRef.current = next
      try { (props as any).onLiveResize?.(id, next) } catch {}
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      isResizingRef.current = false
      onNodeUpdate?.(id, { width: Math.round(currentWidthRef.current) })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

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

  const handleSaveEdit = async (title: string, content: string, colorgoryIds?: string[], titleSize?: 'sm' | 'md' | 'lg', pageMode0?: boolean) => {
    if (onNodeUpdate) onNodeUpdate(id, { title, content, ...(colorgoryIds ? { colorgoryIds } : {}), ...(titleSize ? { titleSize } : {}), ...(typeof pageMode0 === 'boolean' ? { pageMode: pageMode0 } : {}) })
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
        className="tiptap-content text-xs text-gray-600 dark:text-gray-200 mb-3 leading-relaxed [&_a]:text-primary-600 dark:[&_a]:text-primary-400 [&_a:hover]:underline"
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
        .map((c: any) => getColorgoryHex(c.id))
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

  

  const baseWidthCls = useMemo(() => {
    if (pageMode) return expanded ? 'w-[640px]' : 'min-w-[360px] max-w-[360px]'
    return 'group flex flex-col'
  }, [pageMode, expanded])

  return (
    <div
      className={getNodeContainerClasses({ selected, receiveMode: isReceiveMode, extra: `${baseWidthCls} ${expanded ? 'h-[80vh] overflow-hidden' : ''}` })}
      style={{ position: 'relative', zIndex: expanded ? 1000 : undefined, ...(pageMode ? {} : { width: `${Math.round(nodeWidth)}px` }), ...(!isDark && swatchColors.length > 0 ? { background: (swatchColors.length === 1 ? swatchColors[0] : (`linear-gradient(to right, ${gradientStops})`)) } : {}) }}
      
    >
      {typeof props.isNodeLockedNow === 'function' && props.isNodeLockedNow(id) && (
        <div className="absolute top-1 right-1 z-50 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/90 text-white text-[10px] font-medium shadow">
          <Lock className="w-3 h-3" weight="duotone" />
          <span>Editing...</span>
        </div>
      )}
      {isDark && swatchColors.length > 0 && (
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
        className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`}
      />

      

      <div className={`${expanded ? 'cursor-default flex-1' : 'cursor-move'} flex flex-col min-h-0`}>
        <div className={`nodal-drag-handle flex items-center gap-2 w-full justify-between flex-none ${expanded ? 'cursor-default' : 'cursor-move'} ${pageMode ? 'px-2' : ''}`}>
          <h3 className={`${data.titleSize === 'lg' ? 'text-xl' : data.titleSize === 'md' ? 'text-base' : 'text-sm'} font-medium text-gray-900 dark:text-white`}>
            {displayTitle}
          </h3>
          {pageMode && (
            <BookOpenText size={20} weight="duotone" className="text-gray-400" />
          )}
        </div>
        {pageMode ? (
          <div className={`${expanded ? 'flex-1 min-h-0 nodrag nopan' : 'nodal-drag-handle cursor-move'} mb-3 px-2`}>
            {expanded ? (
              <div className="flex-1 min-h-0 h-full flex flex-col overflow-hidden">
                <div className="flex-1 min-h-0 overflow-y-auto">
                  {data.content ? renderRichContent(data.content) : null}
                </div>
              </div>
            ) : (
              <div className="relative">
                <div className="tiptap-content text-xs text-gray-600 dark:text-gray-200 leading-relaxed max-h-56 overflow-hidden">
                  {data.content ? renderRichContent(data.content) : null}
                </div>
                {data.content && <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/90 dark:from-gray-900/90 to-transparent" />}
              </div>
            )}
          </div>
        ) : (
          data.content && (
            <div className="mt-2">
              {renderRichContent(data.content)}
            </div>
          )
        )}
      </div>

      {pageMode && (
        <div className="mt-2 flex justify-end">
          <IconButton
            variant="default"
            size="sm"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={(e) => { e.stopPropagation(); setExpanded((v) => !v) }}
          >
            {expanded ? <ArrowsIn size={14} weight="duotone" /> : <ArrowsOut size={14} weight="duotone" />}
          </IconButton>
        </div>
      )}
      

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
          initialPageMode={pageMode}
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
          {(useBoardStore.getState().colorgories || []).filter((c: any) => c?.visible !== false).map((c: any) => (
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

      {/* Resize handle for default nodes */}
      {!pageMode && !(props as any)?.readOnly && (
        <div
          className="nodrag nopan hidden md:flex absolute -bottom-2 -right-2 w-6 h-6 items-center justify-center rounded-full bg-white dark:bg-primary-900 text-primary-600 dark:text-white cursor-se-resize shadow-lg hover:shadow-xl transition-opacity duration-200 ease-out opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
          onMouseDown={onResizeDown}
          title="Resize"
        >
          <Resize size={32} weight="duotone" className="w-4 h-4" />
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`}
      />
    </div>
  )
}
