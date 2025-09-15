'use client'

import React from 'react'
import { PlusCircle, CheckCircle } from '@phosphor-icons/react/dist/ssr'

interface BoardContextMenuProps {
  isOpen: boolean
  position: { x: number; y: number } | null
  onClose: () => void
  onAddBlankNode: (position: { x: number; y: number }) => void
  onGenerateAINode: () => void
  nodeId?: string | null
  onAddConnectedNodes?: (nodeId: string, position: { x: number; y: number }) => void
  onAddTaskNode?: () => void
  onQuickAIGenerateNodes?: (nodeId?: string | null) => void
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
  onQuickAIGenerateNodes,
}: BoardContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    if (!isOpen) return

    const handleMouseDown = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleMouseDown, true)
    document.addEventListener('contextmenu', handleContextMenu, true)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, true)
      document.removeEventListener('contextmenu', handleContextMenu, true)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !position) return null

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <>
      
      {/* Context menu */}
      <div
        className="fixed z-50 bg-white overflow-hidden dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[200px]"
        style={{
          left: position.x,
          top: position.y,
        }}
        ref={menuRef}
      >
        {nodeId && onAddConnectedNodes && (
          <button
            onClick={() => handleAction(() => onAddConnectedNodes(nodeId, position))}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <PlusCircle size={24} weight="duotone" className="w-4 h-4" />
            Add connected node(s)
          </button>
        )}

        {nodeId && onQuickAIGenerateNodes && (
          <button
            onClick={() => handleAction(() => onQuickAIGenerateNodes(nodeId))}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <PlusCircle size={24} weight="duotone" className="w-4 h-4" />
            Quick AI Generate Nodes
          </button>
        )}

        {!nodeId && onAddBlankNode && (
        <button
          onClick={() => handleAction(() => onAddBlankNode(position))}
          className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
        >
          <PlusCircle size={24} weight="duotone" className="w-4 h-4" />
          Add node(s)
        </button>
        )}

        {onAddTaskNode && (
          <button
            onClick={() => handleAction(onAddTaskNode)}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <CheckCircle size={24} weight="duotone" className="w-4 h-4" />
            Add task
          </button>
        )}
        
      </div>
    </> 
  )
} 