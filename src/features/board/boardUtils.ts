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
  return {
    source,
    target,
    type: 'default',
    data: {
      type: 'default',
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