import type { BoardNode } from './boardTypes'
import type { 
  Position, 
  NodeToPlace, 
  NodePlacement, 
  PlacementContext,
  FanLayoutOptions,
  GridLayoutOptions,
  RadialLayoutOptions,
  LinearLayoutOptions,
  SpiralLayoutOptions,
  ClusterLayoutOptions,
  LayoutQualityMetrics
} from './placementTypes'
import { 
  estimateNodeDimensions, 
  findAvailablePosition,
  calculateDistance,
  analyzeSpatialRegions
} from './spatialAnalysis'

// ===============================
// FAN LAYOUT - Perfect for AI Generation
// ===============================

/**
 * Fan Layout - Arranges nodes in an intelligent arc around a focus point
 * This is the crown jewel for AI-generated nodes from a parent
 */
export function calculateFanLayout(
  nodesToPlace: NodeToPlace[],
  context: PlacementContext,
  options: Partial<FanLayoutOptions> = {}
): NodePlacement[] {
  const {
    radius = 300,
    angleSpan = Math.PI * 1.2, // 216 degrees - wide enough for good spacing
    angleCenter = -Math.PI / 2, // Downward by default
    minDistance = 30,
    maxDistance = 800,
    verticalOffset = 120,
    adaptiveRadius = true,
    preventOverlap = true
  } = options
  
  // Find focus node (selected node or context focus)
  const focusNode = context.focusNode || context.existingNodes.find(
    node => context.selectedNodeIds.includes(node.id)
  )
  
  if (!focusNode) {
    // Fallback to grid layout if no focus node
    return calculateGridLayout(nodesToPlace, context)
  }
  
  const placements: NodePlacement[] = []
  const focusPosition = focusNode.position
  
  // Calculate optimal radius based on node content if adaptive
  let finalRadius = radius
  if (adaptiveRadius) {
    finalRadius = calculateOptimalFanRadius(nodesToPlace, angleSpan, radius)
  }
  
  if (nodesToPlace.length === 1) {
    // Single node - place directly below focus with smart positioning
    return placeSingleNodeInFan(nodesToPlace[0], focusNode, context, finalRadius, verticalOffset, minDistance, maxDistance)
  }
  
  // Multiple nodes - create intelligent fan arrangement
  return placeMultipleNodesInFan(nodesToPlace, focusNode, context, finalRadius, angleSpan, angleCenter, verticalOffset, minDistance, maxDistance, preventOverlap)
}

/**
 * Places a single node in fan layout with intelligent positioning
 */
function placeSingleNodeInFan(
  nodeToPlace: NodeToPlace,
  focusNode: BoardNode,
  context: PlacementContext,
  radius: number,
  verticalOffset: number,
  minDistance: number,
  maxDistance: number
): NodePlacement[] {
  const focusPosition = focusNode.position
  
  // Try multiple positions in order of preference
  const candidatePositions = [
    { x: focusPosition.x, y: focusPosition.y + radius + verticalOffset }, // Directly below
    { x: focusPosition.x - radius * 0.3, y: focusPosition.y + radius + verticalOffset }, // Slightly left
    { x: focusPosition.x + radius * 0.3, y: focusPosition.y + radius + verticalOffset }, // Slightly right
    { x: focusPosition.x, y: focusPosition.y + radius + verticalOffset * 1.5 }, // Further below
  ]
  
  const dimensions = estimateNodeDimensions(nodeToPlace.title, nodeToPlace.content, nodeToPlace.type)
  
  for (const position of candidatePositions) {
    const finalPosition = findAvailablePosition(
      position,
      dimensions,
      context.existingNodes,
      { minDistance, maxSearchRadius: maxDistance, searchStep: 40, preferredDirection: 'down' }
    )
    
    return [{
      node: createNodeFromToPlace(nodeToPlace),
      position: finalPosition,
      reason: `Single fan placement below focus node "${focusNode.data.title}"`,
      confidence: 0.9
    }]
  }
  
  // Fallback
  return [{
    node: createNodeFromToPlace(nodeToPlace),
    position: { x: focusPosition.x, y: focusPosition.y + radius + verticalOffset },
    reason: 'Fallback single fan placement',
    confidence: 0.5
  }]
}

/**
 * Places multiple nodes in an intelligent fan arrangement
 */
