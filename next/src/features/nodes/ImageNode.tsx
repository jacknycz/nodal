'use client'

import React, { useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { DownloadSimple, ArrowsOut, ArrowsIn, Trash, CheckCircle, Warning, Spinner } from '@phosphor-icons/react'
import Image from 'next/image'
import Modal from '../../components/ui/Modal'
import IconButton from '../../components/ui/IconButton'
import Button from '../../components/ui/Button'
import { useBoardStore } from '../board/boardSlice'
import Tag from '../../components/ui/Tag'
import Checkbox from '../../components/ui/Checkbox'

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
  colorgoryIds?: string[]
}

interface ImageNodeProps {
  data: ImageNodeData
  id: string
  onNodeDelete?: (nodeId: string) => void
  onNodeUpdate?: (nodeId: string, updates: Record<string, any>) => void
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
  onNodeUpdate,
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
  const [showColorgoryModal, setShowColorgoryModal] = useState(false)
  const [pendingColorgoryIds, setPendingColorgoryIds] = useState<string[]>((data as any).colorgoryIds || [])
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = React.useRef<{ x: number; y: number } | null>(null)
  const pointerCacheRef = React.useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStartRef = React.useRef<{ distance: number; center: { x: number; y: number }; scale: number; translate: { x: number; y: number } } | null>(null)

  // Status visibility (auto-hide when status becomes 'ready')
  const [showStatus, setShowStatus] = useState<boolean>(!!data.status)
  useEffect(() => {
    // Always show when status changes, then auto-hide for 'ready'
    setShowStatus(true)
    let timer: ReturnType<typeof setTimeout> | null = null
    if (data.status === 'ready') {
      timer = setTimeout(() => setShowStatus(false), 5000)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [data.status])

  const isLocked = isNodeLocked?.(id) || false
  const isLockedByMe = isNodeLockedByMe?.(id) || false

  // Focus removed

  const getStatusIcon = () => {
    switch (data.status) {
      case 'processing':
        return <Spinner className="w-4 h-4 animate-spin text-blue-500" />
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <Warning className="w-4 h-4 text-red-500" />
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
    } catch { }
  }

  const containerWidthClass = expanded ? 'w-[820px]' : 'w-[260px]'

  return (
    <div
      className={`flex flex-col justify-start text-left p-3 bg-white dark:bg-gray-800 border rounded-lg shadow-sm group hover:cursor-move ${containerWidthClass} ${selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : isLocked && !isLockedByMe
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
            : 'border-gray-200 dark:border-gray-700'
        }`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      

      <div className="relative cursor-default">
        {/* Image content */}
        <div
          className="relative w-full select-none"
          onClick={(e) => {
            e.stopPropagation()
            if (expanded) {
              // collapse and reset view
              setExpanded(false)
              setScale(1)
              setTranslate({ x: 0, y: 0 })
            } else {
              setExpanded(true)
            }
          }}
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
              ; (e.target as HTMLElement).setPointerCapture(e.pointerId)
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
            <Image
              src={data.previewUrl}
              alt={data.fileName || data.title || 'Image'}
              className={`w-full h-auto rounded-md object-contain cursor-pointer ${!isLoaded ? 'blur-sm saturate-50' : ''}`}
              width={expanded ? 800 : 240}
              height={expanded ? 500 : 180}
              style={{
                transform: expanded ? `translate(${translate.x}px, ${translate.y}px) scale(${scale})` : undefined,
                transformOrigin: '0 0',
              }}
              onLoadingComplete={() => setIsLoaded(true)}
              unoptimized
            />
          ) : (
            <div className={`rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-sm ${expanded ? 'w-[800px] h-[400px]' : 'w-full h-[180px]'}`}>
              No preview
            </div>
          )}

          {/* Minimize/Expand control overlay */}
          <div className="absolute bottom-1 left-1">
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
                <ArrowsIn size={14} />
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
                <ArrowsOut size={14} />
              </IconButton>
            )}
          </div>
        </div>

        {/* Filename, focus, and status - hidden when expanded */}
        {!expanded && (
          <>
            <div className="mt-2 flex items-center gap-2 cursor-move">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {data.fileName || data.title || 'Image'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {formatFileSize(data.fileSize)} {data.fileType ? `• ${data.fileType}` : ''}
                </div>
              </div>
            </div>

            {data.status && (
              <div className={`mt-2 flex items-center gap-1 transition-opacity duration-300 ${showStatus ? 'opacity-100' : 'opacity-0'}`}>
                {getStatusIcon()}
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {data.status === 'processing' ? 'Processing...' : data.status === 'ready' ? 'Ready' : 'Error'}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Colorgories */}
      {Array.isArray((data as any).colorgoryIds) && (data as any).colorgoryIds.length > 0 && (
        <div className="mt-2 mb-1 flex flex-wrap gap-1">
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
        <Button variant="secondary" size="sm" onClick={(e) => { e.stopPropagation(); setPendingColorgoryIds((data as any).colorgoryIds || []); setShowColorgoryModal(true) }}>
          Colorgories
        </Button>
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
            <DownloadSimple size={14} />
          </IconButton>
          <IconButton
            variant="danger"
            size="sm"
            aria-label="Delete image"
            onClick={handleDelete}
            disabled={isLocked && !isLockedByMe}
          >
            <Trash size={14} />
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

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
}


