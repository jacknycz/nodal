'use client'

import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash2, Edit3 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import IconButton from '../../components/ui/IconButton'
// Remove the board store import since we're using the prop
// import { useBoardStore } from '../board/boardSlice'

interface NodalNodeProps {
  data: {
    label: string
    title?: string
    content?: string
    type?: string
    expanded?: boolean
    aiGenerated?: boolean
  }
  id: string
  onNodeDelete?: (nodeId: string) => void
}

export default function NodalNode({ data, id, onNodeDelete }: NodalNodeProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  // Remove the board store import since we're using the prop
  // const deleteNode = useBoardStore((state) => state.deleteNode)
  // Use label as the primary title, fallback to title if label doesn't exist
  const displayTitle = data.label || data.title || 'Untitled'

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteModal(true)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    // Edit modal coming soon
  }

  const handleConfirmDelete = () => {
    setShowDeleteModal(false)
    if (onNodeDelete) {
      onNodeDelete(id)
    }
  }

  return (
    <div className="flex flex-col justify-start text-left p-4 min-w-[240px] max-w-[640px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm group">
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="nodal-drag-handle cursor-move">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          {displayTitle}
        </h3>
        {data.content && (
          <p className="text-xs text-gray-600 dark:text-gray-200 mb-3">
            {data.content}
          </p>
        )}
      </div>
      {/* Action buttons - only show on hover */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <IconButton
          variant="default"
          size="sm"
          aria-label="Edit node"
          onClick={handleEdit}
        >
          <Edit3 size={14} />
        </IconButton>
        <IconButton
          variant="danger"
          size="sm"
          aria-label="Delete node"
          onClick={handleDelete}
        >
          <Trash2 size={14} />
        </IconButton>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
      {/* Delete confirmation modal */}
      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Node?"
        description="Are you sure you want to delete this node? This action cannot be undone."
        actions={
          <>
            <button
              className="px-4 py-2 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600 transition"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded bg-red-500 text-white hover:bg-red-600 transition"
              onClick={handleConfirmDelete}
            >
              Delete
            </button>
          </>
        }
      >
        <div className="py-2">
          <span className="font-medium text-gray-900 dark:text-white">{displayTitle}</span>
        </div>
      </Modal>
    </div>
  )
}