function placeMultipleNodesInFan(
  nodesToPlace: NodeToPlace[],
  focusNode: BoardNode,
  context: PlacementContext,
  radius: number,
  angleSpan: number,
  angleCenter: number,
  verticalOffset: number,
  minDistance: number,
  maxDistance: number,
  preventOverlap: boolean
): NodePlacement[] {
  const placements: NodePlacement[] = []
  const focusPosition = focusNode.position
  
  // Calculate angle step
  const angleStep = nodeToPlace.length > 1 ? angleSpan / (nodesToPlace.length - 1) : 0
  const startAngle = angleCenter - angleSpan / 2
  
  // Sort nodes by priority if specified
  const sortedNodes = [...nodesToPlace].sort((a, b) => (b.priority || 0) - (a.priority || 0))
  
  sortedNodes.forEach((nodeToPlace, index) => {
    const angle = startAngle + angleStep * index
    
    // Calculate base position
    const baseX = focusPosition.x + Math.cos(angle) * radius
    const baseY = focusPosition.y + Math.sin(angle) * radius + verticalOffset
    
    // Add aesthetic vertical staggering (creates a more natural arc)
    const relativeIndex = Math.abs(index - (sortedNodes.length - 1) / 2)
    const staggerY = relativeIndex * 15 * Math.sin(angle) // Subtle curve effect
    
    const basePosition = { x: baseX, y: baseY + staggerY }
    
    const dimensions = estimateNodeDimensions(nodeToPlace.title, nodeToPlace.content, nodeToPlace.type)
    
    let finalPosition = basePosition
    if (preventOverlap) {
      finalPosition = findAvailablePosition(
        basePosition,
        dimensions,
        context.existingNodes,
        { 
          minDistance, 
          maxSearchRadius: Math.min(maxDistance, radius * 0.5), 
          searchStep: 25,
          preferredDirection: 'radial'
        }
      )
    }
    
    const confidence = calculatePlacementConfidence(finalPosition, basePosition, context.existingNodes)
    
    placements.push({
      node: createNodeFromToPlace(nodeToPlace),
      position: finalPosition,
      reason: `Fan layout position ${index + 1}/${sortedNodes.length} around focus node "${focusNode.data.title}"`,
      confidence
    })
  })
  
  return placements
}

/**
 * Calculates optimal radius for fan layout based on node content
 */
function calculateOptimalFanRadius(
  nodesToPlace: NodeToPlace[],
  angleSpan: number,
  baseRadius: number
): number {
  if (nodesToPlace.length <= 1) return baseRadius
  
  const angleStep = angleSpan / (nodesToPlace.length - 1)
  const halfAngle = Math.max(0.01, angleStep / 2)
  const sinHalf = Math.sin(halfAngle)
  
  let maxRequiredRadius = baseRadius
  
  for (const node of nodesToPlace) {
    const dimensions = estimateNodeDimensions(node.title, node.content, node.type)
    const requiredRadius = (dimensions.width + 40) / (2 * sinHalf) // 40px padding
    maxRequiredRadius = Math.max(maxRequiredRadius, requiredRadius)
  }
  
  // Apply reasonable bounds
  return Math.max(200, Math.min(800, maxRequiredRadius))
}

// ===============================
// GRID LAYOUT - Perfect for Board Creation
// ===============================

/**
 * Grid Layout - Arranges nodes in a structured grid pattern
 * Excellent for initial board creation and organized layouts
 */
export function calculateGridLayout(
  nodesToPlace: NodeToPlace[],
  context: PlacementContext,
  options: Partial<GridLayoutOptions> = {}
): NodePlacement[] {
  const {
    columns = Math.ceil(Math.sqrt(nodesToPlace.length)),
    cellWidth = 300,
    cellHeight = 200,
    padding = 60,
    alignment = 'center',
    fillDirection = 'row'
  } = options
  
  const rows = Math.ceil(nodesToPlace.length / columns)
  const placements: NodePlacement[] = []
  
  // Calculate grid dimensions and starting position
  const totalWidth = columns * cellWidth + (columns - 1) * padding
  const totalHeight = rows * cellHeight + (rows - 1) * padding
  const centerPosition = getCenterPosition(context)
  
  let startX = centerPosition.x - totalWidth / 2
  let startY = centerPosition.y - totalHeight / 2
  
  // Adjust start position based on alignment
  if (alignment === 'start') {
    startX = centerPosition.x - totalWidth / 4
    startY = centerPosition.y - totalHeight / 4
  } else if (alignment === 'end') {
    startX = centerPosition.x + totalWidth / 4
    startY = centerPosition.y + totalHeight / 4
  }
  
  // Sort nodes by priority
  const sortedNodes = [...nodesToPlace].sort((a, b) => (b.priority || 0) - (a.priority || 0))
  
  sortedNodes.forEach((nodeToPlace, index) => {
    let row: number, col: number
    
    if (fillDirection === 'column') {
      col = Math.floor(index / rows)
      row = index % rows
    } else {
      row = Math.floor(index / columns)
      col = index % columns
    }
    
    const basePosition = {
      x: startX + col * (cellWidth + padding) + cellWidth / 2,
      y: startY + row * (cellHeight + padding) + cellHeight / 2
    }
    
    const dimensions = estimateNodeDimensions(nodeToPlace.title, nodeToPlace.content, nodeToPlace.type)
    
    // Fine-tune position to avoid overlaps
    const finalPosition = findAvailablePosition(
      basePosition,
      dimensions,
      context.existingNodes,
      { minDistance: 20, maxSearchRadius: 100, searchStep: 30, preferredDirection: 'radial' }
    )
    
    const confidence = calculatePlacementConfidence(finalPosition, basePosition, context.existingNodes)
    
    placements.push({
      node: createNodeFromToPlace(nodeToPlace),
      position: finalPosition,
      reason: `Grid layout position (${row + 1}, ${col + 1})`,
      confidence
    })
  })
  
  return placements
}

