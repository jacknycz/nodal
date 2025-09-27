'use client'

import React from 'react'
import { PlusCircle, CheckCircle, TreeStructure, CheckSquare, ClipboardText, TreeView, Pencil } from '@phosphor-icons/react/dist/ssr'
import { useBoardStore } from '../features/board/boardSlice'

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
  onPasteNode?: (position: { x: number; y: number }) => void
  onPasteConnectedNode?: (nodeId: string, position: { x: number; y: number }) => void
  onOrganizeSubtree?: (nodeId: string) => void
  onEditNode?: (nodeId: string) => void
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
  onPasteNode,
  onPasteConnectedNode,
  onOrganizeSubtree,
  onEditNode,
}: BoardContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const edges = useBoardStore((s: any) => s.edges || [])
  const hasChildren = React.useMemo(() => {
    if (!nodeId) return false
    return (edges || []).some((e: any) => e?.source === nodeId)
  }, [edges, nodeId])

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
        className="fixed z-[500] bg-white overflow-hidden dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[200px]"
        style={{
          left: position.x,
          top: position.y,
        }}
        ref={menuRef}
      >
        {nodeId && onEditNode && (
          <button
            onClick={() => handleAction(() => onEditNode(nodeId))}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <Pencil size={24} weight="duotone" className="w-4 h-4" />
            Edit node
          </button>
        )}

        {nodeId && onAddConnectedNodes && (
          <button
            onClick={() => handleAction(() => onAddConnectedNodes(nodeId, position))}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <TreeStructure size={24} weight="duotone" className="w-4 h-4" />
            Add connected node(s)
          </button>
        )}

        {nodeId && onPasteConnectedNode && (
          <button
            onClick={() => handleAction(() => onPasteConnectedNode(nodeId, position))}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <ClipboardText size={24} weight="duotone" className="w-4 h-4" />
            Paste connected node
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

        {nodeId && onOrganizeSubtree && hasChildren && (
          <button
            onClick={() => handleAction(() => onOrganizeSubtree(nodeId))}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <TreeView size={24} weight="duotone" className="w-4 h-4" />
            Reorganize nodes
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

        {!nodeId && onPasteNode && (
        <button
          onClick={async () => handleAction(() => onPasteNode(position))}
          className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
        >
          <ClipboardText size={24} weight="duotone" className="w-4 h-4" />
          Paste node
        </button>
        )}

        {onAddTaskNode && (
          <button
            onClick={() => handleAction(onAddTaskNode)}
            className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3 transition-colors"
          >
            <CheckSquare size={24} weight="duotone" className="w-4 h-4" />
            Add task
          </button>
        )}
        
      </div>
    </> 
  )
} 