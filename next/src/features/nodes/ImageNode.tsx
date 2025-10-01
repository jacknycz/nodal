'use client'

import React, { useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash, CheckCircle, Warning, Spinner, PlusCircle, Pencil, TreeView, CaretCircleDown, Resize } from '@phosphor-icons/react'
// Using a standard <img> so we can control srcSet with signed URLs
import Modal from '../../components/ui/Modal'
import NodeEditModal from '../../components/NodeEditModal'
import Button from '../../components/ui/Button'
import { useBoardStore } from '../board/boardSlice'
import Checkbox from '../../components/ui/Checkbox'
import { colorgoryHexById } from '../board/colorgoryColors'
import { getNodeContainerClasses } from './nodeStyles'
 
import { supabaseStorage } from '../storage/supabaseStorage'
 

interface ImageNodeData {
  label: string
  title?: string
  type: string
  fileName?: string
  fileType?: string
  fileSize?: number
  status?: 'uploading' | 'processing' | 'ready' | 'error'
  previewUrl?: string
  documentId?: string
  uploadedAt?: number
  colorgoryIds?: string[]
  content?: string
  variant800Url?: string
  variant1920Url?: string
  hasVariants?: boolean
  width?: number
  detailsOpen?: boolean
}

interface ImageNodeProps {
  data: ImageNodeData
  id: string
  onNodeDelete?: (nodeId: string) => void
  onNodeUpdate?: (nodeId: string, updates: Record<string, any>) => void
  selected?: boolean
  onQuickAddNodes?: (nodeId: string) => void
  onOrganizeSubtree?: (nodeId: string) => void
}