// ===============================
// RADIAL LAYOUT - Perfect for Hierarchies
// ===============================

/**
 * Radial Layout - Arranges nodes in concentric circles
 * Perfect for hierarchical organization and reorganization
 */
export function calculateRadialLayout(
  nodesToPlace: NodeToPlace[],
  context: PlacementContext,
  options: Partial<RadialLayoutOptions> = {}
): NodePlacement[] {
  const {
    innerRadius = 200,
    outerRadius = 600,
    layers = Math.max(1, Math.ceil(Math.sqrt(nodesToPlace.length / 3))),
    angleOffset = 0,
    clockwise = true
  } = options
  
  const placements: NodePlacement[] = []
  const centerPosition = getCenterPosition(context)
  
  // Distribute nodes across layers
  const nodesPerLayer = Math.ceil(nodesToPlace.length / layers)
  const radiusStep = layers > 1 ? (outerRadius - innerRadius) / (layers - 1) : 0
  
  // Sort nodes by priority and relationships
  const sortedNodes = [...nodesToPlace].sort((a, b) => {
    // Prioritize nodes with relationships to center
    const aHasRelation = a.relationships && a.relationships.length > 0
    const bHasRelation = b.relationships && b.relationships.length > 0
    if (aHasRelation && !bHasRelation) return -1
    if (!aHasRelation && bHasRelation) return 1
    return (b.priority || 0) - (a.priority || 0)
  })
  
  sortedNodes.forEach((nodeToPlace, index) => {
    const layer = Math.floor(index / nodesPerLayer)
    const indexInLayer = index % nodesPerLayer
    const currentRadius = innerRadius + layer * radiusStep
    
    // Calculate angle
    const totalInLayer = Math.min(nodesPerLayer, nodesToPlace.length - layer * nodesPerLayer)
    const angleStep = (2 * Math.PI) / Math.max(1, totalInLayer)
    const baseAngle = angleStep * indexInLayer + angleOffset
    const angle = clockwise ? baseAngle : -baseAngle
    
    const basePosition = {
      x: centerPosition.x + Math.cos(angle) * currentRadius,
      y: centerPosition.y + Math.sin(angle) * currentRadius
    }
    
    const dimensions = estimateNodeDimensions(nodeToPlace.title, nodeToPlace.content, nodeToPlace.type)
    
    const finalPosition = findAvailablePosition(
      basePosition,
      dimensions,
      context.existingNodes,
      { minDistance: 25, maxSearchRadius: 80, searchStep: 20, preferredDirection: 'radial' }
    )
    
    const confidence = calculatePlacementConfidence(finalPosition, basePosition, context.existingNodes)
    
    placements.push({
      node: createNodeFromToPlace(nodeToPlace),
      position: finalPosition,
      reason: `Radial layout layer ${layer + 1}, position ${indexInLayer + 1}`,
      confidence
    })
  })
  
  return placements
}

// ===============================
// LINEAR LAYOUT - Perfect for Sequences
// ===============================

/**
 * Linear Layout - Arranges nodes in a line
 * Great for sequential content, timelines, or process flows
 */
