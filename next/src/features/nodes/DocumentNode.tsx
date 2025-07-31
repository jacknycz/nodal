'use client'

import React, { useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { FileText, Download, Eye, Trash2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import PDFPreviewModal from '../../components/PDFPreviewModal'
import Modal from '../../components/ui/Modal'
import IconButton from '../../components/ui/IconButton'
import Button from '../../components/ui/Button'
import { useBoardStore } from '../board/boardSlice'

interface DocumentNodeData {
  label: string
  file?: File
  type: string
  fileName?: string
  fileType?: string
  fileSize?: number
  status?: 'processing' | 'ready' | 'error'
  extractedText?: string
}

interface DocumentNodeProps {
  data: DocumentNodeData
  id: string
  onNodeDelete?: (nodeId: string) => void
  selected?: boolean
}

export default function DocumentNode({ data, id, onNodeDelete, selected }: DocumentNodeProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  // Use XYFlow's selected prop instead of custom selection

  // Create object URL for image preview
  useEffect(() => {
    if (data.file && data.fileType?.startsWith('image/')) {
      const url = URL.createObjectURL(data.file)
      setImageUrl(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [data.file, data.fileType])

  const isImage = data.fileType?.startsWith('image/') || 
    data.fileName?.match(/\.(png|jpg|jpeg|gif|webp)$/i)

  const isPDF = data.fileType?.includes('pdf') || data.fileName?.match(/\.pdf$/i)

  const isTextExtractable = data.fileType && (
    data.fileType.includes('pdf') ||
    data.fileType.includes('word') ||
    data.fileType.includes('document') ||
    data.fileType.includes('text/') ||
    data.fileName?.match(/\.(doc|docx|txt|md|csv|json)$/i)
  )

  const hasExtractedText = data.extractedText && data.extractedText.length > 0 && !data.extractedText.includes('Text extraction failed')

  const getFileIcon = () => {
    if (isImage) return '🖼️'
    if (isPDF) return '📄'
    if (data.fileType?.includes('word') || data.fileName?.match(/\.(doc|docx)$/i)) return '📝'
    if (data.fileType?.includes('text') || data.fileName?.match(/\.(txt|md|csv)$/i)) return '📄'
    return '📄'
  }

  const getStatusIcon = () => {
    switch (data.status) {
      case 'processing':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <FileText className="w-4 h-4 text-gray-500" />
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
    if (isPDF) {
      setShowPDFModal(true)
    } else {
      setShowPreview(!showPreview)
    }
  }

  const handleDownload = () => {
    if (data.file) {
      const url = URL.createObjectURL(data.file)
      const a = document.createElement('a')
      a.href = url
      a.download = data.fileName || data.label
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
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
    <>
      <div 
        className={`bg-blue-50 dark:bg-blue-900/20 border rounded-lg shadow-sm p-4 min-w-[250px] max-w-[350px] group ${
          selected 
            ? 'border-blue-500 bg-blue-100 dark:bg-blue-800/30' 
            : 'border-blue-200 dark:border-blue-700'
        }`}
      >
        <Handle type="target" position={Position.Top} className="w-3 h-3" />
        
        <div className="nodal-drag-handle cursor-move">
          {/* Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{getFileIcon()}</span>
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-100 text-sm leading-tight">
                  {data.label}
                </h3>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  {data.fileType || data.type}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {getStatusIcon()}
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {getStatusText()}
              </span>
            </div>
          </div>

          {/* Image Preview (if it's an image) */}
          {isImage && imageUrl && (
            <div className="mb-3">
              <img
                src={imageUrl}
                alt={data.label}
                className="w-full h-32 object-cover rounded border border-gray-200 dark:border-gray-600"
              />
            </div>
          )}

          {/* File Info */}
          <div className="space-y-1 mb-3">
            {data.fileSize && (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Size: {formatFileSize(data.fileSize)}
              </p>
            )}
            {data.fileName && data.fileName !== data.label && (
              <p className="text-xs text-gray-600 dark:text-gray-400">
                File: {data.fileName}
              </p>
            )}
          </div>

          {/* Actions - Only show on hover */}
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {(isTextExtractable || isImage || isPDF) && (
              <IconButton
                variant="default"
                size="sm"
                aria-label="Preview document"
                onClick={handlePreview}
              >
                <Eye size={14} />
              </IconButton>
            )}
            
            {data.file && (
              <IconButton
                variant="default"
                size="sm"
                aria-label="Download document"
                onClick={handleDownload}
              >
                <Download size={14} />
              </IconButton>
            )}
            
            <IconButton
              variant="danger"
              size="sm"
              aria-label="Delete document"
              onClick={handleDelete}
            >
              <Trash2 size={14} />
            </IconButton>
          </div>

          {/* Text Extraction Status */}
          {isTextExtractable && (
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs">
              {hasExtractedText ? (
                <div className="text-green-600 dark:text-green-400">
                  ✅ Text extracted ({data.extractedText?.length} characters)
                </div>
              ) : data.extractedText?.includes('Text extraction failed') ? (
                <div className="text-red-600 dark:text-red-400">
                  ❌ Text extraction failed
                </div>
              ) : (
                <div className="text-gray-600 dark:text-gray-400">
                  ⏳ Processing text...
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          {showPreview && hasExtractedText && !isImage && !isPDF && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Document Preview
              </h4>
              <div className="text-xs text-gray-600 dark:text-gray-400 max-h-32 overflow-y-auto">
                {data.extractedText && data.extractedText.length > 300 
                  ? `${data.extractedText.substring(0, 300)}...` 
                  : data.extractedText
                }
              </div>
            </div>
          )}

          {/* Image Preview Modal */}
          {showPreview && isImage && imageUrl && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
              <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                Image Preview
              </h4>
              <img
                src={imageUrl}
                alt={data.label}
                className="w-full max-h-48 object-contain rounded"
              />
            </div>
          )}
        </div>

        <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
      </div>

      {/* PDF Preview Modal */}
      {isPDF && data.file && (
        <PDFPreviewModal
          isOpen={showPDFModal}
          onClose={() => setShowPDFModal(false)}
          file={data.file}
          fileName={data.fileName || data.label}
        />
      )}

      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Document?"
        description="Are you sure you want to delete this document? This action cannot be undone."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmDelete}
            >
              Delete
            </Button>
          </>
        }
      >
        <div className="py-2">
          <span className="font-medium text-gray-900 dark:text-white">{data.label}</span>
        </div>
      </Modal>
    </>
  )
} 