'use client'

import React, { useState, useRef, useCallback } from 'react'
import { UploadSimple, X, FileText, Warning, CheckCircle, Spinner } from '@phosphor-icons/react'
import { 
  validateFile, 
  formatFileSize, 
  getFileIcon, 
  getFileTypeDisplayName,
  SUPPORTED_FILE_TYPES 
} from '../features/nodes/documentUtils'

interface UploadingFile {
  id: string
  file: File
  status: 'uploading' | 'processing' | 'completed' | 'error'
  progress: number
  error?: string
  extractedText?: string
}

interface DocumentUploadProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: (files: UploadingFile[]) => void
  position?: { x: number; y: number }
}

export default function DocumentUpload({ 
  isOpen, 
  onClose, 
  onUploadComplete, 
  position 
}: DocumentUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback((files: FileList) => {
    const newFiles: UploadingFile[] = Array.from(files).map(file => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      status: 'uploading' as const,
      progress: 0
    }))

    setUploadingFiles(prev => [...prev, ...newFiles])

    // Process each file
    newFiles.forEach(async (uploadingFile) => {
      try {
        // Validate file
        const validation = validateFile(uploadingFile.file)
        if (!validation.valid) {
          setUploadingFiles(prev => prev.map(f => 
            f.id === uploadingFile.id 
              ? { ...f, status: 'error', error: validation.error }
              : f
          ))
          return
        }

        // Simulate upload progress
        for (let i = 0; i <= 100; i += 10) {
          await new Promise(resolve => setTimeout(resolve, 100))
          setUploadingFiles(prev => prev.map(f => 
            f.id === uploadingFile.id 
              ? { ...f, progress: i }
              : f
          ))
        }

        // Set to processing
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadingFile.id 
            ? { ...f, status: 'processing' }
            : f
        ))

        // Simulate text extraction (in real implementation, this would call extractTextFromFile)
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        const extractedText = `Extracted text from ${uploadingFile.file.name}\n\nThis is a placeholder for the actual extracted text content. In a production environment, this would contain the real text extracted from the uploaded document.\n\nFile: ${uploadingFile.file.name}\nSize: ${formatFileSize(uploadingFile.file.size)}\nType: ${getFileTypeDisplayName(uploadingFile.file.type)}`

        // Set to completed
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadingFile.id 
            ? { ...f, status: 'completed', extractedText }
            : f
        ))

      } catch (error) {
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadingFile.id 
            ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
            : f
        ))
      }
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    handleFileSelect(e.dataTransfer.files)
  }, [handleFileSelect])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFileSelect(e.target.files)
    }
  }, [handleFileSelect])

  const removeFile = useCallback((fileId: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId))
  }, [])

  const handleComplete = useCallback(() => {
    const completedFiles = uploadingFiles.filter(f => f.status === 'completed')
    if (completedFiles.length > 0) {
      onUploadComplete(completedFiles)
    }
    onClose()
  }, [uploadingFiles, onUploadComplete, onClose])

  const getStatusIcon = (status: UploadingFile['status']) => {
    switch (status) {
      case 'uploading':
        return <Spinner className="w-4 h-4 animate-spin text-blue-500" />
      case 'processing':
        return <Spinner className="w-4 h-4 animate-spin text-yellow-500" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'error':
        return <Warning className="w-4 h-4 text-red-500" />
    }
  }

  const getStatusText = (status: UploadingFile['status']) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...'
      case 'processing':
        return 'Processing...'
      case 'completed':
        return 'Completed'
      case 'error':
        return 'Error'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
              <UploadSimple className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Upload Documents
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Upload documents to add them to your board
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Supported File Types */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Supported File Types:
          </h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SUPPORTED_FILE_TYPES).map(([mimeType, name]) => (
              <span
                key={mimeType}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <UploadSimple className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            Drop files here or click to browse
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Maximum file size: 10MB
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Choose Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={Object.keys(SUPPORTED_FILE_TYPES).join(',')}
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>

        {/* File List */}
        {uploadingFiles.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Uploading Files ({uploadingFiles.length})
            </h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {uploadingFiles.map((uploadingFile) => (
                <div
                  key={uploadingFile.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <span className="text-2xl">
                    {getFileIcon(uploadingFile.file.type)}
                  </span>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {uploadingFile.file.name}
                      </p>
                      {getStatusIcon(uploadingFile.status)}
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {getStatusText(uploadingFile.status)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span>{formatFileSize(uploadingFile.file.size)}</span>
                      <span>{getFileTypeDisplayName(uploadingFile.file.type)}</span>
                      {uploadingFile.status === 'uploading' && (
                        <span>{uploadingFile.progress}%</span>
                      )}
                    </div>
                    
                    {uploadingFile.status === 'uploading' && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                          <div
                            className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                            style={{ width: `${uploadingFile.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                    
                    {uploadingFile.error && (
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        {uploadingFile.error}
                      </p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => removeFile(uploadingFile.id)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleComplete}
            disabled={uploadingFiles.filter(f => f.status === 'completed').length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add to Board
          </button>
        </div>
      </div>
    </div>
  )
} 