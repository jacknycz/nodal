import React, { useState, useRef, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Heading } from 'pres-start-core'
import type { NodeProps } from '@xyflow/react'
import type { BoardNode } from '../board/boardTypes'
import { useNodeActions } from './useNodeActions'

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
  
  // Label editing state
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editLabelValue, setEditLabelValue] = useState(nodeData.label)
  const labelInputRef = useRef<HTMLInputElement>(null)
  
  // Content editing state
  const [isEditingContent, setIsEditingContent] = useState(false)
  const [editContentValue, setEditContentValue] = useState(nodeData.content || '')
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null)
  
  // Delete confirmation state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  
  // Auto-focus and select text when entering edit mode
  useEffect(() => {
    if (isEditingLabel && labelInputRef.current) {
      labelInputRef.current.focus()
      labelInputRef.current.select()
    }
  }, [isEditingLabel])
  
  useEffect(() => {
    if (isEditingContent && contentTextareaRef.current) {
      contentTextareaRef.current.focus()
      // Auto-resize textarea
      autoResizeTextarea()
    }
  }, [isEditingContent])
  
  // Reset edit values when nodeData changes
  useEffect(() => {
    setEditLabelValue(nodeData.label)
  }, [nodeData.label])
  
  useEffect(() => {
    setEditContentValue(nodeData.content || '')
  }, [nodeData.content])
  
  // Auto-resize textarea function
  const autoResizeTextarea = () => {
    if (contentTextareaRef.current) {
      contentTextareaRef.current.style.height = 'auto'
      contentTextareaRef.current.style.height = contentTextareaRef.current.scrollHeight + 'px'
    }
  }
  
  // Label editing handlers
  const handleLabelDoubleClick = () => {
    if (!isEditingContent) { // Prevent editing both at once
      setIsEditingLabel(true)
      setEditLabelValue(nodeData.label)
    }
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
  
  // Content editing handlers
  const handleContentClick = () => {
    if (!isEditingLabel) { // Prevent editing both at once
      setIsEditingContent(true)
      setEditContentValue(nodeData.content || '')
    }
  }
  
  const handleContentSave = () => {
    const trimmedContent = editContentValue.trim()
    if (trimmedContent !== (nodeData.content || '')) {
      updateNodeContent(trimmedContent)
    }
    setIsEditingContent(false)
  }
  
  const handleContentCancel = () => {
    setEditContentValue(nodeData.content || '')
    setIsEditingContent(false)
  }
  
  const handleContentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault()
      handleContentSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleContentCancel()
    }
  }
  
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContentValue(e.target.value)
    autoResizeTextarea()
  }
  
  // Delete handlers
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteModal(true)
  }
  
  const handleDeleteConfirm = () => {
    removeNode()
    setShowDeleteModal(false)
  }
  
  const handleDeleteCancel = () => {
    setShowDeleteModal(false)
  }
  
  // Prevent dragging when clicking on inputs
  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }
  
  return (
    <>
      <div 
        ref={nodeRef}
        className={`relative min-w-96 max-w-[800px] p-4 bg-white dark:bg-gray-800 rounded-4xl dark:border-gray-700 transition-all duration-200 ${
          selected ? 'border shadow-lg border-tertiary-500 shadow-tertiary-200' : 'borderborder-gray-200'
        } ${(isEditingLabel || isEditingContent) ? 'border border-blue-400 bg-blue-50' : ''} group`}
      >
        {/* Easy Connect Pattern: Simple visible handles */}
        <Handle
          type="source"
          position={Position.Right}
          className="!w-4 !h-4 !bg-gray-500 !border-2 !border-white !opacity-100 !right-[-8px] !top-1/2 !transform !-translate-y-1/2 hover:!bg-primary-600 transition-colors"
          style={{ 
            zIndex: 10,
            cursor: 'crosshair'
          }}
        />
        
        <Handle
          type="target"
          position={Position.Left}
          className="!w-4 !h-4 !bg-gray-500 !border-2 !border-white !opacity-100 !left-[-8px] !top-1/2 !transform !-translate-y-1/2 hover:!bg-primary-600 transition-colors"
          style={{ 
            zIndex: 10
          }}
        />
        
        {/* Content wrapper */}
        <div className="relative z-10">
          {/* Drag Handle for node movement */}
          <div className="nodal-drag-handle cursor-move mb-2 p-2 -m-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
              </div>
              <div className="text-xs text-gray-400">drag to move</div>
            </div>
          </div>
          
          <div className="space-y-3">
            {/* Editable Label */}
            <div className="relative">
              {isEditingLabel ? (
                <input
                  ref={labelInputRef}
                  type="text"
                  value={editLabelValue}
                  onChange={(e) => setEditLabelValue(e.target.value)}
                  onKeyDown={handleLabelKeyDown}
                  onClick={handleInputClick}
                  onBlur={handleLabelSave}
                  className="w-full px-2 py-1 text-lg text-black dark:text-white font-semibold border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 nodrag"
                  maxLength={100}
                />
              ) : (
                                  <div
                    onDoubleClick={handleLabelDoubleClick}
                    className="py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded group"
                  >
                    <div className="flex items-center justify-between">
                      <Heading size="h4" className="font-medium text-lg dark:text-white" variant="custom">{nodeData.label}</Heading>
                      <svg 
                        className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" 
                        />
                      </svg>
                    </div>
                    {/* <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Double-click to edit
                    </div> */}
                  </div>
              )}
            </div>
            
            {/* Editable Content Area */}
            <div className="relative">
              {isEditingContent ? (
                <div className="space-y-2">
                  <textarea
                    ref={contentTextareaRef}
                    value={editContentValue}
                    onChange={handleContentChange}
                    onKeyDown={handleContentKeyDown}
                    onClick={handleInputClick}
                    onBlur={handleContentSave}
                    placeholder="Add content to this node..."
                    className="w-full px-3 text-black dark:text-white py-2 text-sm border border-blue-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 nodrag min-h-[60px]"
                    maxLength={1000}
                  />
                  <div className="text-xs text-gray-500 dark:text-white px-1">
                    Press Ctrl+Enter to save, Escape to cancel
                  </div>
                </div>
              ) : (
                <div
                  onDoubleClick={handleContentClick}
                  className={`px-3 py-2 cursor-pointer rounded border-2 border-dashed transition-colors group ${
                    nodeData.content 
                      ? 'border-transparent hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700' 
                      : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                >
                  {nodeData.content ? (
                    <div className="space-y-1">
                      <div className={`text-sm whitespace-pre-wrap ${
                        nodeData.aiGenerated ? 'text-blue-700 dark:text-blue-400' : 'text-gray-700 dark:text-white'
                      }`}>
                        {nodeData.content}
                      </div>
                      <div className="text-xs text-gray-400 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                        Double-click to edit content
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-2 text-gray-400 dark:text-white group-hover:text-blue-500 transition-colors">
                      <div className="text-sm">+ Add content</div>
                      <div className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                        Double-click to add details
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Bottom Row: AI Generated Indicator + Delete Button */}
            <div className="flex items-center justify-between px-2">
              {/* AI Generated Indicator */}
              {nodeData.aiGenerated && (
                <div className="flex items-center space-x-1 text-xs text-blue-600">
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                  <span>AI Generated</span>
                </div>
              )}
              
              {/* Spacer when no AI indicator */}
              {!nodeData.aiGenerated && <div />}
              
              {/* Delete Button */}
              <button
                onClick={handleDeleteClick}
                className="flex cursor-pointer items-center space-x-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1 rounded transition-colors"
                title="Delete node"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={showDeleteModal}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        nodeLabel={nodeData.label}
      />
    </>
  )
} 