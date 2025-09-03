'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash, FrameCorners, Download, CheckCircle, SpinnerGap, Warning, FileText, FilePdf, Tag as TagIcon } from "@phosphor-icons/react/ssr";
import PDFPreviewModal from '../../components/PDFPreviewModal'
import Modal from '../../components/ui/Modal'
import IconButton from '../../components/ui/IconButton'
import Button from '../../components/ui/Button'
import { useBoardStore } from '../board/boardSlice'
import { supabaseStorage } from '../storage/supabaseStorage'
import Tag from '../../components/ui/Tag'
import Checkbox from '../../components/ui/Checkbox'
import { colorgoryHexById } from '../board/colorgoryColors'
import { getNodeContainerClasses } from './nodeStyles'
import NodeActionDrawer from './NodeActionDrawer'

interface DocumentNodeData {
  label: string
  title?: string
  type: string
  fileName?: string
  fileType?: string
  fileSize?: number
  status?: 'processing' | 'ready' | 'error'
  extractedText?: string
  previewUrl?: string
  documentId?: string // Store document ID instead of File object
  uploadedAt?: number
  colorgoryIds?: string[]
}

interface DocumentNodeProps {
  data: DocumentNodeData
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
}

export default function DocumentNode({ 
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
}: DocumentNodeProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showColorgoryModal, setShowColorgoryModal] = useState(false)
  const [pendingColorgoryIds, setPendingColorgoryIds] = useState<string[]>(data.colorgoryIds || [])
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

  const isLocked = isNodeLocked?.(id) || false
  const isLockedByMe = isNodeLockedByMe?.(id) || false
  const lockOwner = getNodeLockOwner?.(id)

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

  const hasExtractedText = data.extractedText && data.extractedText.length > 0 && !data.extractedText.includes('Text extraction failed')

  // Focus removed

  const getFileIcon = () => {
    if (isImage) return '🖼️'
    if (isPDF) return <FilePdf size={44} weight="duotone" />
    if (data.fileType?.includes('word') || data.fileName?.match(/\.(doc|docx)$/i)) return '📝'
    if (data.fileType?.includes('text') || data.fileName?.match(/\.(txt|md|csv)$/i)) return '📄'
    return '📄'
  }

  const getStatusIcon = () => {
    switch (data.status) {
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

  const getStatusText = () => {
    switch (data.status) {
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
    if (data.previewUrl) {
      try {
        const a = document.createElement('a')
        a.href = data.previewUrl
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
        .map((c: any) => colorgoryHexById[c.id] || '#9ca3af')
    : []

  return (
    <div 
      className={getNodeContainerClasses({ selected, isLocked, isLockedByMe, receiveMode: isReceiveMode, extra: `p-4 ${containerWidthClass}` })}
    >
      {/* Colorgory Swatch */}
      <div className="absolute left-0 top-0 h-full w-2 rounded-l-lg overflow-hidden" aria-hidden>
        {swatchColors.length === 0 ? (
          <div style={{ height: '100%', width: '100%', backgroundColor: 'transparent' }} />
        ) : (
          <div style={{ height: '100%', width: '100%' }}>
            {swatchColors.map((hex, idx) => (
              <div key={idx} style={{ height: `${100 / swatchColors.length}%`, backgroundColor: hex }} />
            ))}
          </div>
        )}
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      

      <div className="nodal-drag-handle cursor-move">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{getFileIcon()}</span>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {data.fileName || 'Untitled Document'}
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>{formatFileSize(data.fileSize)}</span>
              <span>•</span>
              <span>{data.fileType || 'Unknown type'}</span>
            </div>
          </div>
          {isLocked && (
            <div className="flex items-center gap-1 text-xs">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
              <span className="text-red-600 dark:text-red-400">
                {isLockedByMe ? 'Editing...' : 'Locked'}
              </span>
            </div>
          )}
        </div>
        
        {/* Status indicator */}
        {data.status && (
          <div className={`flex items-center gap-1 mb-3 transition-opacity duration-300 ${showStatus ? 'opacity-100' : 'opacity-0'}`}>
            {getStatusIcon()}
            <span className="text-xs text-gray-600 dark:text-gray-400">
              {getStatusText()}
            </span>
          </div>
        )}

        {/* Preview is handled by PDFPreviewModal to preserve PDF interactivity */}

        {/* Extracted text preview */}
        {hasExtractedText && (
          <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded text-xs">
            <div className="text-gray-500 dark:text-gray-400 mb-1 font-medium">
              Extracted Text:
            </div>
            <div className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {data.extractedText.length > 250 
                ? `${data.extractedText.substring(0, 250)}...` 
                : data.extractedText
              }
            </div>
          </div>
        )}
      </div>

      {/* Colorgories swatch replaces tag list */}

      {/* Colorgories button moved to drawer */}

      {/* Slide-out action panel on hover */}
      <NodeActionDrawer>
        <IconButton
          variant="default"
          size="sm"
          aria-label="Preview document"
          onClick={handlePreview}
          disabled={isLocked && !isLockedByMe}
        >
          <FrameCorners size={14} weight="duotone" />
        </IconButton>
        <IconButton
          variant="default"
          size="sm"
          aria-label="Download document"
          onClick={handleDownload}
          disabled={isLocked && !isLockedByMe}
        >
          <Download size={14} weight="duotone" />
        </IconButton>
        <IconButton
          variant="default"
          size="sm"
          aria-label="Manage colorgories"
          onClick={(e) => { e.stopPropagation(); setPendingColorgoryIds(data.colorgoryIds || []); setShowColorgoryModal(true) }}
          disabled={isLocked && !isLockedByMe}
        >
          <TagIcon size={14} weight="duotone" />
        </IconButton>
        <IconButton
          variant="danger"
          size="sm"
          aria-label="Delete document"
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
          fileUrl={data.previewUrl}  // Use the signed URL instead of null file
          fileName={data.fileName || ''}
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

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
} 