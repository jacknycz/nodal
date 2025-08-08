'use client'

import React from 'react'
import { Plus, Sparkles, Focus, Maximize2, Minimize2 } from 'lucide-react'

interface BoardContextMenuProps {
  isOpen: boolean
  position: { x: number; y: number } | null
  onClose: () => void
  onAddBlankNode: () => void
  onGenerateAINode: () => void
  onFocusNeighborhood?: () => void
  onFocusGroup?: () => void
  onClearFocus?: () => void
}

export default function BoardContextMenu({
  isOpen,
  position,
  onClose,
  onAddBlankNode,
  onGenerateAINode,
  onFocusNeighborhood,
  onFocusGroup,
  onClearFocus,
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
        <button
          onClick={() => handleAction(onAddBlankNode)}
          className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add a Blank Node
        </button>
        
        <button
          onClick={() => handleAction(onGenerateAINode)}
          className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          Generate AI Node
        </button>

        {onFocusNeighborhood && (
          <button
            onClick={() => handleAction(onFocusNeighborhood)}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <Focus className="w-4 h-4" />
            Focus Neighborhood
          </button>
        )}
        {onFocusGroup && (
          <button
            onClick={() => handleAction(onFocusGroup)}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
            Focus Group
          </button>
        )}
        {onClearFocus && (
          <button
            onClick={() => handleAction(onClearFocus)}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <Minimize2 className="w-4 h-4" />
            Clear Focus
          </button>
        )}
      </div>
    </>
  )
} 