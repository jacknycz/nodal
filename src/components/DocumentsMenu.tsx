import React, { useState, useRef, useEffect } from 'react'
import { FileText, Trash2, Search, X } from 'lucide-react'
import { Button } from 'pres-start-core'
import { useBoardStore } from '../features/board/boardSlice'
import { format } from 'date-fns'

function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export default function DocumentsMenu({ className = '' }: { className?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [previewDocId, setPreviewDocId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const nodes = useBoardStore(state => state.nodes)
  const deleteNode = useBoardStore(state => state.deleteNode)
  const updateNode = useBoardStore(state => state.updateNode)

  // Filter document nodes
  const documents = nodes.filter(n => n.data.type === 'document')

  // Search filter
  const filteredDocs = documents.filter(doc => {
    const q = search.toLowerCase()
    return (
      doc.data.label?.toLowerCase().includes(q) ||
      doc.data.fileName?.toLowerCase().includes(q) ||
      doc.data.fileType?.toLowerCase().includes(q) ||
      doc.data.extractedText?.toLowerCase().includes(q)
    )
  })

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setPreviewDocId(null)
        setConfirmDeleteId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus/highlight node on board (stub: could scroll to node, etc.)
  const handleFocusNode = (id: string) => {
    // Optionally: scroll to node, highlight, etc.
    setPreviewDocId(id)
    setIsOpen(true)
  }

  // Delete document node
  const handleDelete = (id: string) => {
    deleteNode(id)
    setConfirmDeleteId(null)
    setPreviewDocId(null)
  }

  return (
    <div ref={menuRef} className={`relative ${className}`}>
      {/* Documents Button */}
      <Button
        className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Documents"
        onClick={() => setIsOpen(v => !v)}
      >
        <FileText className="w-6 h-6 text-gray-600 dark:text-gray-300" />
      </Button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 min-w-[24rem] w-[24rem] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4 z-50">
          <div className="mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
            {search && (
              <button onClick={() => setSearch('')} className="ml-1 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {filteredDocs.length === 0 ? (
            <div className="text-sm text-gray-500 py-8 text-center">No documents found.</div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-80 overflow-y-auto">
              {filteredDocs.map(doc => (
                <div key={doc.id} className="py-3 flex items-start gap-3 group">
                  <div className="flex-shrink-0 mt-1">
                    <FileText className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        className="text-sm font-medium text-blue-700 dark:text-blue-300 hover:underline truncate"
                        title={doc.data.label}
                        onClick={() => handleFocusNode(doc.id)}
                      >
                        {doc.data.label}
                      </button>
                      <span className="text-xs text-gray-400">{doc.data.fileType}</span>
                      <span className="text-xs text-gray-400">{formatFileSize(doc.data.fileSize || 0)}</span>
                      <span className="text-xs text-gray-400">{doc.data.status}</span>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                      {doc.data.fileName}
                    </div>
                    <div className="text-xs text-gray-400">
                      Uploaded: {doc.data.uploadedAt ? format(new Date(doc.data.uploadedAt), 'Pp') : '—'}
                    </div>
                    {previewDocId === doc.id && (
                      <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 text-xs max-h-32 overflow-y-auto">
                        <pre className="whitespace-pre-wrap font-sans">{doc.data.extractedText?.slice(0, 1000) || 'No preview available.'}</pre>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <button
                      className="text-xs text-red-500 hover:text-red-700"
                      onClick={() => setConfirmDeleteId(doc.id)}
                      title="Delete document"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {confirmDeleteId === doc.id && (
                      <div className="absolute right-0 mt-8 bg-white dark:bg-gray-900 border border-red-200 dark:border-red-700 rounded shadow p-3 z-50">
                        <div className="text-sm mb-2">Delete <strong>{doc.data.label}</strong>?</div>
                        <div className="flex gap-2">
                          <button className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                          <button className="px-2 py-1 text-xs bg-red-600 text-white rounded" onClick={() => handleDelete(doc.id)}>Delete</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
} 