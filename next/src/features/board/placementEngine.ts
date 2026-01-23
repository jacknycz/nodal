import type {
  PlacementRequest,
  PlacementResult,
  NodeToPlace,
  NodePlacement,
  EdgePlacement,
  PlacementContext,
  PlacementConstraints,
  LayoutOptions,
  PlacementMetadata,
  LayoutQualityMetrics
} from './placementTypes'
import {
  PlacementStrategy,
  LayoutAlgorithm
} from './placementTypes'
import type { BoardEdge } from './boardTypes'
import { useBoardStore } from './boardSlice'
import { mapEdgePrefToRfType } from './boardUtils'
import {
  calculateGridLayout,
  calculateFanLayout,
  calculateElkHierarchyLayout,
  calculateLayoutQuality
} from './layoutAlgorithms'
import {
  analyzeSpatialRegions,
  findBestPlacementRegion
} from './spatialAnalysis'

// ===============================
// PLACEMENT ENGINE - The Brain
// ===============================

/**
 * The central placement engine that orchestrates all node placement
 * This is the main entry point for all placement operations
 */
export class PlacementEngine {
  private static instance: PlacementEngine
  
  private constructor() {}
  
  public static getInstance(): PlacementEngine {
    if (!PlacementEngine.instance) {
      PlacementEngine.instance = new PlacementEngine()
    }
    return PlacementEngine.instance
  }
  
  /**
   * Main placement method - analyzes context and places nodes intelligently
   */
  public async placeNodes(request: PlacementRequest): Promise<PlacementResult> {
    const startTime = performance.now()
    
    try {
      // Validate request
      const validationResult = this.validateRequest(request)
      if (!validationResult.isValid) {
        try {
          console.warn('[placement] invalid request', {
            errors: validationResult.errors,
            nodeCount: request.nodes?.length || 0,
            hasContext: !!request.context,
            hasViewport: !!request.context?.viewport,
            focusNodeId: request.context?.focusNode?.id,
            selectedCount: request.context?.selectedNodeIds?.length || 0,
          })
        } catch {}
        return this.createErrorResult(validationResult.errors, startTime)
      }
      
      // Enhance context with spatial analysis
      const enhancedContext = await this.enhanceContext(request.context)
      
      // Determine optimal algorithm if not specified
      const algorithm = request.algorithm || this.determineOptimalAlgorithm(request, enhancedContext)
      
      // Apply constraints and preferences
      const constrainedRequest = this.applyConstraints(request, enhancedContext)
      
      // Execute placement algorithm
      const placements = await this.executePlacementAlgorithm(
        algorithm,
        constrainedRequest.nodes,
        enhancedContext,
        constrainedRequest.options
      )
      
      // Generate connections if needed
      const connections = this.generateConnections(placements, constrainedRequest)
      
      // Calculate quality metrics
      const qualityMetrics = calculateLayoutQuality(placements)
      
      // Create metadata
      const metadata = this.createMetadata(
        algorithm,
        request.strategy,
        placements,
        qualityMetrics,
        startTime
      )
      
      // Post-process and optimize
      const optimizedPlacements = this.optimizePlacements(placements, enhancedContext)
      
      return {
        placements: optimizedPlacements,
        connections,
        metadata,
        success: true,
        warnings: this.generateWarnings(optimizedPlacements, qualityMetrics)
      }
      
    } catch (error) {
      try {
        console.error('[placement] exception', error)
      } catch {}
      return this.createErrorResult([`Placement failed: ${error.message}`], startTime)
    }
  }
  
  /**
   * Validates the placement request
   */
  private validateRequest(request: PlacementRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!request.nodes || request.nodes.length === 0) {
      errors.push('No nodes to place')
    }
    
    if (!request.context) {
      errors.push('Missing placement context')
    }
    
    if (!request.strategy) {
      errors.push('Missing placement strategy')
    }
    
    // Validate individual nodes
    request.nodes.forEach((node, index) => {
      if (!node.title || node.title.trim() === '') {
        errors.push(`Node ${index + 1} missing title`)
      }
    })
    
    // Validate context
    if (request.context && !request.context.viewport) {
      errors.push('Missing viewport information in context')
    }
    
