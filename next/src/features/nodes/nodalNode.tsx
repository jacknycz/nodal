'use client'

import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash2, Edit3 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import IconButton from '../../components/ui/IconButton'
import Button from '../../components/ui/Button'
import NodeEditModal from '../../components/NodeEditModal'
import { useBoardStore } from '../board/boardSlice'

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
  onNodeUpdate?: (nodeId: string, updates: Partial<{ label: string; title: string; content: string }>) => void
  selected?: boolean
}

export default function NodalNode({ data, id, onNodeDelete, onNodeUpdate, selected }: NodalNodeProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  
  const displayTitle = data.label || data.title || 'Untitled'

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteModal(true)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowEditModal(true)
  }

  const handleConfirmDelete = () => {
    setShowDeleteModal(false)
    if (onNodeDelete) {
      onNodeDelete(id)
    }
  }

  const handleSaveEdit = (title: string, content: string) => {
    if (onNodeUpdate) {
      onNodeUpdate(id, {
        title,
        content
      })
    }
  }

  // Function to render rich content safely
  const renderRichContent = (htmlContent: string) => {
    return (
      <div 
        className="text-xs text-gray-600 dark:text-gray-200 mb-3 prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    )
  }

  return (
    <div 
      className={`flex flex-col justify-start text-left p-4 min-w-[240px] max-w-[540px] bg-white dark:bg-gray-800 border rounded-lg shadow-sm group ${
        selected 
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      <div className="nodal-drag-handle cursor-move">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
          {displayTitle}
        </h3>
        {data.content && (
          <div className="mb-3">
            {renderRichContent(data.content)}
          </div>
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
          <span className="font-medium text-gray-900 dark:text-white">{displayTitle}</span>
        </div>
      </Modal>

      {/* Rich text edit modal */}
      <NodeEditModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSave={handleSaveEdit}
        initialTitle={displayTitle}
        initialContent={data.content || ''}
      />
    </div>
  )
}