export function calculateLinearLayout(
  nodesToPlace: NodeToPlace[],
  context: PlacementContext,
  options: Partial<LinearLayoutOptions> = {}
): NodePlacement[] {
  const {
    direction = 'horizontal',
    spacing = 250,
    alignment = 'center',
    curve = 0 // 0 = straight line, > 0 = curved
  } = options
  
  const placements: NodePlacement[] = []
  const centerPosition = getCenterPosition(context)
  
  // Calculate total length and starting position
  const totalLength = (nodesToPlace.length - 1) * spacing
  let startPosition: Position
  
  switch (alignment) {
    case 'start':
      startPosition = centerPosition
      break
    case 'end':
      startPosition = direction === 'horizontal'
        ? { x: centerPosition.x - totalLength, y: centerPosition.y }
        : { x: centerPosition.x, y: centerPosition.y - totalLength }
      break
    default: // center
      startPosition = direction === 'horizontal'
        ? { x: centerPosition.x - totalLength / 2, y: centerPosition.y }
        : { x: centerPosition.x, y: centerPosition.y - totalLength / 2 }
  }
  
  // Sort nodes by priority
  const sortedNodes = [...nodesToPlace].sort((a, b) => (b.priority || 0) - (a.priority || 0))
  
  sortedNodes.forEach((nodeToPlace, index) => {
    let basePosition: Position
    
    if (direction === 'horizontal') {
      const x = startPosition.x + index * spacing
      const y = startPosition.y + (curve > 0 ? Math.sin((index / (nodesToPlace.length - 1)) * Math.PI) * curve : 0)
      basePosition = { x, y }
    } else if (direction === 'vertical') {
      const x = startPosition.x + (curve > 0 ? Math.sin((index / (nodesToPlace.length - 1)) * Math.PI) * curve : 0)
      const y = startPosition.y + index * spacing
      basePosition = { x, y }
    } else { // diagonal
      const progress = index / Math.max(1, nodesToPlace.length - 1)
      basePosition = {
        x: startPosition.x + progress * totalLength * 0.707, // cos(45°)
        y: startPosition.y + progress * totalLength * 0.707  // sin(45°)
      }
    }
    
    const dimensions = estimateNodeDimensions(nodeToPlace.title, nodeToPlace.content, nodeToPlace.type)
    
    const finalPosition = findAvailablePosition(
      basePosition,
      dimensions,
      context.existingNodes,
      { minDistance: 20, maxSearchRadius: 100, searchStep: 25, preferredDirection: direction === 'horizontal' ? 'up' : 'right' }
    )
    
    const confidence = calculatePlacementConfidence(finalPosition, basePosition, context.existingNodes)
    
    placements.push({
      node: createNodeFromToPlace(nodeToPlace),
      position: finalPosition,
      reason: `Linear ${direction} layout position ${index + 1}`,
      confidence
    })
  })
  
  return placements
}

// ===============================
// SPIRAL LAYOUT - Perfect for Organic Growth
// ===============================

/**
 * Spiral Layout - Arranges nodes in a spiral pattern
 * Great for organic, natural-looking layouts
 */
export function calculateSpiralLayout(
  nodesToPlace: NodeToPlace[],
  context: PlacementContext,
  options: Partial<SpiralLayoutOptions> = {}
): NodePlacement[] {
  const centerPosition = getCenterPosition(context)
  const {
    centerPosition: customCenter = centerPosition,
    initialRadius = 100,
    radiusGrowth = 30,
    angleStep = 0.8, // radians per step
    clockwise = true
  } = options
  
  const placements: NodePlacement[] = []
  
  // Sort nodes by priority
  const sortedNodes = [...nodesToPlace].sort((a, b) => (b.priority || 0) - (a.priority || 0))
  
  sortedNodes.forEach((nodeToPlace, index) => {
    const radius = initialRadius + index * radiusGrowth
    const angle = (clockwise ? 1 : -1) * index * angleStep
    
    const basePosition = {
      x: customCenter.x + Math.cos(angle) * radius,
      y: customCenter.y + Math.sin(angle) * radius
    }
    
    const dimensions = estimateNodeDimensions(nodeToPlace.title, nodeToPlace.content, nodeToPlace.type)
    
    const finalPosition = findAvailablePosition(
      basePosition,
      dimensions,
      context.existingNodes,
      { minDistance: 25, maxSearchRadius: 60, searchStep: 20, preferredDirection: 'radial' }
    )
    
    const confidence = calculatePlacementConfidence(finalPosition, basePosition, context.existingNodes)
    
    placements.push({
      node: createNodeFromToPlace(nodeToPlace),
      position: finalPosition,
      reason: `Spiral layout position ${index + 1}`,
      confidence
    })
  })
  
  return placements
}

// ===============================
// HELPER FUNCTIONS
// ===============================