    return {
      isValid: errors.length === 0,
      errors
    }
  }
  
  /**
   * Enhances context with spatial analysis and recommendations
   */
  private async enhanceContext(context: PlacementContext): Promise<PlacementContext> {
    // Analyze spatial regions
    const spaceAnalysis = analyzeSpatialRegions(context)
    
    // Find best placement region
    const bestRegion = findBestPlacementRegion(
      spaceAnalysis.regions,
      context.focusNode?.position
    )
    
    // Enhance constraints based on analysis
    const enhancedConstraints: PlacementConstraints = {
      minDistance: 30,
      avoidOverlap: true,
      preferredDirection: spaceAnalysis.recommendedDirection,
      ...context.constraints
    }
    
    // Set available space based on best region
    const availableSpace = bestRegion ? bestRegion.bounds : undefined
    
    return {
      ...context,
      constraints: enhancedConstraints,
      availableSpace
    }
  }
  
  /**
   * Determines the optimal algorithm based on strategy and context
   */
  private determineOptimalAlgorithm(
    request: PlacementRequest,
    context: PlacementContext
  ): LayoutAlgorithm {
    // Force GRID everywhere for now
    return LayoutAlgorithm.GRID
  }
  
  /**
   * Smart algorithm selection based on context analysis
   */
  private selectSmartAlgorithm(nodes: NodeToPlace[], context: PlacementContext): LayoutAlgorithm {
    const nodeCount = nodes.length
    const hasParent = context.focusNode || context.selectedNodeIds.length > 0
    const boardDensity = context.existingNodes.length / (context.viewport.width * context.viewport.height / 100000)
    
    // Parent relationship -> Fan layout
    if (hasParent && nodeCount <= 8) {
      return LayoutAlgorithm.FAN
    }
    
    // High density board -> Compact layouts
    if (boardDensity > 0.5) {
      return nodeCount <= 4 ? LayoutAlgorithm.LINEAR : LayoutAlgorithm.GRID
    }
    
    // Low density board -> Spacious layouts
    if (boardDensity < 0.2) {
      return nodeCount <= 6 ? LayoutAlgorithm.RADIAL : LayoutAlgorithm.SPIRAL
    }
    
    // Default selection by node count
    if (nodeCount === 1) return LayoutAlgorithm.FAN
    if (nodeCount <= 4) return LayoutAlgorithm.LINEAR
    if (nodeCount <= 9) return LayoutAlgorithm.GRID
    return LayoutAlgorithm.RADIAL
  }
  
  /**
   * Applies constraints and user preferences to the request
   */
  private applyConstraints(
    request: PlacementRequest,
    context: PlacementContext
  ): PlacementRequest {
    // Apply spacing preferences
    const userPrefs = context.userPreferences
    let minDistance = context.constraints?.minDistance || 30
    
    if (userPrefs?.preferredSpacing) {
      switch (userPrefs.preferredSpacing) {
        case 'tight': minDistance *= 0.7; break
        case 'loose': minDistance *= 1.5; break
        default: break // normal
      }
    }
    
    // Update constraints
    const enhancedConstraints: PlacementConstraints = {
      ...context.constraints,
      minDistance
    }
    
    return {
      ...request,
      context: {
        ...context,
        constraints: enhancedConstraints
      }
    }
  }
  
  /**
   * Executes the specified placement algorithm
   */
  private async executePlacementAlgorithm(
    algorithm: LayoutAlgorithm,
    nodes: NodeToPlace[],
    context: PlacementContext,
    options?: Partial<LayoutOptions>
  ): Promise<NodePlacement[]> {
    const alg = algorithm === LayoutAlgorithm.SMART_AUTO
      ? (context.focusNode || nodes.some(n => !!n.parentId) ? LayoutAlgorithm.FAN : LayoutAlgorithm.GRID)
      : algorithm

    switch (alg) {
      case LayoutAlgorithm.FAN:
        return calculateFanLayout(nodes, context, options as any)
      case LayoutAlgorithm.HIERARCHY:
        return calculateElkHierarchyLayout(nodes, context, options as any)
      case LayoutAlgorithm.GRID:
      default:
        return calculateGridLayout(nodes, context, options as any)
    }
  }
  
  /**
   * Generates connections between nodes based on relationships
   */
  private generateConnections(
    placements: NodePlacement[],
    request: PlacementRequest
  ): EdgePlacement[] {
    const connections: EdgePlacement[] = []
    const context = request.context
    
    // Create connections to parent/focus node
    if (context.focusNode) {
      placements.forEach(placement => {
        const pref = useBoardStore.getState().edgeType || 'floating'
        const edgeType = mapEdgePrefToRfType(pref) as any
        const edge: BoardEdge = {
          id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          source: context.focusNode!.id,
          target: placement.node.id,
          type: edgeType,
          data: {
            type: 'ai',
            label: undefined
          }
        }
        
        connections.push({
          edge,
          reason: `Connection from focus node "${context.focusNode.data.title}" to generated node`
        })
      })
    }
    
    // Create connections based on node relationships
    placements.forEach(placement => {
      const nodeToPlace = request.nodes.find(n => 
        n.title === placement.node.data.title
      )
      
      if (nodeToPlace?.relationships) {
        nodeToPlace.relationships.forEach(relatedId => {
          const relatedPlacement = placements.find(p => p.node.id === relatedId)
          if (relatedPlacement) {
            const pref2 = useBoardStore.getState().edgeType || 'floating'
            const edgeType = mapEdgePrefToRfType(pref2) as any
            const edge: BoardEdge = {
              id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              source: placement.node.id,
              target: relatedPlacement.node.id,
              type: edgeType,
              data: {
                type: 'default',
                label: undefined
              }
            }
            
            connections.push({
              edge,
              reason: 'Connection based on node relationship'
            })
          }
        })
      }
    })
    
    return connections
  }
  
  /**
   * Creates metadata for the placement result
   */
  private createMetadata(
    algorithm: LayoutAlgorithm,
    strategy: PlacementStrategy,
    placements: NodePlacement[],
    qualityMetrics: LayoutQualityMetrics,
    startTime: number
  ): PlacementMetadata {
    const executionTime = performance.now() - startTime
    
    // Calculate bounds
    const bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    }
    
    placements.forEach(placement => {
      bounds.minX = Math.min(bounds.minX, placement.position.x - 100)
      bounds.minY = Math.min(bounds.minY, placement.position.y - 50)
      bounds.maxX = Math.max(bounds.maxX, placement.position.x + 100)
      bounds.maxY = Math.max(bounds.maxY, placement.position.y + 50)
    })
    
    // Count collisions avoided
    const collisionsAvoided = placements.reduce((count, placement) => {
      return count + (placement.confidence < 0.8 ? 1 : 0)
    }, 0)
    
    return {
      algorithm,
      strategy,
      totalNodes: placements.length,
      collisionsAvoided,
      executionTime,
      bounds,
      qualityScore: qualityMetrics.overallScore
    }
  }
  
  /**
   * Optimizes placements for better visual appeal
   */
  private optimizePlacements(
    placements: NodePlacement[],
    context: PlacementContext
  ): NodePlacement[] {
    // Apply grid snapping if enabled
    if (context.constraints?.gridSnap) {
      const gridSize = context.constraints.gridSnap
      return placements.map(placement => ({
        ...placement,
        position: {
          x: Math.round(placement.position.x / gridSize) * gridSize,
          y: Math.round(placement.position.y / gridSize) * gridSize
        }
      }))
    }
    
    return placements
  }
  
  /**
   * Generates warnings for the placement result
   */
  private generateWarnings(
    placements: NodePlacement[],
    qualityMetrics: LayoutQualityMetrics
  ): string[] {
    const warnings: string[] = []
    
    if (qualityMetrics.overlapScore < 0.7) {
      warnings.push('Some nodes may be too close together')
    }
    
    if (qualityMetrics.distributionScore < 0.5) {
      warnings.push('Node distribution could be improved')
    }
    
    const lowConfidencePlacements = placements.filter(p => p.confidence < 0.6)
    if (lowConfidencePlacements.length > 0) {
      warnings.push(`${lowConfidencePlacements.length} nodes placed with low confidence`)
    }
    
    if (qualityMetrics.overallScore < 0.6) {
      warnings.push('Overall placement quality is below optimal')
    }
    
    return warnings
  }
  
  /**
   * Creates an error result
   */
  private createErrorResult(errors: string[], startTime: number): PlacementResult {
    return {
      placements: [],
      connections: [],
      metadata: {
        algorithm: LayoutAlgorithm.GRID,
        strategy: PlacementStrategy.SMART_AUTO,
        totalNodes: 0,
        collisionsAvoided: 0,
        executionTime: performance.now() - startTime,
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        qualityScore: 0
      },
      success: false,
      warnings: errors
    }
  }
}

