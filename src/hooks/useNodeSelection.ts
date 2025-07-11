import { useMemo } from 'react'
import { useBoard } from '../features/board/useBoard'
import type { BoardNode } from '../features/board/boardTypes'

export interface SelectedNodesInfo {
  selectedNodes: BoardNode[]
  selectedCount: number
  hasSelection: boolean
  getSelectionSummary: () => string
  getSelectionContext: () => string
}

export function useNodeSelection(): SelectedNodesInfo {
  const { nodes } = useBoard()
  
  const selectedNodes = useMemo(() => {
    return nodes.filter(node => node.selected)
  }, [nodes])
  
  const selectedCount = selectedNodes.length
  const hasSelection = selectedCount > 0
  
  const getSelectionSummary = () => {
    if (selectedCount === 0) return 'No nodes selected'
    if (selectedCount === 1) return `1 node selected: "${selectedNodes[0].data.label}"`
    return `${selectedCount} nodes selected`
  }
  
  const getSelectionContext = () => {
    if (selectedCount === 0) return ''
    
    const nodeDescriptions = selectedNodes.map(node => {
      const label = node.data.label || 'Untitled'
      const content = node.data.content || 'No content'
      const type = node.data.type || 'unknown'
      
      return `**${label}** (${type})\n${content}`
    }).join('\n\n')
    
    return `Selected nodes for context:\n\n${nodeDescriptions}`
  }
  
  return {
    selectedNodes,
    selectedCount,
    hasSelection,
    getSelectionSummary,
    getSelectionContext
  }
} 