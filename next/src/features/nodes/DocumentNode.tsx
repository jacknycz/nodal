'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash, Headlights, FrameCorners, Download, CheckCircle, SpinnerGap, Warning, FileText, FilePdf } from "@phosphor-icons/react/ssr";
import PDFPreviewModal from '../../components/PDFPreviewModal'
import Modal from '../../components/ui/Modal'
import IconButton from '../../components/ui/IconButton'
import Button from '../../components/ui/Button'
import { useBoardStore } from '../board/boardSlice'
import { supabaseStorage } from '../storage/supabaseStorage'

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
}

interface DocumentNodeProps {
  data: DocumentNodeData
  id: string
  onNodeDelete?: (nodeId: string) => void
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

  return (
    <div 
      className={`flex flex-col justify-start text-left p-4 min-w-[240px] max-w-[540px] bg-white dark:bg-gray-800 border border-transparent rounded-lg shadow-sm group ${
        isFocused
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400/50'
          : selected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
          : isLocked && !isLockedByMe
          ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
          : 'border-transparent dark:border-transparent'
      } ${(hasFocus || focusAnchorIds.length > 0) && !isFocused ? 'opacity-40 blur-[1px]' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />

      <IconButton
        variant="default"
        size="sm"
        aria-label="Focus node"
        className="absolute -top-2 -right-2"
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
        <Headlights size={14} weight="duotone" className='text-secondary-100' />
      </IconButton>

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
        <div className="flex items-center gap-2 mb-3">
          {getStatusIcon()}
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {getStatusText()}
          </span>
        </div>

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

      {/* Action buttons - only show on hover and if not locked by someone else */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
          variant="danger"
          size="sm"
          aria-label="Delete document"
          onClick={handleDelete}
          disabled={isLocked && !isLockedByMe}
        >
          <Trash size={14} weight="duotone" />
        </IconButton>
      </div>

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

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  )
} 