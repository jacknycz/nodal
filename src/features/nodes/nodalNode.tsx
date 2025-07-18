import React, { useState, useRef, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Heading } from 'pres-start-core'
import type { NodeProps } from '@xyflow/react'
import type { BoardNode } from '../board/boardTypes'
import { useNodeActions } from './useNodeActions'
import TipTapEditor from '../../components/TipTapEditor';
import { Button } from 'pres-start-core';
import { PencilIcon, TrashIcon } from 'lucide-react'

// Confirmation Modal Component
function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  nodeLabel
}: {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  nodeLabel: string
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Node</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-gray-700 dark:text-gray-300 mb-6">
          Are you sure you want to delete <strong>"{nodeLabel}"</strong>? This will also remove all connections to this node.
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
            Delete Node
          </button>
        </div>
      </div>
    </div>
  )
}

export default function NodalNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as BoardNode['data']
  const { updateNodeLabel, updateNodeContent, removeNode } = useNodeActions(id)
  const nodeRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Label editing state
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editLabelValue, setEditLabelValue] = useState(nodeData.title || '')
  const labelInputRef = useRef<HTMLInputElement>(null)

  // Content editing state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState(nodeData.title);
  const [editMedia, setEditMedia] = useState<{ url: string; alt?: string }[]>(nodeData.media || []);
  const [editContentValue, setEditContentValue] = useState(nodeData.content || '');

  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  // Auto-focus and select text when entering edit mode
  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus()
      labelInputRef.current.select()
    }
  }, [isEditingLabel])

  // Reset edit values when nodeData changes
  useEffect(() => {
    setEditLabelValue(nodeData.title || '')
  }, [nodeData.title])

  // 7. Add MAX_IMAGE_SIZE constant
  const MAX_IMAGE_SIZE = 1024 * 1024; // 1MB

  // Restore missing handlers for label and delete logic
  const handleLabelKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleLabelSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleLabelCancel();
    }
  };
  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };
  const handleLabelSave = () => {
    if (editLabelValue.trim() !== (nodeData.title || '')) {
      updateNodeLabel(editLabelValue.trim());
    }
    setIsEditingLabel(false);
  };
  const handleLabelCancel = () => {
    setEditLabelValue(nodeData.title || '');
    setIsEditingLabel(false);
  };
  const handleLabelDoubleClick = () => {
    setIsEditingLabel(true);
    setEditLabelValue(nodeData.title || '');
  };
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
  };
  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
  };
  const handleDeleteConfirm = () => {
    removeNode();
    setShowDeleteModal(false);
  };

  return (
    <>
      <div
        ref={nodeRef}
        className={`nodal-drag-handle relative bg-white dark:bg-gray-800 rounded-xl shadow-lg border-2 transition-all duration-200 cursor-move
          ${selected ? 'border-primary-500 ring-2 ring-primary-200 dark:ring-blue-800' : 'border-gray-200 dark:border-gray-700'}
          hover:shadow-xl
          w-80 max-w-md
          group
          ${(isEditingLabel) ? 'border border-blue-400 bg-blue-50' : ''}`}
      >
        {/* Easy Connect Pattern: Simple visible handles */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-4 !h-4 !bg-gray-500 !border-2 !border-white !right-[-8px] !top-1/2 !transform !-translate-y-1/2 hover:!bg-primary-600 transition-colors"
          style={{
            zIndex: 10,
            cursor: 'crosshair'
          }}
        />

        <Handle
          type="target"
          position={Position.Left}
          className="!w-4 !h-4 !bg-gray-500 !border-2 !border-white !left-[-8px] !top-1/2 !transform !-translate-y-1/2 hover:!bg-primary-600 transition-colors"
          style={{
            zIndex: 10
          }}
        />

        {/* Content wrapper */}
        <div className="relative z-10">
          {/* Drag Handle Icon */}
          <span className="inline-flex items-center cursor-move select-none text-gray-400 hover:text-primary-500 transition-colors mr-2">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="6" cy="7" r="1" fill="currentColor" />
              <circle cx="6" cy="13" r="1" fill="currentColor" />
              <circle cx="10" cy="7" r="1" fill="currentColor" />
              <circle cx="10" cy="13" r="1" fill="currentColor" />
              <circle cx="14" cy="7" r="1" fill="currentColor" />
              <circle cx="14" cy="13" r="1" fill="currentColor" />
            </svg>
          </span>
          {/* Drag Handle for node movement */}
          <div className="flex items-center justify-between">
            <div className="relative w-full px-3 flex items-center gap-2">
              {isEditingLabel ? (
                <input
                  ref={labelInputRef}
                  type="text"
                  value={editTitleValue || ''}
                  onChange={(e) => setEditTitleValue(e.target.value)}
                  onKeyDown={handleLabelKeyDown}
                  onClick={handleInputClick}
                  onBlur={handleLabelSave}
                  className="w-full px-2 py-1 text-lg text-black dark:text-white font-semibold border border-blue-300 rounded cursor-text focus:outline-none focus:ring-2 focus:ring-blue-500 nodrag"
                  maxLength={100}
                />
              ) : (
                <div
                  onDoubleClick={handleLabelDoubleClick}
                  className="cursor-text hover:bg-gray-50 dark:hover:bg-gray-700 rounded group w-full"
                >
                  <div className="flex">
                    <Heading size="h4" className="font-medium text-lg dark:text-white mb-0" variant="custom">{nodeData.title || ''}</Heading>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {/* Editable Content Area */}
            <div className="relative px-2">

              {nodeData.content && (
                <div
                  onDoubleClick={() => setShowEditModal(true)}
                  className={`px-1 py-1 cursor-text rounded transition-colors group ${nodeData.content
                    ? 'hover:bg-gray-50 dark:hover:bg-gray-700'
                    : 'hover:bg-blue-50 dark:hover:bg-blue-900/20'
                    }`}
                >
                  <div className="space-y-1">
                    <div className={`text-sm text-left whitespace-pre-wrap ${nodeData.aiGenerated ? 'text-primary-900 dark:text-primary-100' : 'text-gray-700 dark:text-white'}`}
                      dangerouslySetInnerHTML={{ __html: nodeData.content }}
                    />
                  </div>
                </div>
              )}

            </div>

            {/* After the content display, add media preview area */}
            {nodeData.media && nodeData.media.length > 0 && (
              <div className="flex flex-row flex-wrap gap-2 mt-2 px-2">
                {nodeData.media.map((img, idx) => (
                  <img
                    key={idx}
                    src={img.url}
                    alt={img.alt || `media-${idx}`}
                    className="w-12 h-12 object-cover rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow"
                  />
                ))}
              </div>
            )}

            {/* Bottom Row: AI Generated Indicator + Delete Button */}
            <div className="flex items-center justify-between px-2">
              {/* AI Generated Indicator */}
              {nodeData.aiGenerated && (
                <div className="flex items-center space-x-1 text-xs text-primary-500">
                  <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                  <span>AI Generated</span>
                </div>
              )}

              {/* Spacer when no AI indicator */}
              {!nodeData.aiGenerated && <div />}

              {/* Edit Button */}
              <div className="flex items-center space-x-1">
                <Button
                  onClick={() => setShowEditModal(true)}
                  className="flex cursor-pointer items-center space-x-1 text-xs text-primary-800 hover:bg-primary-50 dark:hover:bg-primary-500 rounded transition-colors"
                  title="Edit node"
                  iconLeft={<PencilIcon className="w-3 h-3" />}
                >
                  Edit
                </Button>

                {/* Delete Button */}
                <Button
                  onClick={handleDeleteClick}
                  className="flex cursor-pointer items-center space-x-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                  title="Delete node"
                  iconLeft={<TrashIcon className="w-3 h-3" />}
                >
                  <span>Delete</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        nodeLabel={nodeData.title || ''}
      />

      {/* 3. Editing modal placeholder (like delete modal) */}
      {showEditModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowEditModal(false)}
        >
          <div 
            className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 max-w-md mx-4 shadow-xl w-full max-w-lg text-left flex flex-col items-start"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4">
              {/* <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Title</label> */}
              <input className="w-full px-2 py-1 border border-gray-300 dark:border-gray-700 rounded mb-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500" value={editTitleValue} onChange={e => setEditTitleValue(e.target.value)} />
              {/* <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-200">Content</label> */}
              <div className="border rounded bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 dark:text-white">
                <TipTapEditor
                  value={editContentValue}
                  onChange={setEditContentValue}
                  onImageAdd={imgUrl => {
                    setEditMedia(prev => prev.some(img => img.url === imgUrl) ? prev : [...prev, { url: imgUrl }]);
                  }}
                  onImageDelete={imgUrl => {
                    setEditMedia(prev => prev.filter(img => img.url !== imgUrl));
                  }}
                />
              </div>
              <label className="block text-sm font-medium mt-3 mb-1 text-gray-700 dark:text-gray-200">Media (images, max 1MB each)</label>
              <div
                className="border-2 border-dashed rounded p-4 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 cursor-pointer mb-2"
                tabIndex={0}
                role="button"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
              >
                <span className="text-gray-400 dark:text-gray-500">Drag & drop images here or click to upload</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files || []);
                    files.forEach(file => {
                      if (file.size > MAX_IMAGE_SIZE) {
                        alert('Image must be less than 1MB');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          setEditMedia(prev => prev.some(img => img.url === reader.result) ? prev : [...prev, { url: reader.result as string }]);
                        }
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = '';
                  }}
                />
              </div>
              {editMedia.length > 0 && (
                <div className="flex flex-row flex-wrap gap-2 mt-2">
                  {editMedia.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img src={img.url} alt={img.alt || `edit-media-${idx}`} className="w-16 h-16 object-cover rounded shadow border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900" />
                      <button
                        className="absolute top-0 right-0 bg-red-600 text-white rounded-full p-1 opacity-80 hover:opacity-100 text-xs"
                        onClick={() => {
                          setEditMedia(prev => prev.filter((_, i) => i !== idx));
                          setEditContentValue(content =>
                            (content || '').replace(
                              new RegExp(`<img[^>]+src=["']${img.url}["'][^>]*>`, 'g'),
                              ''
                            )
                          );
                        }}
                        title="Remove image"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white" onClick={() => setShowEditModal(false)}>Cancel</button>
              <button className="px-4 py-2 rounded bg-primary-600 text-white" onClick={() => {
                // Save title if changed
                if ((editTitleValue || '') !== (nodeData.title || '')) {
                  updateNodeLabel(editTitleValue || '');
                }
                // Save content or media if changed
                if (
                  (editContentValue !== (nodeData.content || '')) ||
                  (JSON.stringify(editMedia) !== JSON.stringify(nodeData.media || []))
                ) {
                  updateNodeContent(editContentValue, editMedia);
                }
                setShowEditModal(false);
              }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
} 