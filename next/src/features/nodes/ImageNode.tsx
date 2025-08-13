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

      <div className="relative nodal-drag-handle cursor-move">
        {/* Image content */}
        <div className="relative w-full">
          {data.previewUrl ? (
            <img
              src={data.previewUrl}
              alt={data.fileName || data.title || 'Image'}
              className="w-full h-auto rounded-md object-contain"
              style={{ maxWidth: expanded ? 800 : 240 }}
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


