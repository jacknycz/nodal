'use client'

import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Download, Maximize2, Minimize2, Trash2, CheckCircle, AlertCircle, Loader2, Focus } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import IconButton from '../../components/ui/IconButton'
import Button from '../../components/ui/Button'
import { useBoardStore } from '../board/boardSlice'

interface ImageNodeData {
  label: string
  title?: string
  type: string
  fileName?: string
  fileType?: string
  fileSize?: number
  status?: 'processing' | 'ready' | 'error'
  previewUrl?: string
  documentId?: string
  uploadedAt?: number
}

interface ImageNodeProps {
  data: ImageNodeData
  id: string
  onNodeDelete?: (nodeId: string) => void
  selected?: boolean
  acquireNodeLock?: (nodeId: string) => Promise<boolean>
  releaseNodeLock?: (nodeId: string) => Promise<void>
  isNodeLocked?: (nodeId: string) => boolean
  getNodeLockOwner?: (nodeId: string) => string | undefined
  isNodeLockedByMe?: (nodeId: string) => boolean
  nodeLocks?: any[]
}

export default function ImageNode({
  data,
  id,
  onNodeDelete,
  selected,
  acquireNodeLock,
  releaseNodeLock,
  isNodeLocked,
  getNodeLockOwner,
  isNodeLockedByMe,
  nodeLocks
}: ImageNodeProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = React.useRef<{ x: number; y: number } | null>(null)
  const pointerCacheRef = React.useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStartRef = React.useRef<{ distance: number; center: { x: number; y: number }; scale: number; translate: { x: number; y: number } } | null>(null)

  const isLocked = isNodeLocked?.(id) || false
  const isLockedByMe = isNodeLockedByMe?.(id) || false

  // Focus store
  const focusedNodeIds = useBoardStore((s) => s.focusedNodeIds || [])
  const focusAnchorIds = useBoardStore((s: any) => s.focusAnchorIds || [])
  const storeEdges = useBoardStore((s: any) => s.edges || [])
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

  const getStatusIcon = () => {
    switch (data.status) {
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteModal(true)
  }

  const handleConfirmDelete = () => {
    setShowDeleteModal(false)
    if (onNodeDelete) onNodeDelete(id)
  }

  const handleDownload = () => {
    if (!data.previewUrl) return
    try {
      const a = document.createElement('a')
      a.href = data.previewUrl
      a.download = data.fileName || data.title || 'image'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {}
  }

  const containerWidthClass = expanded ? 'w-[820px]' : 'w-[260px]'

  return (
    <div
      className={`flex flex-col justify-start text-left p-3 bg-white dark:bg-gray-800 border rounded-lg shadow-sm group ${containerWidthClass} ${
        isFocused
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400/50'
          : selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : isLocked && !isLockedByMe
          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
          : 'border-gray-200 dark:border-gray-700'
      } ${(hasFocus || focusAnchorIds.length > 0) && !isFocused ? 'opacity-40 blur-[1px]' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <div className="relative cursor-default">
        {/* Image content */}
        <div
          className="relative w-full select-none"
          onDoubleClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
            // Reset view on minimize
            if (expanded) {
              setScale(1)
              setTranslate({ x: 0, y: 0 })
            }
          }}
          onMouseDown={(e) => {
            if (!expanded) return
            e.stopPropagation()
            setIsPanning(true)
            panStartRef.current = { x: e.clientX - translate.x, y: e.clientY - translate.y }
          }}
          onMouseMove={(e) => {
            if (!expanded || !isPanning || !panStartRef.current) return
            e.preventDefault()
            const x = e.clientX - panStartRef.current.x
            const y = e.clientY - panStartRef.current.y
            setTranslate({ x, y })
          }}
          onMouseUp={() => {
            if (!expanded) return
            setIsPanning(false)
            panStartRef.current = null
          }}
          onMouseLeave={() => {
            if (!expanded) return
            setIsPanning(false)
            panStartRef.current = null
          }}
          onWheel={(e) => {
            if (!expanded) return
            e.preventDefault()
            const delta = -e.deltaY
            const zoomFactor = Math.exp(delta * 0.001)
            const newScale = Math.min(4, Math.max(1, scale * zoomFactor))
            // Zoom towards cursor
            const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
            const cx = e.clientX - rect.left
            const cy = e.clientY - rect.top
            const dx = (cx - translate.x) / scale
            const dy = (cy - translate.y) / scale
            const nx = cx - dx * newScale
            const ny = cy - dy * newScale
            setScale(newScale)
            setTranslate({ x: nx, y: ny })
          }}
          onPointerDown={(e) => {
            if (!expanded) return
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            pointerCacheRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
            if (pointerCacheRef.current.size === 2) {
              const pts = Array.from(pointerCacheRef.current.values())
              const dx = pts[0].x - pts[1].x
              const dy = pts[0].y - pts[1].y
              const distance = Math.hypot(dx, dy)
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
              const center = { x: (pts[0].x + pts[1].x) / 2 - rect.left, y: (pts[0].y + pts[1].y) / 2 - rect.top }
              pinchStartRef.current = { distance, center, scale, translate }
            }
          }}
          onPointerMove={(e) => {
            if (!expanded) return
            if (!pointerCacheRef.current.has(e.pointerId)) return
            pointerCacheRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
            if (pointerCacheRef.current.size === 2 && pinchStartRef.current) {
              const pts = Array.from(pointerCacheRef.current.values())
              const dx = pts[0].x - pts[1].x
              const dy = pts[0].y - pts[1].y
              const distance = Math.hypot(dx, dy)
              const factor = distance / pinchStartRef.current.distance
              const newScale = Math.min(4, Math.max(1, pinchStartRef.current.scale * factor))
              // Zoom towards pinch center
              const cx = pinchStartRef.current.center.x
              const cy = pinchStartRef.current.center.y
              const dx0 = (cx - pinchStartRef.current.translate.x) / pinchStartRef.current.scale
              const dy0 = (cy - pinchStartRef.current.translate.y) / pinchStartRef.current.scale
              const nx = cx - dx0 * newScale
              const ny = cy - dy0 * newScale
              setScale(newScale)
              setTranslate({ x: nx, y: ny })
            }
          }}
          onPointerUp={(e) => {
            if (!expanded) return
            pointerCacheRef.current.delete(e.pointerId)
            if (pointerCacheRef.current.size < 2) {
              pinchStartRef.current = null
            }
          }}
          onPointerCancel={(e) => {
            if (!expanded) return
            pointerCacheRef.current.delete(e.pointerId)
            pinchStartRef.current = null
          }}
        >
          {data.previewUrl ? (
            <img
              src={data.previewUrl}
              alt={data.fileName || data.title || 'Image'}
              className={`w-full h-auto rounded-md object-contain ${!isLoaded ? 'blur-sm saturate-50' : ''}`}
              style={{
                maxWidth: expanded ? 800 : 240,
                transform: expanded ? `translate(${translate.x}px, ${translate.y}px) scale(${scale})` : undefined,
                transformOrigin: '0 0',
              }}
              loading="lazy"
              decoding="async"
              onLoad={() => setIsLoaded(true)}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            />
          ) : (
            <div className={`rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-sm ${expanded ? 'w-[800px] h-[400px]' : 'w-full h-[180px]'}`}>
              No preview
            </div>
          )}

          {/* Minimize/Expand control overlay */}
          <div className="absolute top-1 right-1">
            {expanded ? (
              <IconButton
                variant="default"
                size="sm"
                aria-label="Minimize image"
                onClick={(e) => {
                  e.stopPropagation()
                  setExpanded(false)
                  setScale(1)
                  setTranslate({ x: 0, y: 0 })
                }}
              >
                <Minimize2 size={14} />
              </IconButton>
            ) : (
              <IconButton
                variant="default"
                size="sm"
                aria-label="Expand image"
                onClick={(e) => {
                  e.stopPropagation()
                  setExpanded(true)
                }}
                disabled={isLocked && !isLockedByMe}
              >
                <Maximize2 size={14} />
              </IconButton>
            )}
          </div>
        </div>

        {/* Filename, focus, and status - hidden when expanded */}
        {!expanded && (
          <>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {data.fileName || data.title || 'Image'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {formatFileSize(data.fileSize)} {data.fileType ? `• ${data.fileType}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  variant="default"
                  size="sm"
                  aria-label="Focus node"
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    toggleFocusOnNode(id, true)
                  }}
                >
                  <Focus size={14} />
                </IconButton>
              </div>
            </div>

            {data.status && (
              <div className="mt-2 flex items-center gap-2">
                {getStatusIcon()}
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {data.status === 'processing' ? 'Processing...' : data.status === 'ready' ? 'Ready' : 'Error'}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Hover actions - hidden when expanded */}
      {!expanded && (
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-2">
          <IconButton
            variant="default"
            size="sm"
            aria-label="Download image"
            onClick={handleDownload}
            disabled={isLocked && !isLockedByMe}
          >
            <Download size={14} />
          </IconButton>
          <IconButton
            variant="danger"
            size="sm"
            aria-label="Delete image"
            onClick={handleDelete}
            disabled={isLocked && !isLockedByMe}
          >
            <Trash2 size={14} />
          </IconButton>
        </div>
      )}

      {/* Delete Modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Image"
        description="Are you sure you want to delete this image? This action cannot be undone."
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

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
}


