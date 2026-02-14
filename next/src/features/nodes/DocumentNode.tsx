'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash, FrameCorners, Download, CheckCircle, CheckFat, SpinnerGap, Warning, FileText, FilePdf, PlusCircle, Pencil, TreeView, FileDoc, FileTxt, Image, File, Play, DotsThreeOutlineVertical } from "@phosphor-icons/react/ssr";
import PDFPreviewModal from '../../components/PDFPreviewModal'
import Modal from '../../components/ui/Modal'
import NodeEditModal from '../../components/NodeEditModal'
import IconButton from '../../components/ui/IconButton'
import Button from '../../components/ui/Button'
import { useBoardStore } from '../board/boardSlice'
// supabaseStorage is already imported above
import Checkbox from '../../components/ui/Checkbox'
import { getColorgoryHex } from '../board/colorgoryColors'
import { getMediaNodeContainerClasses, NODE_HANDLE_CLASS, NODE_HANDLE_VISIBILITY_CLASS } from './nodeStyles'
import { useTheme } from '../../contexts/ThemeContext'
 
import Tooltip from '../../components/ui/Tooltip'
import TextInput from '../../components/ui/TextInput'
import TextArea from '../../components/ui/TextArea'

interface DocumentNodeData {
  label: string
  title?: string
  type: string
  fileName?: string
  fileType?: string
  fileSize?: number
  status?: 'uploading' | 'processing' | 'ready' | 'error'
  extractedText?: string
  previewUrl?: string
  documentId?: string // Store document ID instead of File object
  uploadedAt?: number
  colorgoryIds?: string[]
  content?: string
}

interface DocumentNodeProps {
  data: DocumentNodeData
  id: string
  onNodeDelete?: (nodeId: string) => void
  onNodeUpdate?: (nodeId: string, updates: Record<string, any>) => void
  selected?: boolean
  onQuickAddNodes?: (nodeId: string) => void
  onOrganizeSubtree?: (nodeId: string) => void
  onNodeShiftClickConnect?: (targetId: string) => void
  onStartStoryMode?: (nodeId: string) => void
}

