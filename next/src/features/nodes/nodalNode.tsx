'use client'

import React, { useState } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Trash2, Edit3 } from 'lucide-react'
import Modal from '../../components/ui/Modal'
import IconButton from '../../components/ui/IconButton'
import Button from '../../components/ui/Button'
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
  onNodeUpdate?: (nodeId: string, updates: any) => void
  selected?: boolean
}

export default function NodalNode({ data, id, onNodeDelete, onNodeUpdate, selected }: NodalNodeProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTitle, setEditTitle] = useState(data.label || data.title || '')
  const [editContent, setEditContent] = useState(data.content || '')
  
  const displayTitle = data.label || data.title || 'Untitled'

  // Use XYFlow's selected prop instead of custom selection

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteModal(true)
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditTitle(data.label || data.title || '')
    setEditContent(data.content || '')
    setShowEditModal(true)
  }

  // Remove custom selection logic - use XYFlow's built-in selection

  const handleConfirmDelete = () => {
    setShowDeleteModal(false)
    if (onNodeDelete) {
      onNodeDelete(id)
    }
  }

  const handleConfirmEdit = () => {
    setShowEditModal(false)
    if (onNodeUpdate) {
      onNodeUpdate(id, {
        label: editTitle,
        content: editContent
      })
    }
  }

  return (
    <div 
      className={`flex flex-col justify-start text-left p-4 min-w-[240px] max-w-[640px] bg-white dark:bg-gray-800 border rounded-lg shadow-sm group ${
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

      {/* Edit modal */}
      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Node"
        description="Update the node's title and content."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowEditModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmEdit}
            >
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div>
            <label htmlFor="edit-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              id="edit-title"
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter node title..."
            />
          </div>
          <div>
            <label htmlFor="edit-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Content
            </label>
            <textarea
              id="edit-content"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="Enter node content..."
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
