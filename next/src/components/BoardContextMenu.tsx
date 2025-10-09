'use client'

import React from 'react'
import { PlusCircle, TreeStructure, CheckSquare, ClipboardText, TreeView, Pencil, Tag as TagIcon, Trash, CaretRight, TextHOne } from '@phosphor-icons/react/dist/ssr'
import { useBoardStore } from '../features/board/boardSlice'
import Modal from './ui/Modal'
import Button from './ui/Button'
import Checkbox from './ui/Checkbox'
import { getColorgoryHex } from '../features/board/colorgoryColors'

interface BoardContextMenuProps {
  isOpen: boolean
  position: { x: number; y: number } | null
  onClose: () => void
  onAddBlankNode: (position: { x: number; y: number }) => void
  onGenerateAINode: () => void
  nodeId?: string | null
  onAddConnectedNodes?: (nodeId: string, position: { x: number; y: number }) => void
  onAddTaskNode?: () => void
  onAddHeadlineNode?: () => void
  onQuickAIGenerateNodes?: (nodeId?: string | null) => void
  onPasteNode?: (position: { x: number; y: number }) => void
  onPasteConnectedNode?: (nodeId: string, position: { x: number; y: number }) => void
  onOrganizeSubtree?: (nodeId: string) => void
  onEditNode?: (nodeId: string) => void
  onUpdateNode?: (nodeId: string, updates: Record<string, any>) => void
  onDeleteNode?: (nodeId: string) => void
  // Lock state (optional)
  isLockedByOther?: boolean
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
  onAddHeadlineNode,
  onQuickAIGenerateNodes,
  onPasteNode,
  onPasteConnectedNode,
  onOrganizeSubtree,
  onEditNode,
  onUpdateNode,
  onDeleteNode,
  isLockedByOther = false,
}: BoardContextMenuProps) {
  const menuRef = React.useRef<HTMLDivElement | null>(null)
  const edges = useBoardStore((s: any) => s.edges || [])
  const nodes = useBoardStore((s: any) => s.nodes || [])
  const selectedIds = useBoardStore((s: any) => s.selectedNodeIds || [])
  const hasChildren = React.useMemo(() => {
    if (!nodeId) return false
    return (edges || []).some((e: any) => e?.source === nodeId)
  }, [edges, nodeId])
  const colorgoriesAll = useBoardStore((s: any) => s.colorgories || [])
  const colorgoriesVisible = React.useMemo(() => (colorgoriesAll || []).filter((c: any) => c?.visible !== false), [colorgoriesAll])
  const nodeColorgoryIds: string[] = React.useMemo(() => {
    if (!nodeId) return []
    const n = (nodes as any[]).find(n => n.id === nodeId)
    const ids = (n?.data?.colorgoryIds as string[]) || []
    return Array.isArray(ids) ? ids : []
  }, [nodes, nodeId])
  const [colorgoryHover, setColorgoryHover] = React.useState(false)
  const [showDelete, setShowDelete] = React.useState(false)
  const multiSelected = React.useMemo(() => {
    return Array.isArray(selectedIds) && selectedIds.length > 1 && !!nodeId && selectedIds.includes(nodeId)
  }, [selectedIds, nodeId])

  // Reset delete modal whenever menu opens/closes or target node changes
  React.useEffect(() => {
    if (!isOpen) setShowDelete(false)
  }, [isOpen])
  React.useEffect(() => {
    setShowDelete(false)
  }, [nodeId])

  React.useEffect(() => {
    if (!isOpen) return

    const handleMouseDown = (e: MouseEvent) => {
      // If delete modal is open, don't auto-close the menu on outside clicks
      if (showDelete) return
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      if (showDelete) return
      if (!menuRef.current) return
      if (!menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (showDelete) return
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
  }, [isOpen, onClose, showDelete])

  if (!isOpen || !position) return null

  const handleAction = (action: () => void) => {
    action()
    onClose()
  }

  return (
    <>
      <div
        className="fixed z-[700] bg-white overflow-visible dark:bg-gray-800 rounded-2xl shadow-lg 
        min-w-[200px] nodal-no-select"
        style={{ left: position.x, top: position.y }}
        ref={menuRef}
      >
        {nodeId ? (
          <>
            {!multiSelected && (
              <button
                onClick={() => !isLockedByOther && handleAction(() => onEditNode && nodeId && onEditNode(nodeId))}
                disabled={isLockedByOther}
                className={`w-full px-4 py-2 rounded-t-2xl text-left text-sm flex items-center gap-3 ${isLockedByOther ? 'text-gray-400 cursor-not-allowed' : 'cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                aria-disabled={isLockedByOther}
              >
                <Pencil size={18} className="w-4 h-4" />
                {isLockedByOther ? 'Locked (editing)' : 'Edit Node'}
              </button>
            )}

            {!multiSelected && (<div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />)}

            {!multiSelected && onAddConnectedNodes && (
              <button onClick={() => handleAction(() => onAddConnectedNodes(nodeId, position))}
                className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3">
                <TreeStructure size={18} className="w-4 h-4" />
                Add Node(s)
              </button>
            )}

            {!multiSelected && onQuickAIGenerateNodes && (
              <button onClick={() => handleAction(() => onQuickAIGenerateNodes(nodeId))}
                className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3">
                <PlusCircle size={18} className="w-4 h-4" />
                Generate AI Node(s)
              </button>
            )}

            {!multiSelected && onPasteConnectedNode && (
              <button onClick={() => handleAction(() => onPasteConnectedNode(nodeId, position))}
                className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3">
                <ClipboardText size={18} className="w-4 h-4" />
                Paste Node
              </button>
            )}

            {!multiSelected && onAddTaskNode && (
              <button onClick={() => handleAction(onAddTaskNode)}
                className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3">
                <CheckSquare size={18} className="w-4 h-4" />
                Add Task
              </button>
            )}

            {!multiSelected && onAddHeadlineNode && (
              <button onClick={() => handleAction(onAddHeadlineNode)}
                className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3">
                <TextHOne size={18} className="w-4 h-4" />
                Add Headline
              </button>
            )}

            {!multiSelected && (<div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />)}

            {/* Bottom section: Colorgory, then Delete */}
            <div className="relative"
              onMouseEnter={() => setColorgoryHover(true)}
              onMouseLeave={() => setColorgoryHover(false)}
            >
              <div className="flex items-center justify-between w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                <span className="flex items-center gap-3"><TagIcon size={18} className="w-4 h-4" /> Colorgory</span>
                <CaretRight size={16} weight="duotone" className="transition-transform duration-200 text-gray-400" /> 
              </div>
              {colorgoryHover && (
                <div className="absolute left-full top-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-[220px] p-2 z-[710]">
                  <div className="grid grid-cols-2 gap-1">
                    {(colorgoriesVisible || []).map((c: any) => {
                      const checked = nodeColorgoryIds.includes(c.id)
                      const hex = getColorgoryHex(c.id)
                      return (
                        <Checkbox
                          key={c.id}
                          checked={checked}
                          onChange={(next) => {
                            if (!onUpdateNode) return
                            const targets: string[] = (selectedIds && selectedIds.length > 1 && nodeId && selectedIds.includes(nodeId))
                              ? [...selectedIds]
                              : (nodeId ? [nodeId] : [])
                            if (targets.length === 0) return
                            for (const tid of targets) {
                              const n = (nodes as any[]).find(nn => nn.id === tid)
                              const cur: string[] = Array.isArray(n?.data?.colorgoryIds) ? [...(n!.data!.colorgoryIds as string[])] : []
                              const has = cur.includes(c.id)
                              let nextIds: string[] = cur
                              if (next && !has) nextIds = [...cur, c.id]
                              if (!next && has) nextIds = cur.filter(x => x !== c.id)
                              onUpdateNode(tid, { colorgoryIds: nextIds })
                            }
                          }}
                          label={c.name}
                          labelTextClassName="text-xs"
                          className="rounded px-2 py-1"
                          controlStyle={{ borderColor: hex, borderWidth: 2 }}
                          checkColor={hex}
                        />
                      )
                    })}
                    {(colorgoriesVisible || []).length === 0 && (
                      <div className="col-span-2 text-xs text-gray-500 dark:text-gray-400 px-1 py-0.5">No colorgories</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button onClick={() => { console.log('[BoardContextMenu] Open delete modal for node', nodeId); setShowDelete(true) }}
              className="cursor-pointer w-full px-4 py-2 rounded-b-2xl text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-3">
              <Trash size={18} className="w-4 h-4" />
              {multiSelected ? 'Delete Nodes' : 'Delete Node'}
            </button>
          </>
        ) : (
          <>
            {onAddBlankNode && (
              <button onClick={() => handleAction(() => onAddBlankNode(position))}
                className="cursor-pointer w-full px-4 py-2 rounded-t-2xl text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3">
                <PlusCircle size={18} className="w-4 h-4" />
                Add Node(s)
              </button>
            )}
            {onPasteNode && (
              <button onClick={() => handleAction(() => onPasteNode(position))}
                className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3">
                <ClipboardText size={18} className="w-4 h-4" />
                Paste Node
              </button>
            )}
            {onAddTaskNode && (
              <button onClick={() => handleAction(onAddTaskNode)}
                className="cursor-pointer w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3">
                <CheckSquare size={18} className="w-4 h-4" />
                Add Task
              </button>
            )}

            {onAddHeadlineNode && (
              <button onClick={() => handleAction(onAddHeadlineNode)}
                className="cursor-pointer w-full px-4 py-2 rounded-b-2xl text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-3">
                <TagIcon size={18} className="w-4 h-4" />
                Add Headline
              </button>
            )}
          </>
        )}
      </div>

      <Modal
        open={Boolean(showDelete && (nodeId || (multiSelected && selectedIds.length > 1)))}
        onClose={() => setShowDelete(false)}
        title={multiSelected ? `Delete ${selectedIds.length} nodes` : 'Delete Node'}
        description={multiSelected ? 'Are you sure you want to delete the selected nodes? This action cannot be undone.' : 'Are you sure you want to delete this node? This action cannot be undone.'}
        actions={
          <>
            <Button variant="secondary" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="danger" onClick={() => {
              console.log('[BoardContextMenu] Confirm delete', multiSelected ? selectedIds : nodeId)
              setShowDelete(false)
              onClose()
              const ids = multiSelected ? selectedIds : (nodeId ? [nodeId] : [])
              ids.forEach((id) => {
                if (!id) return
                if (onDeleteNode) setTimeout(() => onDeleteNode(id), 0)
                try { window.dispatchEvent(new CustomEvent('nodal:delete-node', { detail: { id } })) } catch {}
                try { const fn = (window as any).__deleteNodeFromBoard; if (typeof fn === 'function') setTimeout(() => fn(id), 0) } catch {}
              })
            }}>Delete</Button>
          </>
        }
      />
    </>
  )
} 