import type { BoardNode } from './boardTypes'
import type { 
  Position, 
  Bounds, 
  NodeDimensions, 
  SpatialRegion, 
  CollisionInfo,
  PlacementContext,
  SpaceAnalysis
} from './placementTypes'

// ===============================
// NODE DIMENSION ESTIMATION
// ===============================

/**
 * Estimates node dimensions based on content length and type
 * Uses intelligent sizing based on title and content analysis
 */
export function estimateNodeDimensions(
  title: string, 
  content?: string,
  nodeType: string = 'default'
): NodeDimensions {
  // Base dimensions by node type
  const baseDimensions = {
    default: { width: 160, height: 80 },
    document: { width: 200, height: 120 },
    input: { width: 140, height: 60 },
    output: { width: 140, height: 60 }
  }
  
  const base = baseDimensions[nodeType as keyof typeof baseDimensions] || baseDimensions.default
  const minWidth = base.width
  const minHeight = base.height
  const maxWidth = 400
  const maxHeight = 300
  
  // Title-based width calculation
  const titleChars = title.length
  const avgCharWidth = 8 // pixels per character
  const titlePadding = 40 // left + right padding
  const titleWidth = Math.max(minWidth, Math.min(maxWidth, titleChars * avgCharWidth + titlePadding))
  
  // Content-based height calculation
  let contentHeight = minHeight
  if (content && content.trim()) {
    // Count lines and estimate height
    const lines = content.split('\n')
    const totalChars = content.length
    const lineHeight = 20
    const basePadding = 60 // top + bottom padding
    
    // Estimate height based on lines and character density
    const estimatedLines = Math.max(lines.length, Math.ceil(totalChars / 50))
    contentHeight = Math.max(minHeight, Math.min(maxHeight, 
      basePadding + (estimatedLines * lineHeight)
    ))
  }
  
  return {
    width: Math.ceil(titleWidth),
    height: Math.ceil(contentHeight)
  }
}

/**
 * Gets the bounding box of a node at a given position
 */
export function getNodeBounds(
  position: Position, 
  dimensions: NodeDimensions,
  padding: number = 0
): Bounds {
  const halfWidth = (dimensions.width + padding) / 2
  const halfHeight = (dimensions.height + padding) / 2
  
  return {
    minX: position.x - halfWidth,
    minY: position.y - halfHeight,
    maxX: position.x + halfWidth,
    maxY: position.y + halfHeight
  }
}

/**
 * Calculates the distance between two positions
 */
export function calculateDistance(pos1: Position, pos2: Position): number {
  return Math.hypot(pos2.x - pos1.x, pos2.y - pos1.y)
}

/**
 * Calculates the center point of given bounds
 */
export function getBoundsCenter(bounds: Bounds): Position {
  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2
  }
}

// ===============================
// COLLISION DETECTION
// ===============================

/**
 * Checks if two bounding boxes overlap
 */
export function boundsOverlap(bounds1: Bounds, bounds2: Bounds): boolean {
  return !(
    bounds1.maxX < bounds2.minX ||
    bounds1.minX > bounds2.maxX ||
    bounds1.maxY < bounds2.minY ||
    bounds1.minY > bounds2.maxY
  )
}

/**
 * Advanced collision detection with severity assessment
 */
