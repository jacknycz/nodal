import React, { useState, useRef, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import { Heading } from 'pres-start-core'
import type { NodeProps } from '@xyflow/react'
import type { BoardNode } from '../board/boardTypes'
import { useNodeActions } from './useNodeActions'

export default function NodalNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as BoardNode['data']
  const { updateNodeLabel, updateNodeContent } = useNodeActions(id)
  const nodeRef = useRef<HTMLDivElement>(null)
  
  // Label editing state
  const [isEditingLabel, setIsEditingLabel] = useState(false)
  const [editLabelValue, setEditLabelValue] = useState(nodeData.label)
  const labelInputRef = useRef<HTMLInputElement>(null)
  
  // Content editing state
  const [isEditingContent, setIsEditingContent] = useState(false)
  const [editContentValue, setEditContentValue] = useState(nodeData.content || '')
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null)
  
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
  
  // Prevent dragging when clicking on inputs
  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }
  
  return (
    <div 
      ref={nodeRef}
      className={`relative min-w-96 p-4 bg-white rounded-lg shadow-lg border-2 transition-all duration-200 ${
        selected ? 'border-tertiary-500 shadow-tertiary-200' : 'border-gray-200'
      } ${(isEditingLabel || isEditingContent) ? 'border-blue-400 bg-blue-50' : ''} group`}
    >
      {/* Easy Connect Pattern: Single source handle covering entire node */}
      <Handle
        type="source"
        position={Position.Top}
        className="!opacity-0 !pointer-events-auto !cursor-crosshair"
        style={{ 
          top: '0%', 
          left: '0%',
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '0.5rem',
          background: 'transparent',
          zIndex: 1
        }}
      />
      
      {/* Target handles positioned at edges - small and non-interfering */}
      <Handle
        type="target"
        position={Position.Top}
        className="!opacity-0"
        style={{ 
          top: '-6px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          width: '12px',
          height: '12px'
        }}
      />
      <Handle
        type="target"
        position={Position.Bottom}
        className="!opacity-0"
        style={{ 
          bottom: '-6px', 
          left: '50%', 
          transform: 'translateX(-50%)',
          width: '12px',
          height: '12px'
        }}
      />
      <Handle
        type="target"
        position={Position.Left}
        className="!opacity-0"
        style={{ 
          left: '-6px', 
          top: '50%', 
          transform: 'translateY(-50%)',
          width: '12px',
          height: '12px'
        }}
      />
      <Handle
        type="target"
        position={Position.Right}
        className="!opacity-0"
        style={{ 
          right: '-6px', 
          top: '50%', 
          transform: 'translateY(-50%)',
          width: '12px',
          height: '12px'
        }}
      />
      
      {/* Connection hint overlay */}
      <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5">
        <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow-lg">
          Drag to connect
        </div>
      </div>
      
      {/* Content wrapper with higher z-index for text editing */}
      <div className="relative z-10 pointer-events-none">
        {/* Drag Handle for node movement */}
        <div className="nodal-drag-handle cursor-move mb-2 p-2 -m-2 hover:bg-gray-50 rounded pointer-events-auto">
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
          <div className="relative pointer-events-auto">
            {isEditingLabel ? (
              <input
                ref={labelInputRef}
                type="text"
                value={editLabelValue}
                onChange={(e) => setEditLabelValue(e.target.value)}
                onKeyDown={handleLabelKeyDown}
                onClick={handleInputClick}
                onBlur={handleLabelSave}
                className="w-full px-2 py-1 text-lg font-semibold border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 nodrag"
                maxLength={100}
              />
            ) : (
              <div
                onDoubleClick={handleLabelDoubleClick}
                className="px-2 py-1 cursor-pointer hover:bg-gray-50 rounded group"
              >
                <Heading size="h4">{nodeData.label}</Heading>
                <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  Double-click to edit
                </div>
              </div>
            )}
          </div>
          
          {/* Editable Content Area */}
          <div className="relative pointer-events-auto">
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
                  className="w-full px-3 py-2 text-sm border border-blue-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 nodrag min-h-[60px]"
                  maxLength={1000}
                />
                <div className="text-xs text-gray-500 px-1">
                  Press Ctrl+Enter to save, Escape to cancel
                </div>
              </div>
            ) : (
              <div
                onDoubleClick={handleContentClick}
                className={`px-3 py-2 cursor-pointer rounded border-2 border-dashed transition-colors group ${
                  nodeData.content 
                    ? 'border-transparent hover:border-gray-300 hover:bg-gray-50' 
                    : 'border-gray-300 hover:border-blue-300 hover:bg-blue-50'
                }`}
              >
                {nodeData.content ? (
                  <div className="space-y-1">
                    <div className={`text-sm whitespace-pre-wrap ${
                      nodeData.aiGenerated ? 'text-blue-700' : 'text-gray-700'
                    }`}>
                      {nodeData.content}
                    </div>
                    <div className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      Double-click to edit content
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2 text-gray-400 group-hover:text-blue-500 transition-colors">
                    <div className="text-sm">+ Add content</div>
                    <div className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      Double-click to add details
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* AI Generated Indicator */}
          {nodeData.aiGenerated && (
            <div className="flex items-center space-x-1 text-xs text-blue-600 px-2 pointer-events-auto">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>AI Generated</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 