'use client'

import { useCallback, useMemo } from 'react'
import { useReactFlow } from '@xyflow/react'
import type { BoardNode } from './boardTypes'
import type {
  NodeToPlace,
  PlacementRequest,
  PlacementResult,
  PlacementContext,
  PlacementConstraints
} from './placementTypes'
import {
  PlacementStrategy,
  LayoutAlgorithm
} from './placementTypes'
import {
  placeNodes,
  placeAIGeneratedNodes,
  placeBoardCreationNodes,
  reorganizeBoard
} from './placementEngine'
import { useBoardStore } from './boardSlice'

/**
 * Main hook for using the placement system
 * Provides easy-to-use functions for all placement scenarios
 */
export function usePlacement() {
  const { getViewport, screenToFlowPosition } = useReactFlow()
  const { nodes: existingNodes, edges: existingEdges, selectedNodeIds } = useBoardStore()

  /**
   * Creates placement context from current board state
   */
  const createPlacementContext = useCallback((
    focusNodeId?: string,
    constraints?: Partial<PlacementConstraints>
  ): PlacementContext => {
    const viewport = getViewport()
    const rect = document.querySelector('.react-flow')?.getBoundingClientRect()
    
    // Calculate viewport dimensions
    const viewportWidth = rect?.width || window.innerWidth
    const viewportHeight = rect?.height || window.innerHeight
    
    // Find focus node
    let focusNode: BoardNode | undefined
    if (focusNodeId) {
      focusNode = existingNodes.find(node => node.id === focusNodeId)
    } else if (selectedNodeIds.length > 0) {
      focusNode = existingNodes.find(node => selectedNodeIds.includes(node.id))
    }

    return {
      existingNodes,
      existingEdges,
      viewport: {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
        width: viewportWidth,
        height: viewportHeight
      },
      selectedNodeIds,
      focusNode,
      constraints: {
        minDistance: 30,
        avoidOverlap: true,
        ...constraints
      }
    }
  }, [getViewport, existingNodes, existingEdges, selectedNodeIds])

  /**
   * Places AI-generated nodes with intelligent fan layout
   */
  const placeAINodes = useCallback(async (
    nodes: NodeToPlace[],
    parentNodeId?: string,
    constraints?: Partial<PlacementConstraints>
  ): Promise<PlacementResult> => {
    const context = createPlacementContext(parentNodeId, constraints)
    return placeAIGeneratedNodes(nodes, context, parentNodeId)
  }, [createPlacementContext])

  /**
   * Places nodes for board creation with structured layout
   */
  const placeBoardNodes = useCallback(async (
    nodes: NodeToPlace[],
    constraints?: Partial<PlacementConstraints>
  ): Promise<PlacementResult> => {
    const context = createPlacementContext(undefined, constraints)
    return placeBoardCreationNodes(nodes, context)
  }, [createPlacementContext])

  /**
   * Places a single node manually
   */
  const placeManualNode = useCallback(async (
    node: NodeToPlace,
    preferredPosition?: { x: number; y: number },
    constraints?: Partial<PlacementConstraints>
  ): Promise<PlacementResult> => {
    const context = createPlacementContext(undefined, constraints)
    
    // If preferred position is provided, try to place there
    if (preferredPosition) {
      node.preferredPosition = preferredPosition
    }

    return placeNodes({
      nodes: [node],
      context,
      strategy: PlacementStrategy.MANUAL_ADD,
      algorithm: LayoutAlgorithm.FAN
    })
  }, [createPlacementContext])

  /**
   * Places document nodes with smart positioning
   */
  const placeDocumentNodes = useCallback(async (
    nodes: NodeToPlace[],
    dropPosition?: { x: number; y: number },
    constraints?: Partial<PlacementConstraints>
  ): Promise<PlacementResult> => {
    const context = createPlacementContext(undefined, constraints)
    
    // Set preferred position if drop position provided
    if (dropPosition && nodes.length > 0) {
      nodes[0].preferredPosition = dropPosition
    }

    return placeNodes({
      nodes,
      context,
      strategy: PlacementStrategy.DOCUMENT_UPLOAD,
      algorithm: LayoutAlgorithm.SPIRAL
    })
  }, [createPlacementContext])

  /**
   * Reorganizes the entire board with a new layout
   */
  const reorganizeBoardLayout = useCallback(async (
    algorithm: LayoutAlgorithm,
    includeExistingNodes: boolean = false,
    constraints?: Partial<PlacementConstraints>
  ): Promise<PlacementResult> => {
    const context = createPlacementContext(undefined, constraints)
    
    // Convert existing nodes to NodeToPlace if including them
    const nodesToPlace: NodeToPlace[] = includeExistingNodes 
      ? existingNodes.map(node => ({
          id: node.id,
          title: node.data.title || 'Node',
          content: node.data.content,
          type: node.data.type,
          data: node.data
        }))
      : []

    return reorganizeBoard(nodesToPlace, context, algorithm)
  }, [createPlacementContext, existingNodes])

  /**
   * Gets the current viewport center in flow coordinates
   */
  const getViewportCenter = useCallback(() => {
    try {
      const viewport = getViewport()
      const rect = document.querySelector('.react-flow')?.getBoundingClientRect()
      
      if (rect) {
        const screenCenter = {
          x: rect.width / 2,
          y: rect.height / 2
        }
        return screenToFlowPosition(screenCenter)
      }
      
      // Fallback calculation
      return {
        x: -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom,
        y: -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom
      }
    } catch (error) {
      console.warn('Failed to get viewport center:', error)
      return { x: 400, y: 300 }
    }
  }, [getViewport, screenToFlowPosition])

  /**
   * Converts screen coordinates to flow coordinates
   */
  const screenToFlow = useCallback((screenPosition: { x: number; y: number }) => {
    try {
      return screenToFlowPosition(screenPosition)
    } catch (error) {
      console.warn('Failed to convert screen to flow position:', error)
      return screenPosition
    }
  }, [screenToFlowPosition])

  /**
   * Finds the best position for a single node near a target
   */
  const findBestPosition = useCallback(async (
    targetPosition: { x: number; y: number },
    nodeTitle: string,
    nodeContent?: string,
    constraints?: Partial<PlacementConstraints>
  ) => {
    const context = createPlacementContext(undefined, constraints)
    
    const result = await placeNodes({
      nodes: [{
        title: nodeTitle,
        content: nodeContent,
        preferredPosition: targetPosition
      }],
      context,
      strategy: PlacementStrategy.SMART_AUTO
    })

    return result.placements[0]?.position || targetPosition
  }, [createPlacementContext])

  // Memoized utilities
  const utilities = useMemo(() => ({
    getViewportCenter,
    screenToFlow,
    findBestPosition,
    createPlacementContext
  }), [getViewportCenter, screenToFlow, findBestPosition, createPlacementContext])

  return {
    // Main placement functions
    placeAINodes,
    placeBoardNodes,
    placeManualNode,
    placeDocumentNodes,
    reorganizeBoardLayout,
    
    // Utility functions
    ...utilities,
    
    // Advanced placement
    placeNodes: useCallback(async (request: PlacementRequest) => {
      return placeNodes(request)
    }, [])
  }
}

