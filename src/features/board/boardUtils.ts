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

// Enhanced positioning utility for intelligent node placement
export interface PositioningContext {
  parentNode?: { x: number; y: number; id: string }
  relatedNodes?: Array<{ x: number; y: number; id: string }>
  existingNodes: Array<{ x: number; y: number; id?: string }>
  viewportCenter?: { x: number; y: number }
  direction?: 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest'
  spacing?: number
  nodeSize?: number
  minSpacing?: number
}

// Calculate intelligent positions for batch node creation
export function calculateIntelligentPositions(
  count: number,
  context: PositioningContext
): { x: number; y: number }[] {
  const {
    parentNode,
    relatedNodes = [],
    existingNodes,
    viewportCenter,
    direction,
    spacing = 250,
    nodeSize = 180,
    minSpacing = 40
  } = context

  const positions: { x: number; y: number }[] = []
  
  // Determine the center point for positioning
  let centerPoint: { x: number; y: number }
  
  if (parentNode) {
    // Use parent node as center
    centerPoint = { x: parentNode.x, y: parentNode.y }
  } else if (relatedNodes.length > 0) {
    // Use average position of related nodes
    const avgX = relatedNodes.reduce((sum, node) => sum + node.x, 0) / relatedNodes.length
    const avgY = relatedNodes.reduce((sum, node) => sum + node.y, 0) / relatedNodes.length
    centerPoint = { x: avgX, y: avgY }
  } else if (viewportCenter) {
    // Fallback to viewport center
    centerPoint = viewportCenter
  } else {
    // Default center
    centerPoint = { x: 400, y: 300 }
  }

  // If we have a specific direction, use directional placement
  if (direction && count === 1) {
    const angle = getDirectionAngle(direction)
    const pos = {
      x: centerPoint.x + Math.cos(angle) * spacing,
      y: centerPoint.y + Math.sin(angle) * spacing
    }
    positions.push(avoidOverlap(pos, existingNodes, nodeSize, minSpacing))
    return positions
  }

  // For multiple nodes, use intelligent spreading
  if (count === 1) {
    // Single node - place near center with slight offset
    const angle = Math.random() * 2 * Math.PI
    const radius = spacing * 0.3
    const pos = {
      x: centerPoint.x + Math.cos(angle) * radius,
      y: centerPoint.y + Math.sin(angle) * radius
    }
    positions.push(avoidOverlap(pos, existingNodes, nodeSize, minSpacing))
  } else if (count <= 4) {
    // Small batch - use cross pattern around center
    const angles = [0, Math.PI/2, Math.PI, 3*Math.PI/2].slice(0, count)
    for (let i = 0; i < count; i++) {
      const pos = {
        x: centerPoint.x + Math.cos(angles[i]) * spacing * 0.6,
        y: centerPoint.y + Math.sin(angles[i]) * spacing * 0.6
      }
      positions.push(avoidOverlap(pos, existingNodes, nodeSize, minSpacing))
    }
  } else if (count <= 8) {
    // Medium batch - use circular pattern
    const angleStep = (2 * Math.PI) / count
    for (let i = 0; i < count; i++) {
      const angle = i * angleStep
      const pos = {
        x: centerPoint.x + Math.cos(angle) * spacing * 0.8,
        y: centerPoint.y + Math.sin(angle) * spacing * 0.8
      }
      positions.push(avoidOverlap(pos, existingNodes, nodeSize, minSpacing))
    }
  } else {
    // Large batch - use spiral pattern
    const spiralStep = spacing * 0.4
    for (let i = 0; i < count; i++) {
      const angle = i * 0.5
      const radius = spiralStep * (1 + Math.floor(i / 6))
      const pos = {
        x: centerPoint.x + Math.cos(angle) * radius,
        y: centerPoint.y + Math.sin(angle) * radius
      }
      positions.push(avoidOverlap(pos, existingNodes, nodeSize, minSpacing))
    }
  }

  return positions
}

// Helper function to get angle for directional placement
function getDirectionAngle(direction: string): number {
  switch (direction) {
    case 'north': return -Math.PI/2
    case 'south': return Math.PI/2
    case 'east': return 0
    case 'west': return Math.PI
    case 'northeast': return -Math.PI/4
    case 'northwest': return -3*Math.PI/4
    case 'southeast': return Math.PI/4
    case 'southwest': return 3*Math.PI/4
    default: return 0
  }
}

// Helper function to avoid overlap with existing nodes
function avoidOverlap(
  position: { x: number; y: number },
  existingNodes: Array<{ x: number; y: number; id?: string }>,
  nodeSize: number,
  minSpacing: number,
  maxTries: number = 20
): { x: number; y: number } {
  let pos = { ...position }
  let tries = 0
  
  while (
    existingNodes.some(
      node => Math.abs(node.x - pos.x) < nodeSize && Math.abs(node.y - pos.y) < nodeSize
    ) && tries < maxTries
  ) {
    // Try different offsets
    const angle = (tries * Math.PI / 6) % (2 * Math.PI)
    const radius = minSpacing + (tries * 10)
    pos = {
      x: position.x + Math.cos(angle) * radius,
      y: position.y + Math.sin(angle) * radius
    }
    tries++
  }
  
  return pos
}

// Enhanced version of findNonOverlappingPositions that uses intelligent positioning
export function findIntelligentPositions(
  count: number,
  context: {
    parentNode?: { x: number; y: number; id: string }
    relatedNodes?: Array<{ x: number; y: number; id: string }>
    existingNodes: Array<{ x: number; y: number; id?: string }>
    viewportCenter?: { x: number; y: number }
    direction?: 'north' | 'south' | 'east' | 'west' | 'northeast' | 'northwest' | 'southeast' | 'southwest'
    spacing?: number
    nodeSize?: number
    minSpacing?: number
  }
): { x: number; y: number }[] {
  return calculateIntelligentPositions(count, context)
}

// Backward compatibility: Original findNonOverlappingPositions function
export function findNonOverlappingPositions(
  center: { x: number; y: number },
  count: number,
  existingNodes: { x: number; y: number }[],
  nodeSize = 180,
  minSpacing = 40
): { x: number; y: number }[] {
  return calculateIntelligentPositions(count, {
    existingNodes,
    viewportCenter: center,
    nodeSize,
    minSpacing
  })
} 