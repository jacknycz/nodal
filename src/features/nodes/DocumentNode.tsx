import React, { useState, useRef, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { BoardNode } from '../board/boardTypes'
import { useNodeActions } from './useNodeActions'
import { boardStorage } from '../storage/storage'

// Document type icons
const getDocumentIcon = (fileType: string) => {
  if (fileType.includes('pdf')) {
    return (
      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
      </svg>
    )
  }
  if (fileType.includes('image')) {
    return (
      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z" />
      </svg>
    )
  }
  if (fileType.includes('text') || fileType.includes('markdown')) {
    return (
      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
      </svg>
    )
  }
  if (fileType.includes('word') || fileType.includes('document')) {
    return (
      <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M7,15L9,10L11,15H9.5L9,13.5H8.5L8,15H7M12,15L14,10L16,15H14.5L14,13.5H13.5L13,15H12Z" />
      </svg>
    )
  }
  // Default document icon
  return (
    <svg className="w-full h-full" fill="currentColor" viewBox="0 0 24 24">
      <path d="M13,9V3.5L18.5,9M6,2C4.89,2 4,2.89 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2H6Z" />
    </svg>
  )
}

// Format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// Format upload date
const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffHours < 1) {
    return 'Just now'
  } else if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`
  } else if (diffDays < 7) {
    return `${Math.floor(diffDays)}d ago`
  } else {
    return date.toLocaleDateString()
  }
}

// Delete confirmation modal
function DeleteDocumentModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  fileName 
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  fileName: string
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Document</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
          </div>
        </div>
        
        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Are you sure you want to delete <strong>"{fileName}"</strong>? This will also remove this document node and all its connections.
        </p>
        
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            Delete Document
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DocumentNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as BoardNode['data']
  const { updateNodeLabel, removeNode, toggleNodeExpanded } = useNodeActions(id)
  
  // State
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editLabelValue, setEditLabelValue] = useState(nodeData.label)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [documentContent, setDocumentContent] = useState<string>('')
  const [imageUrl, setImageUrl] = useState<string>('')
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [contentType, setContentType] = useState<'text' | 'image' | 'pdf' | 'unsupported'>('unsupported')
  
  // Refs
  const labelInputRef = useRef<HTMLInputElement>(null)
  const nodeRef = useRef<HTMLDivElement>(null)

  // Enhanced document loading with file type detection
  useEffect(() => {
    if (nodeData.expanded && nodeData.documentId && !documentContent && !imageUrl && !isLoadingContent) {
      loadDocumentContent()
    }
  }, [nodeData.expanded, nodeData.documentId])

  const loadDocumentContent = async () => {
    if (!nodeData.documentId) return
    
    setIsLoadingContent(true)
    try {
      const document = await boardStorage.getDocument(nodeData.documentId)
      if (!document) return

      const fileType = document.fileType.toLowerCase()
      console.log('🔍 Loading document preview:', document.fileName, fileType)
      
      // Use pre-extracted text from upload process
      const extractedText = document.extractedText || ''
      
      // Determine content type and set appropriate content
      if (fileType.includes('image/')) {
        // Image files - create blob URL for preview
        const imageUrl = URL.createObjectURL(document.content)
        setImageUrl(imageUrl)
        setContentType('image')
        console.log('📸 Image preview loaded')
        
      } else if (extractedText && 
                 extractedText.length > 0 && 
                 !extractedText.startsWith('[Error') &&
                 !extractedText.includes('No extractable text content available') &&
                 !extractedText.includes('[' + document.fileName + ']')) {
        // Files with successfully extracted text (PDF, Word, Text files)
        setDocumentContent(extractedText)
        
        if (fileType.includes('pdf')) {
          setContentType('pdf')
          console.log('📄 PDF with extracted text loaded:', extractedText.length, 'characters')
        } else if (fileType.includes('word') || fileType.includes('document') || document.fileName.endsWith('.docx')) {
          setContentType('text') // Show Word docs as text since we have extracted content
          console.log('📝 Word document with extracted text loaded:', extractedText.length, 'characters')
        } else {
          setContentType('text')
          console.log('📝 Text content loaded:', extractedText.length, 'characters')
        }
        
      } else {
        // Files without extractable text or failed extraction - show file info
        setDocumentContent(`File: ${document.fileName}\nType: ${fileType}\nSize: ${formatFileSize(document.fileSize)}\nUploaded: ${formatDate(document.uploadedAt || Date.now())}\n\n${extractedText || 'No text content available'}`)
        setContentType('unsupported')
        console.log('ℹ️ File info displayed for:', document.fileName)
      }
      
    } catch (error) {
      console.error('Failed to load document content:', error)
      setDocumentContent('Error loading document content')
      setContentType('unsupported')
    } finally {
      setIsLoadingContent(false)
    }
  }

  // Cleanup blob URLs when component unmounts
  useEffect(() => {
    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }
    }
  }, [imageUrl])

  // Focus input when editing
  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus()
      labelInputRef.current.select()
    }
  }, [isEditingLabel])

  // Label editing handlers
  const handleLabelDoubleClick = () => {
    setIsEditingLabel(true)
    setEditLabelValue(nodeData.label)
  }

  const handleLabelSave = () => {
    if (editLabelValue.trim() !== nodeData.label) {
      updateNodeLabel(editLabelValue.trim())
    }
    setIsEditingLabel(false)
  }

  const handleLabelCancel = () => {
    setEditLabelValue(nodeData.label)
    setIsEditingLabel(false)
  }

  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleLabelSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleLabelCancel()
    }
  }

  // Delete handlers
  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteModal(true)
  }

  const handleDeleteConfirm = async () => {
    try {
      // Delete the document file
      if (nodeData.documentId) {
        await boardStorage.deleteDocument(nodeData.documentId)
      }
      // Remove the node
      removeNode()
    } catch (error) {
      console.error('Failed to delete document:', error)
    }
    setShowDeleteModal(false)
  }

  const handleDeleteCancel = () => {
    setShowDeleteModal(false)
  }

  // Toggle expand/minimize
  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleNodeExpanded()
  }

  // Prevent dragging when clicking on inputs
  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  // Smart Content Preview Component
  const renderContentPreview = () => {
    if (isLoadingContent) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-500">Loading preview...</span>
        </div>
      )
    }

    switch (contentType) {
      case 'text':
        return (
          <div className="max-h-48 overflow-y-auto bg-gray-50 dark:bg-gray-700 rounded p-3 text-sm text-gray-700 dark:text-gray-300">
            <pre className="whitespace-pre-wrap font-sans">{documentContent.slice(0, 1000)}</pre>
            {documentContent.length > 1000 && (
              <p className="text-gray-500 dark:text-gray-400 mt-2 italic">
                ... and {documentContent.length - 1000} more characters
              </p>
            )}
          </div>
        )
        
      case 'image':
        return (
          <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
            <img 
              src={imageUrl} 
              alt={nodeData.fileName}
              className="max-w-full max-h-48 object-contain mx-auto rounded"
              onError={() => {
                console.error('Failed to load image preview')
                setContentType('unsupported')
              }}
            />
          </div>
        )
        
      case 'pdf':
        return (
          <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
            {documentContent && documentContent.length > 0 ? (
              <div className="max-h-48 overflow-y-auto text-sm text-gray-700 dark:text-gray-300">
                <div className="flex items-center mb-2 text-xs text-red-600 dark:text-red-400">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                  </svg>
                  PDF Content Extracted
                </div>
                <pre className="whitespace-pre-wrap font-sans">{documentContent.slice(0, 1000)}</pre>
                {documentContent.length > 1000 && (
                  <p className="text-gray-500 dark:text-gray-400 mt-2 italic">
                    ... and {documentContent.length - 1000} more characters
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 mx-auto mb-3 text-red-500">
                  <svg fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">PDF Preview</p>
                <p className="text-xs text-gray-500 mt-1">No text content extracted</p>
              </div>
            )}
          </div>
        )
        
      default:
        return (
          <div className="bg-gray-50 dark:bg-gray-700 rounded p-3">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">File Information</p>
            <pre className="text-xs text-gray-500 dark:text-gray-400 whitespace-pre-wrap">{documentContent}</pre>
          </div>
        )
    }
  }

  const isMinimized = !nodeData.expanded

  return (
    <>
      <div 
        ref={nodeRef}
        className={`
          nodal-drag-handle relative bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 transition-all duration-200 cursor-move
          ${selected ? 'border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-700'}
          hover:shadow-xl
          ${isMinimized ? 'w-48' : 'w-80 max-w-md'}
        `}
      >
        {/* Minimized View */}
        {isMinimized && (
          <div className="p-3">
            <div className="flex items-center space-x-3">
              {/* Document Icon */}
              <div className={`
                w-8 h-8 text-blue-600 dark:text-blue-400 flex-shrink-0
                ${nodeData.fileType?.includes('pdf') ? 'text-red-600 dark:text-red-400' : ''}
                ${nodeData.fileType?.includes('image') ? 'text-green-600 dark:text-green-400' : ''}
                ${nodeData.fileType?.includes('word') ? 'text-blue-800 dark:text-blue-300' : ''}
              `}>
                {getDocumentIcon(nodeData.fileType || '')}
              </div>

              {/* File Info */}
              <div className="flex-1 min-w-0">
                {isEditingLabel ? (
                  <input
                    ref={labelInputRef}
                    type="text"
                    value={editLabelValue}
                    onChange={(e) => setEditLabelValue(e.target.value)}
                    onKeyDown={handleLabelKeyDown}
                    onBlur={handleLabelSave}
                    onClick={handleInputClick}
                    className="w-full text-sm font-medium bg-transparent border-b border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                    maxLength={50}
                  />
                ) : (
                  <h3 
                    className="text-sm font-medium text-gray-900 dark:text-white truncate cursor-text"
                    onDoubleClick={handleLabelDoubleClick}
                    title={nodeData.label}
                  >
                    {nodeData.label}
                  </h3>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate" title={nodeData.fileName}>
                  {nodeData.fileName}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  {nodeData.fileSize ? formatFileSize(nodeData.fileSize) : ''}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={handleToggleExpand}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Expand document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="p-1 text-red-400 hover:text-red-600 transition-colors"
                  title="Delete document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Expanded View */}
        {!isMinimized && (
          <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={`
                  w-10 h-10 text-blue-600 dark:text-blue-400 flex-shrink-0
                  ${nodeData.fileType?.includes('pdf') ? 'text-red-600 dark:text-red-400' : ''}
                  ${nodeData.fileType?.includes('image') ? 'text-green-600 dark:text-green-400' : ''}
                  ${nodeData.fileType?.includes('word') ? 'text-blue-800 dark:text-blue-300' : ''}
                `}>
                  {getDocumentIcon(nodeData.fileType || '')}
                </div>
                <div className="flex-1 min-w-0">
                  {isEditingLabel ? (
                    <input
                      ref={labelInputRef}
                      type="text"
                      value={editLabelValue}
                      onChange={(e) => setEditLabelValue(e.target.value)}
                      onKeyDown={handleLabelKeyDown}
                      onBlur={handleLabelSave}
                      onClick={handleInputClick}
                      className="w-full text-lg font-semibold bg-transparent border-b border-blue-500 focus:outline-none text-gray-900 dark:text-white"
                      maxLength={50}
                    />
                  ) : (
                    <h3 
                      className="text-lg font-semibold text-gray-900 dark:text-white cursor-text"
                      onDoubleClick={handleLabelDoubleClick}
                    >
                      {nodeData.label}
                    </h3>
                  )}
                  <p className="text-sm text-gray-500 dark:text-gray-400" title={nodeData.fileName}>
                    {nodeData.fileName}
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={handleToggleExpand}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  title="Minimize document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="p-2 text-red-400 hover:text-red-600 transition-colors"
                  title="Delete document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Document Metadata */}
            <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4 p-2 bg-gray-50 dark:bg-gray-700 rounded">
              <span>{nodeData.fileSize ? formatFileSize(nodeData.fileSize) : ''}</span>
              <span>{nodeData.uploadedAt ? formatDate(nodeData.uploadedAt) : ''}</span>
            </div>

            {/* Enhanced Document Content Preview */}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Content Preview
                {contentType !== 'unsupported' && (
                  <span className="ml-2 text-xs text-gray-500 bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">
                    {contentType.toUpperCase()}
                  </span>
                )}
              </h4>
              {renderContentPreview()}
            </div>
          </div>
        )}

        {/* Connection Handles */}
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-blue-500 border-2 border-white dark:border-gray-800"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-blue-500 border-2 border-white dark:border-gray-800"
        />
      </div>

      {/* Delete confirmation modal */}
      <DeleteDocumentModal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        fileName={nodeData.fileName || 'document'}
      />
    </>
  )
} 