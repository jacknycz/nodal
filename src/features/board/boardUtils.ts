import { v4 as uuidv4 } from 'uuid'
import type { BoardNode, BoardEdge } from './boardTypes'

export function createNode(
  label: string,
  position: { x: number; y: number },
  options: Partial<BoardNode['data']> = {}
): Omit<BoardNode, 'id'> {
  return {
    type: 'default',
    position,
    dragHandle: '.nodal-drag-handle',
    data: {
      label,
      type: 'default',
      expanded: false,
      aiGenerated: false,
      ...options,
    },
  }
}

export function createEdge(
  source: string,
  target: string,
  options: Partial<BoardEdge['data']> = {}
): Omit<BoardEdge, 'id'> {
  const connectionType = options.type || 'default'
  
  return {
    source,
    target,
    type: 'floating', // Always use floating for React Flow edge type (Easy Connect)
    animated: connectionType === 'ai', // Animate AI connections
    style: getEdgeStyle(connectionType), // Style based on connection type
    data: {
      type: connectionType, // Store our internal type in data
      ...options,
    },
  }
}

export function getNodeById(nodes: BoardNode[], id: string): BoardNode | undefined {
  return nodes.find((node) => node.id === id)
}

export function getConnectedNodes(
  nodes: BoardNode[],
  edges: BoardEdge[],
  nodeId: string
): BoardNode[] {
  const connectedNodeIds = edges
    .filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .map((edge) => (edge.source === nodeId ? edge.target : edge.source))

  return nodes.filter((node) => connectedNodeIds.includes(node.id))
}

export function getNodeDepth(
  nodes: BoardNode[],
  edges: BoardEdge[],
  nodeId: string,
  visited: Set<string> = new Set()
): number {
  if (visited.has(nodeId)) return 0
  visited.add(nodeId)

  const incomingEdges = edges.filter((edge) => edge.target === nodeId)
  if (incomingEdges.length === 0) return 0

  const maxDepth = Math.max(
    ...incomingEdges.map((edge) =>
      getNodeDepth(nodes, edges, edge.source, new Set(visited))
    )
  )

  return maxDepth + 1
}

export function validateNode(node: BoardNode): boolean {
  return !!(
    node.id &&
    node.position &&
    node.data?.label &&
    typeof node.position.x === 'number' &&
    typeof node.position.y === 'number'
  )
}

export function validateEdge(edge: BoardEdge): boolean {
  return !!(
    edge.id &&
    edge.source &&
    edge.target &&
    edge.source !== edge.target
  )
}

// Enhanced connection utilities
export function connectionExists(
  edges: BoardEdge[],
  source: string,
  target: string
): boolean {
  return edges.some(
    (edge) =>
      (edge.source === source && edge.target === target)
  )
}

export function canCreateConnection(
  edges: BoardEdge[],
  source: string,
  target: string
): { valid: boolean; reason?: string } {
  if (source === target) {
    return { valid: false, reason: 'Cannot connect a node to itself' }
  }

  if (connectionExists(edges, source, target)) {
    return { valid: false, reason: 'Connection already exists' }
  }

  return { valid: true }
}

export function getConnectionType(
  sourceNode: BoardNode,
  targetNode: BoardNode
): 'default' | 'ai' | 'focus' {
  // AI-generated connections
  if (sourceNode.data.aiGenerated || targetNode.data.aiGenerated) {
    return 'ai'
  }

  // Default connection type
  return 'default'
}

export function getEdgeStyle(edgeType: string) {
  switch (edgeType) {
    case 'ai':
      return {
        stroke: '#3b82f6',
        strokeWidth: 2,
        strokeDasharray: '5,5',
      }
    case 'focus':
      return {
        stroke: '#10b981',
        strokeWidth: 3,
      }
    default:
      return {
        stroke: '#6b7280',
        strokeWidth: 2,
      }
  }
} 