export default function DocumentNode({ 
  data, 
  id, 
  onNodeDelete, 
  onNodeUpdate,
  selected,
  onQuickAddNodes,
  onOrganizeSubtree,
  onStartStoryMode
}: DocumentNodeProps) {
  const { isDark } = useTheme()
  const storyTitle = String((data as any)?.storyTitle || data.title || data.fileName || data.label || 'Story')
  const SHOW_ADD_CONNECTED = false
  const [showPreview, setShowPreview] = useState(false)
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showColorgoryModal, setShowColorgoryModal] = useState(false)
  const [pendingColorgoryIds, setPendingColorgoryIds] = useState<string[]>(data.colorgoryIds || [])
  
  const refreshAttemptsRef = useState(0)[0] as any
  const [showEditModal, setShowEditModal] = useState(false)
  const [signedPreviewUrl, setSignedPreviewUrl] = useState<string | null>(null)
  // Status visibility (auto-hide when status becomes 'ready')
  const [showStatus, setShowStatus] = useState<boolean>(!!data.status)
  useEffect(() => {
    setShowStatus(true)
    let timer: ReturnType<typeof setTimeout> | null = null
    if (data.status === 'ready') {
      timer = setTimeout(() => setShowStatus(false), 5000)
    }
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [data.status])

  useEffect(() => {
    const refresh = async () => {
      if (!data.documentId) return
      try {
        const url = await (await import('../storage/supabaseStorage')).supabaseStorage.getSignedUrl(data.documentId)
        setSignedPreviewUrl(url)
      } catch {}
    }
    refresh()
    const t = setInterval(refresh, 45 * 60 * 1000)
    return () => clearInterval(t)
  }, [data.documentId])

  const isLocked = false
  const isLockedByMe = false

  // Remove: const [imageUrl, setImageUrl] = useState<string | null>(null)
  // Remove: const [isLoadingImage, setIsLoadingImage] = useState(false)
  // Remove: const lastFetchedId = useRef<string | null>(null);
  // Remove the useEffect that fetches the signed URL

  const isImage = data.fileType?.startsWith('image/') || 
    data.fileName?.match(/\.(png|jpg|jpeg|gif|webp)$/i)

  // console.log('🖼️ DocumentNode render - isImage:', isImage, 'imageUrl:', data.previewUrl)

  const isPDF = data.fileType?.includes('pdf') || data.fileName?.match(/\.pdf$/i)

  const isTextExtractable = data.fileType && (
    data.fileType.includes('pdf') ||
    data.fileType.includes('word') ||
    data.fileType.includes('document') ||
    data.fileType.includes('text/') ||
    data.fileName?.match(/\.(doc|docx|txt|md|csv|json)$/i)
  )

  const toPlain = (html: string): string => {
    try {
      const div = document.createElement('div')
      div.innerHTML = html
      return (div.textContent || div.innerText || '').trim()
    } catch { return html }
  }

  const rawContent = (() => {
    const c = typeof data.content === 'string' && data.content.trim().length > 0 ? data.content : ''
    if (c) return c
    const extracted = (data as any)?.extractedText || (data as any)?.extracted_text || ''
    return typeof extracted === 'string' ? extracted : ''
  })()
  const plainContent = rawContent ? toPlain(rawContent) : ''
  const hasContent = plainContent.length > 0

  // Focus removed

  const getFileIcon = () => {
    if (isImage) return <Image className="text-primary-500" size={44} weight="duotone" />
    if (isPDF) return <FilePdf className="text-red-500" size={44} weight="duotone" />
    if (data.fileType?.includes('word') || data.fileName?.match(/\.(doc|docx)$/i)) return <FileDoc className="text-blue-500" size={44} weight="duotone" />
    if (data.fileType?.includes('text') || data.fileName?.match(/\.(txt|md|csv)$/i)) return <FileTxt className="text-gray-500" size={44} weight="duotone" />
    return <File className="text-gray-500" size={44} weight="duotone" />
  }

  const getStatusIcon = () => {
    switch (data.status) {
      case 'uploading':
        return <SpinnerGap weight="duotone" className="w-4 h-4 animate-spin text-primary-500" />
      case 'processing':
        return <SpinnerGap weight="duotone" className="w-4 h-4 animate-spin text-primary-500" />
      case 'ready':
        return <CheckCircle weight="duotone" className='text-green-500 w-4 h-4' />
      case 'error':
        return <Warning weight="duotone" className="w-4 h-4 text-red-500" />
      default:
        return <FileText weight="duotone" className="w-4 h-4 text-gray-500" />
    }
  }

  const refreshSignedUrl = async () => {
    if (!data.documentId) return
    try {
      const url = await (await import('../storage/supabaseStorage')).supabaseStorage.getSignedUrl(data.documentId)
      setSignedPreviewUrl(url)
    } catch {}
  }

  const getStatusText = () => {
    switch (data.status) {
      case 'uploading':
        return 'Uploading…'
      case 'processing':
        return 'Processing...'
      case 'ready':
        return 'Ready'
      case 'error':
        return 'Error'
      default:
        return 'Unknown'
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handlePreview = () => {
    console.log('👁️ Preview button clicked - isImage:', isImage, 'imageUrl:', data.previewUrl)
    setShowPreview(!showPreview)
  }

  const handleDownload = () => {
    if (data.previewUrl || signedPreviewUrl) {
      try {
        const a = document.createElement('a')
        a.href = signedPreviewUrl || data.previewUrl!
        a.download = data.fileName || data.label
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      } catch (error) {
        console.error('Error downloading file:', error)
      }
    }
  }

  // Remove custom selection logic - use XYFlow's built-in selection

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

  const containerWidthClass = showPreview ? 'w-[820px]' : 'min-w-[240px] max-w-[540px]'
  const connectingSourceId = useBoardStore((s: any) => s.connectingSourceId)
  const isReceiveMode = !!connectingSourceId && connectingSourceId !== id

  // Build colorgory swatch colors
  const colorgories = useBoardStore.getState().colorgories || []
  const swatchColors: string[] = Array.isArray(data.colorgoryIds)
    ? colorgories
        .filter((c: any) => data.colorgoryIds!.includes(c.id))
        .map((c: any) => getColorgoryHex(c.id))
    : []

  // Build gradient stops for ring
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
      className={getMediaNodeContainerClasses({ selected, receiveMode: isReceiveMode, extra: `p-4 ${containerWidthClass} bg-white/90 dark:bg-gray-800 rounded-lg shadow-sm shadow-orange-950/20` })}
      style={!isDark && swatchColors.length > 0 ? { background: (swatchColors.length === 1 ? swatchColors[0] : (`linear-gradient(to right, ${gradientStops})`)) } : undefined}
      onClick={(e) => {
        if ((e as any).pointerType === 'touch' || window.matchMedia('(pointer: coarse)').matches) {
          // Drawer state removed/optional; ignore if not present
        }
      }}
    >
      {(data as any)?.storyStarter && (
        <div
          className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full z-40 relative flex items-center gap-2 rounded-full border border-primary-200/80 dark:border-primary-800 bg-white/90 dark:bg-gray-900/80 px-2 py-1 shadow-sm backdrop-blur"
          onMouseDown={(e) => { e.stopPropagation() }}
          onClick={(e) => { e.stopPropagation() }}
        >
          {!!(data as any)?.storyCompleted && (
            <span
              className="absolute -top-1.5 -left-1.5 inline-flex items-center justify-center p-0.5 rounded-full bg-white dark:bg-gray-900 border border-primary-200/80 dark:border-primary-800 shadow-sm"
              title="Story complete"
            >
              <CheckFat size={14} weight="fill" className="text-emerald-600 dark:text-emerald-400" />
            </span>
          )}
          <IconButton
            variant="secondaryGhost"
            size="xs"
            aria-label="Story settings"
            onMouseDown={(e) => { e.stopPropagation() }}
            onClick={(e) => {
              e.stopPropagation()
              try { window.dispatchEvent(new CustomEvent('nodal:open-story-settings', { detail: { id, title: storyTitle } })) } catch {}
            }}
            title="Story settings"
          >
            <DotsThreeOutlineVertical size={14} weight="duotone" />
          </IconButton>
          <span
            className="max-w-[220px] truncate text-[11px] font-medium text-gray-900 dark:text-white"
            title={storyTitle}
          >
            {storyTitle}
          </span>
          <IconButton
            variant="primaryGhost"
            size="xs"
            aria-label="Play story"
            onMouseDown={(e) => { e.stopPropagation() }}
            onClick={(e) => { e.stopPropagation(); try { onStartStoryMode?.(id) } catch {} }}
            title="Play story"
          >
            <Play size={14} weight="duotone" />
          </IconButton>
        </div>
      )}
      {/* Colorgory ring overlay */}
      {isDark && swatchColors.length > 0 && (
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
      <Handle type="target" position={Position.Top} className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`} />

      

      <div className="nodal-drag-handle cursor-move">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{getFileIcon()}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {data.title || data.fileName || 'Untitled Document'}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatFileSize(data.fileSize)}</span>
              <span>•</span>
              <span>{data.fileType || 'Unknown type'}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2">
            {isPDF && (signedPreviewUrl || data.previewUrl) && (
              <IconButton
                aria-label="Open PDF"
                size="small"
                variant="secondaryGhost"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowPreview(true) }}
              >
                <FrameCorners className="w-4 h-4" />
              </IconButton>
            )}
            {(signedPreviewUrl || data.previewUrl) && (
              <IconButton
                aria-label="Download"
                size="small"
                variant="secondaryGhost"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDownload() }}
              >
                <Download className="w-4 h-4" />
              </IconButton>
            )}
          </div>
        </div>
        
        {/* Status indicator */}
        {data.status && data.status !== 'ready' && (
          <div className={`flex items-center gap-1 mb-3 transition-opacity duration-300 ${showStatus ? 'opacity-100' : 'opacity-0'}`}>
            {getStatusIcon()}
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {getStatusText()}
            </span>
          </div>
        )}

        {/* Preview is handled by PDFPreviewModal to preserve PDF interactivity */}

        {/* Document description */}
        {hasContent && (
          <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line break-words line-clamp-2">
            {plainContent.length > 280 ? `${plainContent.slice(0, 280)}…` : plainContent}
          </div>
        )}
      </div>

      {/* Colorgories swatch replaces tag list */}

      {/* Colorgories button moved to drawer */}

      

      {/* Modals */}
      {showEditModal && (
        <NodeEditModal
          open={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={(title, content) => { onNodeUpdate?.(id, { title, content }); setShowEditModal(false) }}
          onLiveChange={(title, content) => { onNodeUpdate?.(id, { title, content }) }}
          initialTitle={data.title || data.fileName || 'Document'}
          initialContent={data.content || ''}
          initialColorgoryIds={data.colorgoryIds || []}
          initialTitleSize={'sm'}
          initialPageMode={false}
        />
      )}

      <Modal 
        open={showDeleteModal} 
        onClose={() => setShowDeleteModal(false)}
        title="Delete Document"
        description="Are you sure you want to delete this document? This action cannot be undone."
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

      {showPreview && (
        <PDFPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          fileUrl={signedPreviewUrl || data.previewUrl}
          fileName={data.fileName || ''}
          onLoadError={refreshSignedUrl}
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

      <Handle type="source" position={Position.Bottom} className={`${NODE_HANDLE_CLASS} ${NODE_HANDLE_VISIBILITY_CLASS}`} />
    </div>
  )
} 