export default function ImageNode({
  data,
  id,
  onNodeDelete,
  onNodeUpdate,
  selected,
  onQuickAddNodes,
  onOrganizeSubtree
}: ImageNodeProps) {
  const SHOW_ADD_CONNECTED = false
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [showColorgoryModal, setShowColorgoryModal] = useState(false)
  const [pendingColorgoryIds, setPendingColorgoryIds] = useState<string[]>((data as any).colorgoryIds || [])
  const [detailsOpen, setDetailsOpen] = useState<boolean>(Boolean((data as any).detailsOpen))
  
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = React.useRef<{ x: number; y: number } | null>(null)
  const pointerCacheRef = React.useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStartRef = React.useRef<{ distance: number; center: { x: number; y: number }; scale: number; translate: { x: number; y: number } } | null>(null)
  // Resizable width state
  const [signedReady, setSignedReady] = useState(false)
  const refreshAttemptsRef = React.useRef<number>(0)

  const [signedPreviewUrl, setSignedPreviewUrl] = useState<string | null>(null)
  const [signedVariant800, setSignedVariant800] = useState<string | null>(null)
  const [signedVariant1920, setSignedVariant1920] = useState<string | null>(null)

  const refreshSignedUrl = async () => {
    if (!data.documentId) return
    if (refreshAttemptsRef.current >= 2) return
    try {
      const isSvg = (data.fileType === 'image/svg+xml') || /\.svg$/i.test(data.fileName || '')
      const shouldTryVariants = !isSvg && !!(data as any).hasVariants
      const [url, v800, v1920] = await Promise.all([
        supabaseStorage.getSignedUrl(data.documentId),
        shouldTryVariants ? supabaseStorage.getSignedUrlForVariant(data.documentId, '800') : Promise.resolve(null),
        shouldTryVariants ? supabaseStorage.getSignedUrlForVariant(data.documentId, '1920') : Promise.resolve(null)
      ])
      refreshAttemptsRef.current += 1
      setSignedPreviewUrl(url)
      setSignedVariant800(v800)
      setSignedVariant1920(v1920)
      setSignedReady(true)
    } catch {}
  }

  const handleImageError = async () => {
    await refreshSignedUrl()
  }
  useEffect(() => {
    if (!data.documentId) return
    refreshSignedUrl()
    // Periodic refresh (every 45 minutes)
    const t = setInterval(refreshSignedUrl, 45 * 60 * 1000)
    return () => clearInterval(t)
  }, [data.documentId])

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

  const isLocked = false
  const isLockedByMe = false

  // Focus removed

  const getStatusIcon = () => {
    switch (data.status) {
      case 'uploading':
        return <Spinner className="w-4 h-4 animate-spin text-blue-500" />
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
    if (!(signedPreviewUrl || data.previewUrl)) return
    try {
      const a = document.createElement('a')
      a.href = signedPreviewUrl || data.previewUrl!
      a.download = data.fileName || data.title || 'image'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch { }
  }

  const variantMax = (signedVariant1920 || data.variant1920Url) ? 1920 : ((signedVariant800 || data.variant800Url) ? 800 : 1920)
  const maxWidth = Math.min(1280, variantMax)
  const minWidth = 320
  const initialWidth = Math.max(minWidth, Math.min(((data as any)?.width as number) || 320, maxWidth))
  const [nodeWidth, setNodeWidth] = useState<number>(initialWidth)
  const resizeStartRef = React.useRef<{ startX: number; startW: number } | null>(null)
  const onResizeDown = (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault()
    resizeStartRef.current = { startX: e.clientX, startW: nodeWidth }
    const onMove = (ev: MouseEvent) => {
      if (!resizeStartRef.current) return
      const dx = ev.clientX - resizeStartRef.current.startX
      const next = Math.max(minWidth, Math.min(resizeStartRef.current.startW + dx, maxWidth))
      setNodeWidth(next)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      onNodeUpdate?.(id, { width: Math.round(nodeWidth) })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  const connectingSourceId = useBoardStore((s: any) => s.connectingSourceId)
  const isReceiveMode = !!connectingSourceId && connectingSourceId !== id

  // Build colorgory swatch colors
  const colorgories = useBoardStore.getState().colorgories || []
  const swatchColors: string[] = Array.isArray((data as any).colorgoryIds)
    ? colorgories
        .filter((c: any) => (data as any).colorgoryIds!.includes(c.id))
        .map((c: any) => colorgoryHexById[c.id] || '#9ca3af')
    : []

  const gradientStops = swatchColors.length <= 1
    ? (swatchColors[0] || '')
    : (() => {
        const n = swatchColors.length
        const segment = 100 / n
        const blendWidth = segment * 0.3
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

  return (
    <div
      className={getNodeContainerClasses({ selected, receiveMode: isReceiveMode, extra: `hover:cursor-move group` })}
      style={{ width: `${Math.round(nodeWidth)}px` }}
      onClick={(e) => {
      }}
    >
      {/* Colorgory ring overlay (hidden when expanded) */}
      {!expanded && swatchColors.length > 0 && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-lg"
          style={{
            padding: 4,
            background: swatchColors.length === 1 ? gradientStops : `linear-gradient(to right, ${gradientStops})`,
            ...( { WebkitMask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)', WebkitMaskComposite: 'xor', maskComposite: 'exclude' } as any )
          }}
        />
      )}
      <Handle type="target" position={Position.Top} className="rf-handle-hit-32" />

      

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
          {(signedPreviewUrl || data.previewUrl) ? (
            <img
              key={`${signedPreviewUrl || data.previewUrl}|${signedVariant800 || data.variant800Url || ''}|${signedVariant1920 || data.variant1920Url || ''}`}
              src={signedVariant800 || data.variant800Url || signedPreviewUrl || data.previewUrl!}
              srcSet={[
                (signedVariant800 || data.variant800Url) ? `${signedVariant800 || data.variant800Url} 800w` : null,
                (signedVariant1920 || data.variant1920Url) ? `${signedVariant1920 || data.variant1920Url} 1920w` : null,
              ].filter(Boolean).join(', ')}
              sizes={`${Math.round(nodeWidth)}px`}
              alt={data.title || data.fileName || 'Image'}
              className={`w-full h-auto rounded-md object-contain cursor-pointer ${!isLoaded ? 'blur-sm saturate-50' : ''}`}
              style={{}}
              onLoad={() => setIsLoaded(true)}
              onError={handleImageError}
              draggable={false}
            />
          ) : (
            <div className={`rounded-md bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 text-sm ${expanded ? 'w-[800px] h-[400px]' : 'w-full h-[180px]'}`}>
              No preview
            </div>
          )}

        </div>

        {/* Filename and accordion toggle - hidden when expanded */}
        {!expanded && (
          <>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 min-w-0 cursor-move" />
              <button
                type="button"
                aria-label={detailsOpen ? 'Hide details' : 'Show details'}
                onClick={(e) => {
                  e.stopPropagation()
                  const next = !detailsOpen
                  setDetailsOpen(next)
                  // Persist outside of render path
                  setTimeout(() => onNodeUpdate?.(id, { detailsOpen: next }), 0)
                }}
                className="ml-2 cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <CaretCircleDown
                  size={24}
                  weight="duotone"
                  className={`transition-transform duration-300 ${detailsOpen ? 'rotate-180' : ''}`}
                />
              </button>
            </div>

            {/* Accordion content */}
            <div className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${detailsOpen ? 'max-h-[600px]' : 'max-h-0'}`}>
              <div className="mt-2">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {data.title || data.fileName || 'Image'}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(data.fileSize)} {data.fileType ? `• ${data.fileType}` : ''}
                </div>
                {data.content && (
                  <div
                    className="mt-2 tiptap-content text-xs text-gray-700 dark:text-gray-300 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: data.content }}
                  />
                )}
                {data.status && (
                  <div className={`mt-2 flex items-center gap-1 transition-opacity duration-300 ${showStatus ? 'opacity-100' : 'opacity-0'}`}>
                    {getStatusIcon()}
                    <span className="text-xs text-gray-600 dark:text-gray-400">
                      {data.status === 'uploading' ? 'Uploading…' : data.status === 'processing' ? 'Processing...' : data.status === 'ready' ? 'Ready' : 'Error'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Colorgories swatch replaces tag list */}

      {/* Colorgories button moved to drawer */}

      

      {/* Edit Modal */}
      {showEditModal && (
        <NodeEditModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={(title, content) => { onNodeUpdate?.(id, { title, content }); setShowEditModal(false) }}
          onLiveChange={(title, content) => { onNodeUpdate?.(id, { title, content }) }}
          initialTitle={data.title || data.fileName || 'Image'}
          initialContent={data.content || ''}
          initialColorgoryIds={(data as any).colorgoryIds || []}
          initialTitleSize={'sm'}
          initialPageMode={false}
        />
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

      {/* Node-level resize handle (bottom-right) */}
      <div
        className="nodrag nopan
        hidden md:flex absolute -bottom-2 -right-2 w-6 h-6 items-center justify-center rounded-full
            bg-white dark:bg-primary-900 text-primary-600 dark:text-white 
            cursor-se-resize shadow-lg hover:shadow-xl transition-opacity duration-200 ease-out opacity-0 group-hover:opacity-100
            pointer-events-none group-hover:pointer-events-auto"
        onMouseDown={onResizeDown}
        title="Resize"
      >
        <Resize size={32} weight="duotone" className="w-4 h-4" />
      </div>
      
      <Handle type="source" position={Position.Bottom} className="rf-handle-hit-32" />
    </div>
  )
}