// ===============================
// CONVENIENCE FUNCTIONS
// ===============================

/**
 * Quick placement function for common use cases
 */
export async function placeNodes(request: PlacementRequest): Promise<PlacementResult> {
  const engine = PlacementEngine.getInstance()
  return engine.placeNodes(request)
}

/**
 * Quick AI generation placement
 */
export async function placeAIGeneratedNodes(
  nodes: NodeToPlace[],
  context: PlacementContext,
  parentNodeId?: string
): Promise<PlacementResult> {
  // Set focus node if parent specified
  let enhancedContext = context
  if (parentNodeId) {
    const focusNode = context.existingNodes.find(node => node.id === parentNodeId)
    if (focusNode) {
      enhancedContext = { ...context, focusNode }
    }
  }
  
  return placeNodes({
    nodes,
    context: enhancedContext,
    strategy: PlacementStrategy.AI_GENERATION,
    // Use ELK layered hierarchy for tree/level layouts.
    algorithm: LayoutAlgorithm.HIERARCHY
  })
}

/**
 * Quick board creation placement
 */
export async function placeBoardCreationNodes(
  nodes: NodeToPlace[],
  context: PlacementContext
): Promise<PlacementResult> {
  return placeNodes({
    nodes,
    context,
    strategy: PlacementStrategy.BOARD_CREATION,
    algorithm: LayoutAlgorithm.HIERARCHY
  })
}

/**
 * Quick reorganize placement
 */
export async function reorganizeBoard(
  nodes: NodeToPlace[],
  context: PlacementContext,
  algorithm: LayoutAlgorithm
): Promise<PlacementResult> {
  return placeNodes({
    nodes,
    context,
    strategy: PlacementStrategy.REORGANIZE,
    algorithm
  })
}
