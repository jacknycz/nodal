import { useCallback, useMemo } from 'react'
import { useBoardStore } from '../board/boardSlice'
import { useFocusStore } from './focusSlice'
import type { BoardNode, BoardEdge } from '../board/boardTypes'

export function useFocusTree() {
  const { nodes, edges } = useBoardStore()
  const { focusedNodeId, focusTree, setFocusTree } = useFocusStore()

  const buildFocusTree = useCallback(
    (startNodeId: string, maxDepth: number = 3): string[] => {
      const visited = new Set<string>()
      const tree: string[] = []
      
      function traverse(nodeId: string, depth: number) {
        if (depth > maxDepth || visited.has(nodeId)) return
        
        visited.add(nodeId)
        tree.push(nodeId)
        
        // Find all connected nodes
        const connectedEdges = edges.filter(
          edge => edge.source === nodeId || edge.target === nodeId
        )
        
        for (const edge of connectedEdges) {
          const nextNodeId = edge.source === nodeId ? edge.target : edge.source
          traverse(nextNodeId, depth + 1)
        }
      }
      
      traverse(startNodeId, 0)
      return tree
    },
    [edges]
  )

  const expandFocusTree = useCallback(
    (depth: number = 1) => {
      if (!focusedNodeId) return
      
      const newTree = buildFocusTree(focusedNodeId, depth)
      setFocusTree(newTree)
    },
    [focusedNodeId, buildFocusTree, setFocusTree]
  )

  const focusTreeNodes = useMemo(() => {
    return nodes.filter(node => focusTree.includes(node.id))
  }, [nodes, focusTree])

  const focusTreeEdges = useMemo(() => {
    return edges.filter(edge => 
      focusTree.includes(edge.source) && focusTree.includes(edge.target)
    )
  }, [edges, focusTree])

  const isNodeInFocusTree = useCallback(
    (nodeId: string) => {
      return focusTree.includes(nodeId)
    },
    [focusTree]
  )

  const getNodeDepth = useCallback(
    (nodeId: string) => {
      if (!focusedNodeId) return 0
      
      const visited = new Set<string>()
      
      function findDepth(currentNodeId: string, depth: number): number {
        if (currentNodeId === nodeId) return depth
        if (visited.has(currentNodeId)) return -1
        
        visited.add(currentNodeId)
        
        const connectedEdges = edges.filter(
          edge => edge.source === currentNodeId || edge.target === currentNodeId
        )
        
        for (const edge of connectedEdges) {
          const nextNodeId = edge.source === currentNodeId ? edge.target : edge.source
          const result = findDepth(nextNodeId, depth + 1)
          if (result !== -1) return result
        }
        
        return -1
      }
      
      return findDepth(focusedNodeId, 0)
    },
    [focusedNodeId, edges]
  )

  return {
    focusedNodeId,
    focusTree,
    focusTreeNodes,
    focusTreeEdges,
    buildFocusTree,
    expandFocusTree,
    isNodeInFocusTree,
    getNodeDepth,
  }
} 