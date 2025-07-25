'use client'

import { useMemo } from 'react'
import { useBoardStore } from '../board/boardSlice'
import { useFocusStore } from './focusSlice'

export function useFocusTree() {
  const nodes = useBoardStore(state => state.nodes)
  const edges = useBoardStore(state => state.edges)
  const focusedNodeId = useFocusStore(state => state.focusedNodeId)

  const focusTreeNodes = useMemo(() => {
    if (!focusedNodeId) return []
    // Stub implementation - return just the focused node for now
    const focusedNode = nodes.find((n: any) => n.id === focusedNodeId)
    return focusedNode ? [focusedNode] : []
  }, [nodes, focusedNodeId])

  return { focusTreeNodes }
} 