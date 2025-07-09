import { useCallback } from 'react'
import { useBoardStore } from './boardSlice'
import { createNode, createEdge } from './boardUtils'
import type { BoardNode, BoardEdge } from './boardTypes'

export function useBoard() {
  const {
    nodes,
    edges,
    selectedNodeId,
    viewport,
    addNode,
    updateNode,
    deleteNode,
    addEdge,
    deleteEdge,
    setSelectedNode,
    updateViewport,
    clearBoard,
  } = useBoardStore()

  const handleAddNode = useCallback(
    (label: string, position: { x: number; y: number }) => {
      const newNode = createNode(label, position)
      addNode(newNode)
    },
    [addNode]
  )

  const handleUpdateNode = useCallback(
    (id: string, updates: Partial<BoardNode>) => {
      updateNode(id, updates)
    },
    [updateNode]
  )

  const handleDeleteNode = useCallback(
    (id: string) => {
      deleteNode(id)
      if (selectedNodeId === id) {
        setSelectedNode(null)
      }
    },
    [deleteNode, selectedNodeId, setSelectedNode]
  )

  const handleAddEdge = useCallback(
    (source: string, target: string) => {
      const newEdge = createEdge(source, target)
      addEdge(newEdge)
    },
    [addEdge]
  )

  const handleDeleteEdge = useCallback(
    (id: string) => {
      deleteEdge(id)
    },
    [deleteEdge]
  )

  const handleNodeSelect = useCallback(
    (id: string | null) => {
      setSelectedNode(id)
    },
    [setSelectedNode]
  )

  const handleViewportChange = useCallback(
    (newViewport: Partial<typeof viewport>) => {
      updateViewport(newViewport)
    },
    [updateViewport]
  )

  const selectedNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId)
    : null

  return {
    // State
    nodes,
    edges,
    selectedNode,
    selectedNodeId,
    viewport,
    
    // Actions
    addNode: handleAddNode,
    updateNode: handleUpdateNode,
    deleteNode: handleDeleteNode,
    addEdge: handleAddEdge,
    deleteEdge: handleDeleteEdge,
    selectNode: handleNodeSelect,
    updateViewport: handleViewportChange,
    clearBoard,
    
    // Computed
    hasNodes: nodes.length > 0,
    hasEdges: edges.length > 0,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  }
} 