export function checkCollision(
  position: Position,
  dimensions: NodeDimensions,
  existingNodes: BoardNode[],
  excludeNodeIds: string[] = [],
  minDistance: number = 20
): CollisionInfo {
  const bounds = getNodeBounds(position, dimensions, minDistance)
  const collidingNodes: string[] = []
  let maxSeverity: CollisionInfo['severity'] = 'none'
  
  for (const node of existingNodes) {
    if (excludeNodeIds.includes(node.id)) continue
    
    // Prefer XYFlow's measured dimensions when available
    const nodeDimensions = (node as any).width && (node as any).height
      ? { width: (node as any).width as number, height: (node as any).height as number }
      : estimateNodeDimensions(
          node.data.title || 'Node',
          node.data.content,
          node.data.type
        )
    const nodeBounds = getNodeBounds(node.position, nodeDimensions)
    
    if (boundsOverlap(bounds, nodeBounds)) {
      collidingNodes.push(node.id)
      
      // Calculate collision severity
      const overlapArea = calculateOverlapArea(bounds, nodeBounds)
      const nodeArea = nodeDimensions.width * nodeDimensions.height
      const overlapRatio = overlapArea / nodeArea
      
      let severity: CollisionInfo['severity'] = 'minor'
      if (overlapRatio > 0.7) severity = 'blocking'
      else if (overlapRatio > 0.3) severity = 'major'
      
      if (severity === 'blocking' || (severity === 'major' && maxSeverity !== 'blocking')) {
        maxSeverity = severity
      }
    }
  }
  
  return {
    hasCollision: collidingNodes.length > 0,
    collidingNodes,
    severity: maxSeverity
  }
}

/**
 * Calculates the area of overlap between two bounds
 */
function calculateOverlapArea(bounds1: Bounds, bounds2: Bounds): number {
  const overlapWidth = Math.max(0, Math.min(bounds1.maxX, bounds2.maxX) - Math.max(bounds1.minX, bounds2.minX))
  const overlapHeight = Math.max(0, Math.min(bounds1.maxY, bounds2.maxY) - Math.max(bounds1.minY, bounds2.minY))
  return overlapWidth * overlapHeight
}

// ===============================
// INTELLIGENT SPACE FINDING
// ===============================

/**
 * Finds the best available position near a target using intelligent search
 */
export function findAvailablePosition(
  targetPosition: Position,
  dimensions: NodeDimensions,
  existingNodes: BoardNode[],
  constraints: {
    minDistance: number
    maxSearchRadius: number
    searchStep: number
    preferredDirection?: 'up' | 'down' | 'left' | 'right' | 'radial'
  }
): Position {
  const { minDistance, maxSearchRadius, searchStep, preferredDirection = 'radial' } = constraints
  
  // First try the exact target position
  const collision = checkCollision(targetPosition, dimensions, existingNodes, [], minDistance)
  if (!collision.hasCollision) {
    return targetPosition
  }
  
  // Use different search patterns based on preferred direction
  let searchPositions: Position[] = []
  
  switch (preferredDirection) {
    case 'up':
      searchPositions = generateDirectionalPositions(targetPosition, maxSearchRadius, searchStep, 'up')
      break
    case 'down':
      searchPositions = generateDirectionalPositions(targetPosition, maxSearchRadius, searchStep, 'down')
      break
    case 'left':
      searchPositions = generateDirectionalPositions(targetPosition, maxSearchRadius, searchStep, 'left')
      break
    case 'right':
      searchPositions = generateDirectionalPositions(targetPosition, maxSearchRadius, searchStep, 'right')
      break
    default:
      searchPositions = generateSpiralPositions(targetPosition, maxSearchRadius, searchStep)
  }
  
  // Score each position and return the best one
  let bestPosition = targetPosition
  let bestScore = -1
  
  for (const position of searchPositions) {
    const collision = checkCollision(position, dimensions, existingNodes, [], minDistance)
    if (!collision.hasCollision) {
      const score = scorePosition(position, targetPosition, existingNodes)
      if (score > bestScore) {
        bestScore = score
        bestPosition = position
      }
    }
  }
  
  return bestPosition
}

/**
 * Generates search positions in a specific direction
 */
