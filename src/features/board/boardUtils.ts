import { v4 as uuidv4 } from 'uuid'
import type { BoardNode, BoardEdge } from './boardTypes'

export function createNode(
  labelOrNode: string | Omit<BoardNode, 'id'>,
  position?: { x: number; y: number },
  options: Partial<BoardNode['data']> = {}
): Omit<BoardNode, 'id'> {
  // If first parameter is a complete node object, return it as-is
  if (typeof labelOrNode === 'object') {
    return labelOrNode
  }

  // Otherwise, create a new node from label and options
  return {
    type: options.type === 'document' ? 'document' : 'default',
    position: position!,
    dragHandle: '.nodal-drag-handle',
    data: {
      label: labelOrNode,
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

// Utility to build a consistent document context for AI features
export function getDocumentContext(nodes: BoardNode[]) {
  return nodes
    .filter(node => node.data.type === 'document' && node.data.documentId)
    .map(node => ({
      id: node.data.documentId!,
      label: node.data.label,
      fileName: node.data.fileName,
      fileType: node.data.fileType,
      fileSize: node.data.fileSize,
      uploadedAt: node.data.uploadedAt,
      status: node.data.status || 'processing',
      snippet: node.data.extractedText ? node.data.extractedText.slice(0, 200) : '',
    }))
} 

// Backward compatibility: Original findNonOverlappingPositions function
export function findNonOverlappingPositions(
  center: { x: number; y: number },
  count: number,
  existingNodes: { x: number; y: number }[],
  nodeSize = 180,
  minSpacing = 40
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = []
  
  // Determine the center point for positioning
  let centerPoint: { x: number; y: number }
  
  if (center) {
    // Use provided center
    centerPoint = center
  } else {
    // Default center
    centerPoint = { x: 400, y: 300 }
  }

  // For multiple nodes, use intelligent spreading
  if (count === 1) {
    // Single node - place near center with slight offset
    const angle = Math.random() * 2 * Math.PI
    const radius = minSpacing * 0.3
    const pos = {
      x: centerPoint.x + Math.cos(angle) * radius,
      y: centerPoint.y + Math.sin(angle) * radius
    }
    positions.push(pos)
  } else if (count <= 4) {
    // Small batch - use cross pattern around center
    const angles = [0, Math.PI/2, Math.PI, 3*Math.PI/2].slice(0, count)
    for (let i = 0; i < count; i++) {
      const pos = {
        x: centerPoint.x + Math.cos(angles[i]) * minSpacing * 0.6,
        y: centerPoint.y + Math.sin(angles[i]) * minSpacing * 0.6
      }
      positions.push(pos)
    }
  } else if (count <= 8) {
    // Medium batch - use circular pattern
    const angleStep = (2 * Math.PI) / count
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep
      const pos = {
        x: centerPoint.x + Math.cos(angle) * minSpacing * 0.8,
        y: centerPoint.y + Math.sin(angle) * minSpacing * 0.8
      }
      positions.push(pos)
    }
  } else {
    // Large batch - use spiral pattern
    const spiralStep = minSpacing * 0.4
    for (let i = 0; i < count; i++) {
      const angle = i * 0.5
      const radius = spiralStep * (1 + Math.floor(i / 6))
      const pos = {
        x: centerPoint.x + Math.cos(angle) * radius,
        y: centerPoint.y + Math.sin(angle) * radius
      }
      positions.push(pos)
    }
  }

  return positions
} 