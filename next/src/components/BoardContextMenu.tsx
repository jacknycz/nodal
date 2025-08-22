'use client'

import React from 'react'
import { Plus, Sparkles } from 'lucide-react'

interface BoardContextMenuProps {
  isOpen: boolean
  position: { x: number; y: number } | null
  onClose: () => void
  onAddBlankNode: () => void
  onGenerateAINode: () => void
  nodeId?: string | null
  onAddConnectedNodes?: (nodeId: string) => void
  onAddTaskNode?: () => void
}

export default function BoardContextMenu({
  isOpen,
  position,
  onClose,
  onAddBlankNode,
  onGenerateAINode,
  nodeId,
  onAddConnectedNodes,
  onAddTaskNode,
}: BoardContextMenuProps) {
  if (!isOpen || !position) return null

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <>
      {/* Backdrop to close menu when clicking outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* Context menu */}
      <div
        className="fixed z-50 bg-white overflow-hidden dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[200px]"
        style={{
          left: position.x,
          top: position.y,
        }}
      >
        {nodeId && onAddConnectedNodes && (
          <button
            onClick={() => handleAction(() => onAddConnectedNodes(nodeId))}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add connected node(s)
          </button>
        )}

        <button
          onClick={() => handleAction(onAddBlankNode)}
          className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add node(s)
        </button>

        {onAddTaskNode && (
          <button
            onClick={() => handleAction(onAddTaskNode)}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add task
          </button>
        )}
        
        <button
          onClick={() => handleAction(onGenerateAINode)}
          className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Generate AI Node
        </button>
      </div>
    </>
  )
} 