function generateDirectionalPositions(
  center: Position,
  maxDistance: number,
  step: number,
  direction: 'up' | 'down' | 'left' | 'right'
): Position[] {
  const positions: Position[] = []
  
  for (let distance = step; distance <= maxDistance; distance += step) {
    // Primary direction
    switch (direction) {
      case 'up':
        positions.push({ x: center.x, y: center.y - distance })
        break
      case 'down':
        positions.push({ x: center.x, y: center.y + distance })
        break
      case 'left':
        positions.push({ x: center.x - distance, y: center.y })
        break
      case 'right':
        positions.push({ x: center.x + distance, y: center.y })
        break
    }
    
    // Add some perpendicular positions for better coverage
    const perpDistance = distance * 0.5
    if (direction === 'up' || direction === 'down') {
      positions.push({ x: center.x - perpDistance, y: center.y + (direction === 'up' ? -distance : distance) })
      positions.push({ x: center.x + perpDistance, y: center.y + (direction === 'up' ? -distance : distance) })
    } else {
      positions.push({ x: center.x + (direction === 'left' ? -distance : distance), y: center.y - perpDistance })
      positions.push({ x: center.x + (direction === 'left' ? -distance : distance), y: center.y + perpDistance })
    }
  }
  
  return positions
}

/**
 * Generates positions in a spiral pattern around a center point
 */
function generateSpiralPositions(
  center: Position, 
  maxRadius: number, 
  step: number
): Position[] {
  const positions: Position[] = []
  let radius = step
  
  while (radius <= maxRadius) {
    const circumference = 2 * Math.PI * radius
    const numPoints = Math.max(8, Math.floor(circumference / step))
    
    for (let i = 0; i < numPoints; i++) {
      const angle = (2 * Math.PI * i) / numPoints
      positions.push({
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius
      })
    }
    
    radius += step
  }
  
  return positions
}

/**
 * Scores a position based on various factors
 */
function scorePosition(
  position: Position,
  targetPosition: Position,
  existingNodes: BoardNode[]
): number {
  let score = 100
  
  // Penalty for distance from target
  const distance = calculateDistance(position, targetPosition)
  score -= distance * 0.1
  
  // Bonus for being in less crowded areas
  const nearbyNodes = existingNodes.filter(node => 
    calculateDistance(position, node.position) < 200
  ).length
  score -= nearbyNodes * 10
  
  // Bonus for aesthetic positioning (avoid exact alignments)
  const alignmentPenalty = calculateAlignmentPenalty(position, existingNodes)
  score -= alignmentPenalty
  
  return Math.max(0, score)
}

/**
 * Calculates penalty for positions that create awkward alignments
 */
function calculateAlignmentPenalty(position: Position, existingNodes: BoardNode[]): number {
  let penalty = 0
  const threshold = 5 // pixels
  
  for (const node of existingNodes) {
    // Penalty for exact horizontal alignment
    if (Math.abs(position.y - node.position.y) < threshold) {
      penalty += 5
    }
    
    // Penalty for exact vertical alignment
    if (Math.abs(position.x - node.position.x) < threshold) {
      penalty += 5
    }
  }
  
  return penalty
}

// ===============================
// SPATIAL REGION ANALYSIS
// ===============================

/**
 * Analyzes the spatial distribution of nodes on the board
 */
export function analyzeSpatialRegions(
  context: PlacementContext,
  regionSize: number = 400
): SpaceAnalysis {
  const { existingNodes, viewport } = context
  const regions: SpatialRegion[] = []
  
  // Define analysis area (larger than viewport for better context)
  const analysisWidth = viewport.width * 2
  const analysisHeight = viewport.height * 2
  const startX = viewport.x - analysisWidth / 2
  const startY = viewport.y - analysisHeight / 2
  
  const cols = Math.ceil(analysisWidth / regionSize)
  const rows = Math.ceil(analysisHeight / regionSize)
  
  // Analyze each region
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = startX + col * regionSize
      const y = startY + row * regionSize
      
      const bounds: Bounds = {
        minX: x,
        minY: y,
        maxX: x + regionSize,
        maxY: y + regionSize
      }
      
      const region = analyzeRegion(bounds, existingNodes, viewport)
      regions.push(region)
    }
  }
  
  // Find the best region for placement
  const bestRegion = findBestPlacementRegion(regions, context.focusNode?.position)
  
  // Calculate overall congestion
  const totalNodes = existingNodes.length
  const totalArea = analysisWidth * analysisHeight
  const congestionLevel = Math.min(1, (totalNodes * 40000) / totalArea) // Assume average node area of 40000px²
  
  // Recommend direction based on space analysis
  const recommendedDirection = determineRecommendedDirection(regions, context.focusNode?.position)
  
  return {
    regions,
    bestRegion,
    congestionLevel,
    recommendedDirection
  }
}

