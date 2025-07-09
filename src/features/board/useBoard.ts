import { useCallback } from 'react'
import { applyNodeChanges, applyEdgeChanges } from '@xyflow/react'
import { useBoardStore } from './boardSlice'
import { createNode, createEdge, canCreateConnection } from './boardUtils'
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
    setNodes,
    addEdge,
    deleteEdge,
    setEdges,
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
    (source: string, target: string, options: Partial<BoardEdge['data']> = {}) => {
      console.log('handleAddEdge called with:', { source, target, options })
      
      // Validate connection
      const validation = canCreateConnection(edges, source, target)
      if (!validation.valid) {
        console.warn('Connection rejected:', validation.reason)
        return false
      }

      const newEdge = createEdge(source, target, options)
      console.log('Created edge:', newEdge)
      
      addEdge(newEdge)
      console.log('Added edge to store')
      return true
    },
    [edges, addEdge]
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

  // React Flow change handlers
  const onNodesChange = useCallback(
    (changes: any) => {
      setNodes(applyNodeChanges(changes, nodes))
    },
    [nodes, setNodes]
  )

  const onEdgesChange = useCallback(
    (changes: any) => {
      setEdges(applyEdgeChanges(changes, edges))
    },
    [edges, setEdges]
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
    
    // React Flow handlers
    onNodesChange,
    onEdgesChange,
    
    // Computed
    hasNodes: nodes.length > 0,
    hasEdges: edges.length > 0,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  }
} 