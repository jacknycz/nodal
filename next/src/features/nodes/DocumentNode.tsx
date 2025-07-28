'use client'

import React, { useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { FileText, Download, Eye, Trash2, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import PDFPreviewModal from '../../components/PDFPreviewModal'

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
}

export default function DocumentNode({ data }: DocumentNodeProps) {
  const [showPreview, setShowPreview] = useState(false)
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

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

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${data.label}"?`)) {
      return
    }
    
    setIsDeleting(true)
    try {
      // In a real implementation, this would delete the file from storage
      console.log('Delete document:', data.label)
      // You would also need to remove the node from the board
    } catch (error) {
      console.error('Failed to delete document:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg shadow-sm p-4 min-w-[250px] max-w-[350px]">
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

          {/* Actions */}
          <div className="flex items-center gap-2">
            {(isTextExtractable || isImage || isPDF) && (
              <button
                onClick={handlePreview}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:hover:bg-blue-700 text-blue-700 dark:text-blue-200 rounded transition-colors"
                title={isImage ? "View image" : isPDF ? "View PDF" : "Preview document"}
              >
                <Eye className="w-3 h-3" />
                {isImage ? "View" : isPDF ? "View PDF" : "Preview"}
              </button>
            )}
            
            {data.file && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-2 py-1 text-xs bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:hover:bg-green-700 text-green-700 dark:text-green-200 rounded transition-colors"
                title="Download document"
              >
                <Download className="w-3 h-3" />
                Download
              </button>
            )}
            
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-700 dark:text-red-200 rounded transition-colors disabled:opacity-50"
              title="Delete document"
            >
              {isDeleting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              Delete
            </button>
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
    </>
  )
} 