/**
 * Analyzes a specific spatial region
 */
function analyzeRegion(bounds: Bounds, existingNodes: BoardNode[], viewport: any): SpatialRegion {
  // Find nodes in this region
  const nodesInRegion = existingNodes.filter(node => 
    node.position.x >= bounds.minX &&
    node.position.x <= bounds.maxX &&
    node.position.y >= bounds.minY &&
    node.position.y <= bounds.maxY
  )
  
  const regionArea = (bounds.maxX - bounds.minX) * (bounds.maxY - bounds.minY)
  const density = nodesInRegion.length / regionArea
  
  // Calculate center of mass
  let centerX = (bounds.minX + bounds.maxX) / 2
  let centerY = (bounds.minY + bounds.maxY) / 2
  
  if (nodesInRegion.length > 0) {
    centerX = nodesInRegion.reduce((sum, node) => sum + node.position.x, 0) / nodesInRegion.length
    centerY = nodesInRegion.reduce((sum, node) => sum + node.position.y, 0) / nodesInRegion.length
  }
  
  // Calculate quality score
  let quality = 1 - Math.min(1, density * 1000000) // Lower density = higher quality
  
  // Bonus for being in viewport
  const regionCenter = { x: centerX, y: centerY }
  const viewportCenter = { 
    x: viewport.x + viewport.width / 2, 
    y: viewport.y + viewport.height / 2 
  }
  const distanceFromViewport = calculateDistance(regionCenter, viewportCenter)
  const viewportBonus = Math.max(0, 1 - (distanceFromViewport / (viewport.width + viewport.height)))
  quality = (quality + viewportBonus) / 2
  
  return {
    bounds,
    density,
    centerOfMass: { x: centerX, y: centerY },
    isEmpty: nodesInRegion.length === 0,
    quality
  }
}

/**
 * Finds the best region for placing new nodes
 */
export function findBestPlacementRegion(
  regions: SpatialRegion[],
  focusPosition?: Position
): SpatialRegion | null {
  if (regions.length === 0) return null
  
  let scoredRegions = regions.map(region => ({
    region,
    score: region.quality
  }))
  
  // If we have a focus position, prefer regions near it
  if (focusPosition) {
    scoredRegions = scoredRegions.map(({ region, score }) => {
      const distance = calculateDistance(region.centerOfMass, focusPosition)
      const proximityBonus = Math.max(0, 1 - distance / 1000) // Bonus decreases with distance
      return {
        region,
        score: score + proximityBonus * 0.5 // Weight proximity at 50%
      }
    })
  }
  
  // Sort by score and return the best
  scoredRegions.sort((a, b) => b.score - a.score)
  return scoredRegions[0]?.region || null
}

/**
 * Determines the recommended direction for new node placement
 */
function determineRecommendedDirection(
  regions: SpatialRegion[],
  focusPosition?: Position
): 'up' | 'down' | 'left' | 'right' | 'radial' {
  if (!focusPosition || regions.length === 0) return 'radial'
  
  // Analyze space in each direction from focus point
  const directions = {
    up: 0,
    down: 0,
    left: 0,
    right: 0
  }
  
  for (const region of regions) {
    const center = region.centerOfMass
    const dx = center.x - focusPosition.x
    const dy = center.y - focusPosition.y
    
    // Determine primary direction
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) directions.right += region.quality
      else directions.left += region.quality
    } else {
      if (dy > 0) directions.down += region.quality
      else directions.up += region.quality
    }
  }
  
  // Return direction with highest quality score
  const bestDirection = Object.entries(directions).reduce((a, b) => 
    directions[a[0] as keyof typeof directions] > directions[b[0] as keyof typeof directions] ? a : b
  )[0] as keyof typeof directions
  
  return bestDirection
}
