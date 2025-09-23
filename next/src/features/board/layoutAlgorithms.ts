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
    angleCenter = Math.PI / 2, // Downward by default (screen y increases downward)
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
  const angleStep = nodesToPlace.length > 1 ? angleSpan / (nodesToPlace.length - 1) : 0
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
    
    // Prefer measured node size when available on existing nodes; for new nodes we estimate
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
  // If parent/child relationships are present (or a focus parent exists),
  // use a hierarchical tiered grid: each depth is a row, siblings grouped under their parent.
  const hasHierarchy =
    nodesToPlace.some(n => !!n.parentId) || !!context.focusNode
  if (hasHierarchy) {
    return calculateHierarchicalGridLayout(nodesToPlace, context, options)
  }

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

/**
 * Hierarchical Grid Layout
 * - Tier 1 is the parent (focus node or roots). Each tier is a row below the previous.
 * - Multiple families in the same row sit side-by-side in the order of parents in the row above.
 */
function calculateHierarchicalGridLayout(
  nodesToPlace: NodeToPlace[],
  context: PlacementContext,
  options: Partial<GridLayoutOptions> = {}
): NodePlacement[] {
  const {
    cellWidth = 300,
    cellHeight = 200,
    padding = 60
  } = options

  const placements: NodePlacement[] = []
  const center = getCenterPosition(context)

  // Stable ids for building tiers
  const idOf = (node: NodeToPlace, index: number) => node.id || `temp-${index}`
  const idMap = new Map<string, NodeToPlace>()
  const nodeIds: string[] = []
  nodesToPlace.forEach((n, i) => {
    const nid = idOf(n, i)
    idMap.set(nid, n)
    nodeIds.push(nid)
  })
  const idSet = new Set(nodeIds)

  // Group children by parentId
  const childrenByParent = new Map<string, string[]>()
  nodesToPlace.forEach((n, i) => {
    if (!n.parentId) return
    const list = childrenByParent.get(n.parentId) || []
    list.push(idOf(n, i))
    childrenByParent.set(n.parentId, list)
  })

  // Compute degree from existing edges among these nodes (source/target both present)
  const degree = new Map<string, number>()
  nodeIds.forEach(id => degree.set(id, 0))
  ;(context.existingEdges || []).forEach((edge: any) => {
    const s = typeof edge?.source === 'string' ? edge.source : undefined
    const t = typeof edge?.target === 'string' ? edge.target : undefined
    if (s && t && idSet.has(s) && idSet.has(t)) {
      degree.set(s, (degree.get(s) || 0) + 1)
      degree.set(t, (degree.get(t) || 0) + 1)
    }
  })
  const parentKeys = new Set<string>(Array.from(childrenByParent.keys()))
  const singletonIds = nodeIds.filter(id => {
    const node = idMap.get(id)
    const deg = degree.get(id) || 0
    const hasParent = !!node?.parentId
    const isParent = parentKeys.has(id)
    // Single nodes: no edges, no parent, not a parent
    return deg === 0 && !hasParent && !isParent
  })

  // Build tiered order: start from tier1 parents
  const tierIds: string[][] = [] // excludes singletons
  const tierParentOrder: string[][] = [] // mirrors tierIds but keeps parent grouping

  // Tier 1: if focus exists, it is the only parent id (may not be placed). Otherwise, roots among nodesToPlace without parentId
  if (context.focusNode) {
    tierIds.push([]) // no nodes placed at tier 1 if focus isn't in nodesToPlace
    tierParentOrder.push([context.focusNode.id])
  } else {
    const roots: string[] = []
    nodesToPlace.forEach((n, i) => {
      const nid = idOf(n, i)
      if (singletonIds.includes(nid)) return
      if (!n.parentId || !idMap.has(n.parentId)) {
        roots.push(nid)
      }
    })
    tierIds.push(roots)
    // Each root acts as its own parent reference for ordering
    tierParentOrder.push(roots)
  }

  // Build subsequent tiers until no more children
  // For each parent in previous tierParentOrder, append its children (in the order they appear in nodesToPlace)
  while (true) {
    const prevParents = tierParentOrder[tierParentOrder.length - 1]
    const nextTier: string[] = []
    const nextParents: string[] = []

    prevParents.forEach(parentId => {
      const children = childrenByParent.get(parentId) || []
      const filteredChildren = children.filter(id => !singletonIds.includes(id))
      if (filteredChildren.length > 0) {
        // Maintain grouping by parent; order within children as given
        nextTier.push(...filteredChildren)
        nextParents.push(...filteredChildren) // children themselves become parents for the next tier
      }
    })

    if (nextTier.length === 0) break
    tierIds.push(nextTier)
    tierParentOrder.push(nextParents)
  }

  // Compute vertical positions (rows). If focus exists, start under it; else center around viewport center.
  const baseY = context.focusNode ? context.focusNode.position.y : center.y
  const rowY = (rowIndex: number) =>
    context.focusNode
      ? baseY + rowIndex * (cellHeight + padding) // tier 2 is first placed row when focus exists
      : baseY - ((tierIds.length - 1) * (cellHeight + padding)) / 2 + rowIndex * (cellHeight + padding)

  // For each tier, place nodes in groups side-by-side according to parent order from previous tier
  const rowWidths: number[] = []
  for (let t = 0; t < tierIds.length; t++) {
    const idsInTier = tierIds[t]
    if (idsInTier.length === 0) continue

    // Build groups by parent order
    const prevParents = t > 0 ? tierParentOrder[t - 1] : tierParentOrder[0]
    const groups: string[][] = []
    const parentToChildren = new Map<string, string[]>()
    prevParents.forEach(pid => parentToChildren.set(pid, []))
    // Assign each id in tier to its parent bucket
    idsInTier.forEach(id => {
      const node = idMap.get(id)
      const parentId = node?.parentId || 'root'
      if (!parentToChildren.has(parentId)) parentToChildren.set(parentId, [])
      parentToChildren.get(parentId)!.push(id)
    })
    prevParents.forEach(pid => {
      const arr = parentToChildren.get(pid)
      if (arr && arr.length > 0) groups.push(arr)
    })
    // If no matching parents (e.g., roots when no focus), treat entire tier as one group
    if (groups.length === 0) {
      // For top tier roots, separate each root into its own family block for better visual separation
      if (t === 0 && idsInTier.length > 0) {
        idsInTier.forEach(id => groups.push([id]))
      } else {
        groups.push(idsInTier)
      }
    }

    // Compute total width accounting for intra-group padding and inter-group gap
    const blockGap = padding * 2
    const groupWidths = groups.map(g => (g.length * cellWidth) + Math.max(0, g.length - 1) * padding)
    const totalWidth = groupWidths.reduce((sum, w) => sum + w, 0) + Math.max(0, groups.length - 1) * blockGap
    rowWidths.push(totalWidth)
    let cursorX = center.x - totalWidth / 2
    const y = rowY(t)

    // Place nodes group by group with block spacing
    groups.forEach((group, gi) => {
      const gWidth = groupWidths[gi]
      // group starts at cursorX, ends at cursorX + gWidth
      const gx = cursorX
      group.forEach((id, idx) => {
        const nodeToPlace = idMap.get(id)
        const baseX = gx + idx * (cellWidth + padding) + cellWidth / 2
        if (nodeToPlace) {
          const basePosition = { x: baseX, y }
          const dimensions = estimateNodeDimensions(nodeToPlace.title, nodeToPlace.content, nodeToPlace.type)
          const finalPosition = findAvailablePosition(
            basePosition,
            dimensions,
            context.existingNodes,
            { minDistance: 20, maxSearchRadius: 100, searchStep: 30, preferredDirection: 'right' }
          )
          // Lock Y to row to keep rows perfectly aligned
          const lockedPosition = { x: finalPosition.x, y }
          const confidence = calculatePlacementConfidence(lockedPosition, basePosition, context.existingNodes)
          placements.push({
            node: createNodeFromToPlace(nodeToPlace),
            position: lockedPosition,
            reason: `Hierarchical grid tier ${t + 1}`,
            confidence
          })
        }
      })
      // advance cursor by group width + block gap
      cursorX += gWidth + blockGap
    })
  }

  // Place singleton nodes (no edges, no parent/children) to the right in their own grid
  if (singletonIds.length > 0) {
    // Determine base starting X: to the right of the widest grouped row
    const groupedExists = rowWidths.length > 0
    const widest = groupedExists ? Math.max(...rowWidths) : 0
    const gap = padding * 2
    const xStart = groupedExists
      ? center.x + widest / 2 + gap + cellWidth / 2
      : center.x + gap + cellWidth / 2
    const yStart = groupedExists ? rowY(0) : center.y - cellHeight / 2

    // Group singleton nodes by type in desired order (normalize aliases)
    const typeOrder = ['nodal', 'task', 'document', 'image']
    const buckets: Record<string, string[]> = {}
    singletonIds.forEach(id => {
      const n = idMap.get(id)
      const raw = (n?.type || (n as any)?.data?.type || 'nodal') as string
      let key = String(raw).toLowerCase()
      if (key === 'default' || key === 'nodal' || key === 'note' || key === 'idea') key = 'nodal'
      else if (key === 'doc' || key === 'documentnode' || key === 'pdf' || key === 'document') key = 'document'
      else if (key === 'img' || key === 'imagenode' || key === 'image') key = 'image'
      if (!buckets[key]) buckets[key] = []
      buckets[key].push(id)
    })
    const orderedTypes = [...typeOrder, ...Object.keys(buckets).filter(t => !typeOrder.includes(t))]
      .filter(t => (buckets[t] && buckets[t].length > 0))

    // Place each type bucket as a vertical column. If a bucket has many nodes, it simply grows downward.
    let typeColIndex = 0
    for (const t of orderedTypes) {
      const ids = buckets[t]
      if (!ids || ids.length === 0) continue
      const x = xStart + typeColIndex * (cellWidth + padding)
      for (let r = 0; r < ids.length; r++) {
        const id = ids[r]
        const nodeToPlace = idMap.get(id)
        if (!nodeToPlace) continue
        const y = yStart + r * (cellHeight + padding)
        const basePosition = { x, y }
        const dimensions = estimateNodeDimensions(nodeToPlace.title, nodeToPlace.content, nodeToPlace.type)
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
          reason: `Singleton ${t} column placement`,
          confidence
        })
      }
      typeColIndex++
    }
  }

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
