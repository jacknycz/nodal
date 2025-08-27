'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, DownloadSimple } from '@phosphor-icons/react'
import Loader from './ui/Loader'

interface PDFPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  file?: File | null
  fileUrl?: string | null
  fileName: string
}

export default function PDFPreviewModal({ isOpen, onClose, file, fileUrl, fileName }: PDFPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)
  const [modalWidth, setModalWidth] = useState<number>(960)
  const [modalHeight, setModalHeight] = useState<number>(640)
  const resizeStartRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null)
  const headerRef = useRef<HTMLDivElement | null>(null)
  const [contentHeight, setContentHeight] = useState<number>(0)

  useEffect(() => {
    // Clean up previous URL if it exists
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }

    if (isOpen) {
      if (file) {
        // Create object URL for the PDF file
        const url = URL.createObjectURL(file)
        urlRef.current = url
        setPdfUrl(url)
      } else if (fileUrl) {
        // Use the provided URL directly
        setPdfUrl(fileUrl)
      }
    } else {
      setPdfUrl(null)
    }

    // Cleanup function
    return () => {
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current)
        urlRef.current = null
      }
    }
  }, [isOpen, file, fileUrl])

  const handleDownload = () => {
    if (file) {
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else if (fileUrl) {
      const a = document.createElement('a')
      a.href = fileUrl
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  // Recompute content height when modal height changes or header mounts
  useEffect(() => {
    const compute = () => {
      const headerH = headerRef.current?.offsetHeight ?? 0
      const next = Math.max(200, modalHeight - headerH)
      setContentHeight(next)
    }
    compute()
    const onResize = () => compute()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [modalHeight])

  if (!isOpen) return null

  return (
    <div className="fixed -inset-4 flex items-center justify-center z-50">
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl mx-4 flex flex-col select-none"
        style={{
          width: modalWidth,
          height: modalHeight,
          maxWidth: 'calc(100vw - 2rem)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div ref={headerRef} className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 cursor-move pointer-events-none">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {fileName}
            </h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 pointer-events-auto"
              title="Download PDF"
            >
              <DownloadSimple size={24} weight="duotone" className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 pointer-events-auto"
              title="Close"
            >
              <X size={24} weight="duotone" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PDF Content */}
        <div
          className="overflow-hidden nodrag nowheel"
          style={{ height: contentHeight > 0 ? contentHeight : undefined }}
        >
          {pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&zoom=page-fit`}
              className="w-full h-full min-h-64 border-0"
              title={fileName}
            />
          ) : (
            <div className="flex items-center justify-center h-64">
              <Loader size="md" />
            </div>
          )}
        </div>

        {/* Resize handle */}
        <div
          className="absolute right-1.5 bottom-1.5 w-4 h-4 cursor-nwse-resize nodrag nowheel"
          draggable={false}
          onPointerDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
            const target = e.target as HTMLElement
            target.setPointerCapture?.(e.pointerId)
            resizeStartRef.current = { x: e.clientX, y: e.clientY, w: modalWidth, h: modalHeight }
            const onMove = (ev: PointerEvent) => {
              if (!resizeStartRef.current) return
              const dx = ev.clientX - resizeStartRef.current.x
              const dy = ev.clientY - resizeStartRef.current.y
              const minW = 480
              const minH = 320
              const maxW = Math.max(480, window.innerWidth - 32)
              const maxH = Math.max(320, Math.floor(window.innerHeight * 0.9))
              const nextW = Math.min(maxW, Math.max(minW, resizeStartRef.current.w + dx))
              const nextH = Math.min(maxH, Math.max(minH, resizeStartRef.current.h + dy))
              setModalWidth(nextW)
              setModalHeight(nextH)
            }
            const onUp = (ev: PointerEvent) => {
              ev.stopPropagation()
              ev.preventDefault()
              target.releasePointerCapture?.(e.pointerId)
              resizeStartRef.current = null
              window.removeEventListener('pointermove', onMove)
              window.removeEventListener('pointerup', onUp)
            }
            window.addEventListener('pointermove', onMove)
            window.addEventListener('pointerup', onUp)
          }}
        >
          <div className="absolute right-0 bottom-0 w-3 h-3 border-b-2 border-r-2 border-gray-300 dark:border-gray-600 rounded-sm" />
        </div>
      </div>
    </div>
  )
} 