/**
 * Hook specifically for AI node generation placement
 * Simplified interface for the most common use case
 */
export function useAIPlacement() {
  const { placeAINodes, getViewportCenter } = usePlacement()
  const { selectedNodeIds, nodes } = useBoardStore()

  /**
   * Places AI-generated nodes with smart parent detection
   */
  const placeGeneratedNodes = useCallback(async (
    generatedNodes: NodeToPlace[]
  ): Promise<PlacementResult> => {
    // Find the best parent node (most recently selected)
    const parentNodeId = selectedNodeIds.length > 0 ? selectedNodeIds[0] : undefined
    
    return placeAINodes(generatedNodes, parentNodeId, {
      minDistance: 40, // Slightly more space for AI nodes
      preferredDirection: 'down' // AI nodes typically go below parent
    })
  }, [placeAINodes, selectedNodeIds])

  /**
   * Places a single AI node with context awareness
   */
  const placeSingleAINode = useCallback(async (
    title: string,
    content?: string,
    parentNodeId?: string
  ): Promise<PlacementResult> => {
    return placeAINodes([{ title, content }], parentNodeId)
  }, [placeAINodes])

  return {
    placeGeneratedNodes,
    placeSingleAINode,
    getViewportCenter
  }
}

/**
 * Hook for board reorganization features
 */
export function useBoardReorganization() {
  const { reorganizeBoardLayout } = usePlacement()

  const reorganizeAsGrid = useCallback(() => 
    reorganizeBoardLayout(LayoutAlgorithm.GRID, true), 
    [reorganizeBoardLayout]
  )

  const reorganizeAsRadial = useCallback(() => 
    reorganizeBoardLayout(LayoutAlgorithm.RADIAL, true), 
    [reorganizeBoardLayout]
  )

  const reorganizeAsLinear = useCallback((direction: 'horizontal' | 'vertical' = 'horizontal') => 
    reorganizeBoardLayout(LayoutAlgorithm.LINEAR, true, {
      preferredDirection: direction === 'horizontal' ? 'right' : 'down'
    }), 
    [reorganizeBoardLayout]
  )

  const reorganizeAsSpiral = useCallback(() => 
    reorganizeBoardLayout(LayoutAlgorithm.SPIRAL, true), 
    [reorganizeBoardLayout]
  )

  return {
    reorganizeAsGrid,
    reorganizeAsRadial,
    reorganizeAsLinear,
    reorganizeAsSpiral,
    reorganizeBoardLayout
  }
}