/**
 * Gets the center position for layouts based on context
 */
function getCenterPosition(context: PlacementContext): Position {
  // Priority: focus node > selected node > viewport center
  if (context.focusNode) {
    return context.focusNode.position
  }
  
  if (context.selectedNodeIds.length > 0) {
    const selectedNode = context.existingNodes.find(node => 
      context.selectedNodeIds.includes(node.id)
    )
    if (selectedNode) {
      return selectedNode.position
    }
  }
  
  // Use actual viewport center - convert screen center to flow coordinates
  // The viewport x,y are offsets (pan position), not screen coordinates
  // We need to convert the screen center to flow coordinates
  return {
    x: -context.viewport.x / context.viewport.zoom + (context.viewport.width / 2) / context.viewport.zoom,
    y: -context.viewport.y / context.viewport.zoom + (context.viewport.height / 2) / context.viewport.zoom
  }
}

/**
 * Creates a BoardNode from a NodeToPlace
 */
function createNodeFromToPlace(nodeToPlace: NodeToPlace): BoardNode {
  return {
    id: nodeToPlace.id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: nodeToPlace.type || 'default',
    position: { x: 0, y: 0 }, // Will be set by placement
    dragHandle: '.nodal-drag-handle',
    data: {
      title: nodeToPlace.title,
      content: nodeToPlace.content,
      type: nodeToPlace.type || 'default',
      expanded: false,
      aiGenerated: true,
      media: [],
      ...nodeToPlace.data
    }
  }
}

/**
 * Calculates confidence score for a placement
 */
function calculatePlacementConfidence(
  finalPosition: Position,
  targetPosition: Position,
  existingNodes: BoardNode[]
): number {
  let confidence = 1.0
  
  // Reduce confidence based on distance from target
  const distance = calculateDistance(finalPosition, targetPosition)
  confidence -= Math.min(0.5, distance / 500) // Max penalty of 0.5
  
  // Reduce confidence based on nearby node density
  const nearbyNodes = existingNodes.filter(node => 
    calculateDistance(finalPosition, node.position) < 200
  ).length
  confidence -= Math.min(0.3, nearbyNodes * 0.1) // Max penalty of 0.3
  
  return Math.max(0.1, confidence) // Minimum confidence of 0.1
}

/**
 * Calculates quality metrics for a layout
 */
export function calculateLayoutQuality(placements: NodePlacement[]): LayoutQualityMetrics {
  if (placements.length === 0) {
    return {
      overlapScore: 1,
      distributionScore: 1,
      readabilityScore: 1,
      aestheticScore: 1,
      overallScore: 1
    }
  }
  
  // Calculate overlap score (0 = many overlaps, 1 = no overlaps)
  let overlapCount = 0
  for (let i = 0; i < placements.length; i++) {
    for (let j = i + 1; j < placements.length; j++) {
      const distance = calculateDistance(placements[i].position, placements[j].position)
      if (distance < 150) overlapCount++ // Consider nodes too close as overlapping
    }
  }
  const overlapScore = Math.max(0, 1 - (overlapCount / Math.max(1, placements.length)))
  
  // Calculate distribution score (how evenly distributed the nodes are)
  const positions = placements.map(p => p.position)
  const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length
  const centerY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length
  const avgDistanceFromCenter = positions.reduce((sum, p) => 
    sum + calculateDistance(p, { x: centerX, y: centerY }), 0
  ) / positions.length
  const distributionScore = Math.min(1, avgDistanceFromCenter / 300) // Normalize to 0-1
  
  // Calculate readability score (based on spacing and alignment)
  const avgDistance = positions.reduce((sum, p1, i) => {
    const otherPositions = positions.slice(i + 1)
    const minDistance = Math.min(...otherPositions.map(p2 => calculateDistance(p1, p2)))
    return sum + (isFinite(minDistance) ? minDistance : 200)
  }, 0) / Math.max(1, positions.length - 1)
  const readabilityScore = Math.min(1, avgDistance / 200) // Ideal spacing around 200px
  
  // Calculate aesthetic score (based on overall arrangement harmony)
  const avgConfidence = placements.reduce((sum, p) => sum + p.confidence, 0) / placements.length
  const aestheticScore = avgConfidence
  
  // Calculate overall score (weighted average)
  const overallScore = (
    overlapScore * 0.3 +
    distributionScore * 0.25 +
    readabilityScore * 0.25 +
    aestheticScore * 0.2
  )
  
  return {
    overlapScore,
    distributionScore,
    readabilityScore,
    aestheticScore,
    overallScore
  }
}
