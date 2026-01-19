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
import { estimateNodeDimensions } from './spatialAnalysis'
import { useBoardStore } from './boardSlice'

// ===============================
// CLUSTER MANAGEMENT FOR BETTER NODE SPACING
// ===============================

interface NodeCluster {
  id: string
  nodes: BoardNode[]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  centerPosition: { x: number; y: number }
  size: number
}

function detectNodeClusters(nodes: BoardNode[], edges: any[]): NodeCluster[] {
  const visited = new Set<string>()
  const clusters: NodeCluster[] = []
  
  // Build adjacency map
  const adjacencyMap = new Map<string, Set<string>>()
  nodes.forEach(node => adjacencyMap.set(node.id, new Set()))
  edges.forEach(edge => {
    adjacencyMap.get(edge.source)?.add(edge.target)
    adjacencyMap.get(edge.target)?.add(edge.source)
  })
  
  // Find connected components using DFS
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const clusterNodes: BoardNode[] = []
      const stack = [node.id]
      
      while (stack.length > 0) {
        const currentId = stack.pop()!
        if (!visited.has(currentId)) {
          visited.add(currentId)
          const currentNode = nodes.find(n => n.id === currentId)
          if (currentNode) {
            clusterNodes.push(currentNode)
            adjacencyMap.get(currentId)?.forEach(neighborId => {
              if (!visited.has(neighborId)) {
                stack.push(neighborId)
              }
            })
          }
        }
      }
      
      if (clusterNodes.length > 0) {
        const bounds = calculateClusterBounds(clusterNodes)
        clusters.push({
          id: `cluster-${clusters.length}`,
          nodes: clusterNodes,
          bounds,
          centerPosition: {
            x: bounds.minX + (bounds.maxX - bounds.minX) / 2,
            y: bounds.minY + (bounds.maxY - bounds.minY) / 2
          },
          size: clusterNodes.length
        })
      }
    }
  })
  
  return clusters
}

function calculateClusterBounds(nodes: BoardNode[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  
  nodes.forEach(node => {
    // Prefer XYFlow measured size when available for accurate bounds
    const dimensions = (node as any).width && (node as any).height
      ? { width: (node as any).width as number, height: (node as any).height as number }
      : estimateNodeDimensions(
          node.data.title || 'Node',
          node.data.content,
          node.data.type
        )
    minX = Math.min(minX, node.position.x)
    minY = Math.min(minY, node.position.y)
    maxX = Math.max(maxX, node.position.x + dimensions.width)
    maxY = Math.max(maxY, node.position.y + dimensions.height)
  })
  
  return { minX, minY, maxX, maxY }
}

function applyClusterSpacing(
  nodes: BoardNode[], 
  edges: any[], 
  spacing = 350, 
  center = { x: 400, y: 300 }
): BoardNode[] {
  const clusters = detectNodeClusters(nodes, edges)
  
  if (clusters.length <= 1) {
    return nodes
  }
  
  clusters.forEach((cluster, i) => {
  })
  
  // Sort clusters by size (largest first) for better arrangement
  const sortedClusters = [...clusters].sort((a, b) => b.size - a.size)
  
  // Calculate total width needed
  const totalClusterWidth = sortedClusters.reduce((sum, c) => sum + (c.bounds.maxX - c.bounds.minX), 0)
  const totalSpacing = (clusters.length - 1) * spacing
  const totalWidth = totalClusterWidth + totalSpacing
  
  // Start position (center the entire arrangement)
  let currentX = center.x - totalWidth / 2
  
  const updates = new Map<string, { x: number; y: number }>()
  
  // Position each cluster
  sortedClusters.forEach((cluster, index) => {
    const clusterWidth = cluster.bounds.maxX - cluster.bounds.minX
    const clusterHeight = cluster.bounds.maxY - cluster.bounds.minY
    
    // Calculate offset to move cluster to new position
    const offsetX = currentX - cluster.bounds.minX
    const offsetY = center.y - cluster.bounds.minY - clusterHeight / 2
    
    
    
    // Update positions for all nodes in this cluster
    cluster.nodes.forEach(node => {
      updates.set(node.id, {
        x: node.position.x + offsetX,
        y: node.position.y + offsetY
      })
    })
    
    // Move to next cluster position
    currentX += clusterWidth + spacing
  })
  
  // Apply updates
  const result = nodes.map(node => {
    const update = updates.get(node.id)
    if (update) {
      return { ...node, position: update }
    }
    return node
  })
  
  
  return result
}

/**
 * Main hook for using the placement system
 * Provides easy-to-use functions for all placement scenarios
 */
export function usePlacement() {
  const rfApi = useReactFlow()
  const { getViewport, screenToFlowPosition, setNodes } = rfApi
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
    const withFlags = (nodes || []).map((n) => ({
      ...n,
      data: { ...(n.data || {}), aiGenerated: (n.data as any)?.aiGenerated ?? true } as any,
    }))
    return placeAIGeneratedNodes(withFlags as any, context, parentNodeId)
  }, [createPlacementContext])

  /**
   * Places nodes for board creation with structured layout
   */
  const placeBoardNodes = useCallback(async (
    nodes: NodeToPlace[],
    constraints?: Partial<PlacementConstraints>
  ): Promise<PlacementResult> => {
    const context = createPlacementContext(undefined, constraints)
    const withFlags = (nodes || []).map((n) => ({
      ...n,
      data: { ...(n.data || {}), aiGenerated: (n.data as any)?.aiGenerated ?? true } as any,
    }))
    return placeBoardCreationNodes(withFlags as any, context)
  }, [createPlacementContext])

  /**
   * Places a single node manually
   */
  const placeManualNode = useCallback(async (
    node: NodeToPlace,
    preferredPosition?: { x: number; y: number },
    constraints?: Partial<PlacementConstraints>,
    existingNodesOverride?: BoardNode[]
  ): Promise<PlacementResult> => {
    const context = createPlacementContext(undefined, constraints)
    
    // If preferred position is provided, try to place there
    if (preferredPosition) {
      node.preferredPosition = preferredPosition
    }

    // Allow callers to override existingNodes to avoid store sync lag
    const effectiveContext = existingNodesOverride
      ? { ...context, existingNodes: existingNodesOverride }
      : context

    const withFlags = {
      ...node,
      data: { ...(node.data || {}), aiGenerated: (node.data as any)?.aiGenerated ?? false } as any,
    }

    return placeNodes({
      nodes: [withFlags as any],
      context: effectiveContext,
      strategy: PlacementStrategy.SMART_AUTO
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

    const withFlags = (nodes || []).map((n) => ({
      ...n,
      data: { ...(n.data || {}), aiGenerated: (n.data as any)?.aiGenerated ?? false } as any,
    }))

    return placeNodes({
      nodes: withFlags as any,
      context,
      strategy: PlacementStrategy.DOCUMENT_UPLOAD,
      algorithm: LayoutAlgorithm.GRID
    })
  }, [createPlacementContext])

  /**
   * Reorganizes the entire board with a new layout
   */
  const reorganizeBoardLayout = useCallback(async (
    algorithm: LayoutAlgorithm,
    includeExistingNodes: boolean = true,
    constraints?: Partial<PlacementConstraints>
  ): Promise<PlacementResult> => {
    // Fetch fresh nodes/edges directly from the store to avoid any sync lag
    const freshNodes = useBoardStore.getState().nodes
    const freshEdges = useBoardStore.getState().edges

    const baseContext = createPlacementContext(undefined, constraints)
    // Measure actual rendered sizes for all nodes (wait a frame to ensure layout is stable)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const measuredNodes = freshNodes.map((n) => {
      try {
        const el = document.querySelector(`.react-flow__node[data-id="${n.id}"]`) as HTMLElement | null
        if (el) {
          const rect = el.getBoundingClientRect()
          return { ...(n as any), width: rect.width, height: rect.height }
        }
      } catch {}
      return n as any
    })
    const context = { ...baseContext, existingNodes: measuredNodes as any, existingEdges: freshEdges }
    
    // Build parent relationships from edges using current Y to infer direction (top -> bottom)
    const parentOf: Record<string, string> = {}
    const nodeById = new Map<string, BoardNode>(freshNodes.map(n => [n.id, n]))
    freshEdges.forEach((edge: any) => {
      const a = edge?.source as string
      const b = edge?.target as string
      if (typeof a !== 'string' || typeof b !== 'string') return
      const na = nodeById.get(a)
      const nb = nodeById.get(b)
      if (!na || !nb) return
      // Parent is visually above child (smaller y)
      const parent = (na.position?.y ?? 0) <= (nb.position?.y ?? 0) ? a : b
      const child = parent === a ? b : a
      if (!parentOf[child]) parentOf[child] = parent
    })

    // Convert existing nodes to NodeToPlace if including them
    const nodesToPlace: NodeToPlace[] = includeExistingNodes 
      ? freshNodes.map(node => ({
          id: node.id,
          title: node.data.title || 'Node',
          content: node.data.content,
          type: node.data.type,
          data: node.data,
          parentId: parentOf[node.id]
        }))
      : []

    const result = await reorganizeBoard(nodesToPlace, context, algorithm)
    
    
    
    // Apply the new positions to the actual board nodes
    if (result.success && result.placements.length > 0) {
      const updatedNodes = freshNodes.map(node => {
        const placement = result.placements.find(p => p.node.id === node.id)
        if (placement) {
          return {
            ...node,
            position: placement.position
          }
        }
        return node
      })
      
      
      // Apply cluster spacing if there are multiple disconnected groups
      // TEMPORARILY DISABLED FOR DEBUGGING
      const finalNodes = updatedNodes
      
      // TODO: Re-enable cluster spacing after fixing the grid layout issue
      // const viewport = getViewport()
      // const viewportCenter = {
      //   x: -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom,
      //   y: -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom
      // }
      // const finalNodes = applyClusterSpacing(updatedNodes, existingEdges, 350, viewportCenter)
      
      // Update the board with new positions
      setNodes(finalNodes)
      // Force edges/handles to refresh after nodes settle in the DOM
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      try {
        const updateNodeInternals = (rfApi as any)?.updateNodeInternals
        if (typeof updateNodeInternals === 'function') {
          const ids = finalNodes.map(n => n.id)
          ids.forEach((id) => updateNodeInternals(id))
        }
      } catch {}
    } else {
    }
    
    return result
  }, [createPlacementContext, existingNodes, existingEdges, setNodes])

  /**
   * Reorganize only a subtree: keep parent at current position, reposition its descendants under it
   */
  const reorganizeSubtree = useCallback(async (
    parentNodeId: string,
    algorithm: LayoutAlgorithm = LayoutAlgorithm.GRID,
    constraints?: Partial<PlacementConstraints>
  ): Promise<PlacementResult> => {
    try { console.log('[reorganizeSubtree] start for', parentNodeId) } catch {}
    const freshNodes = useBoardStore.getState().nodes
    const freshEdges = useBoardStore.getState().edges

    // Build parent mapping using current Y (top -> bottom)
    const parentOf: Record<string, string> = {}
    const nodeById2 = new Map<string, BoardNode>(freshNodes.map(n => [n.id, n]))
    freshEdges.forEach((edge: any) => {
      const a = edge?.source as string
      const b = edge?.target as string
      if (typeof a !== 'string' || typeof b !== 'string') return
      const na = nodeById2.get(a)
      const nb = nodeById2.get(b)
      if (!na || !nb) return
      const parent = (na.position?.y ?? 0) <= (nb.position?.y ?? 0) ? a : b
      const child = parent === a ? b : a
      if (!parentOf[child]) parentOf[child] = parent
    })

    // Collect descendants of parentNodeId
    const descendants = new Set<string>()
    const queue: string[] = []
    // seed with direct children
    freshNodes.forEach(n => { if (parentOf[n.id] === parentNodeId) { descendants.add(n.id); queue.push(n.id) } })
    while (queue.length) {
      const current = queue.shift()!
      freshNodes.forEach(n => {
        if (!descendants.has(n.id) && parentOf[n.id] === current) {
          descendants.add(n.id)
          queue.push(n.id)
        }
      })
    }

    if (descendants.size === 0) {
      try { console.log('[reorganizeSubtree] no descendants for', parentNodeId, '- reorganizing whole board') } catch {}
      // Fallback: if this node has no descendants, reorganize the whole board instead
      await reorganizeBoardLayout(LayoutAlgorithm.GRID, true)
      return { placements: [], connections: [], metadata: { algorithm, strategy: LayoutAlgorithm.GRID as any, totalNodes: 0, collisionsAvoided: 0, executionTime: 0, bounds: { minX:0,minY:0,maxX:0,maxY:0 }, qualityScore: 1 }, success: true, warnings: [] }
    }

    // Measure actual rendered sizes before computing placement (ensures precise stacking/spacing)
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const measuredNodes = freshNodes.map((n) => {
      try {
        const el = document.querySelector(`.react-flow__node[data-id="${n.id}"]`) as HTMLElement | null
        if (el) {
          const rect = el.getBoundingClientRect()
          return { ...(n as any), width: rect.width, height: rect.height }
        }
      } catch {}
      return n as any
    })
    const baseContext = createPlacementContext(parentNodeId, constraints)
    const context = { ...baseContext, existingNodes: measuredNodes as any, existingEdges: freshEdges }

    const nodesToPlace: NodeToPlace[] = freshNodes
      .filter(n => descendants.has(n.id))
      .map(n => ({
        id: n.id,
        title: n.data.title || 'Node',
        content: n.data.content,
        type: n.data.type,
        data: n.data,
        parentId: parentOf[n.id]
      }))

    const result = await reorganizeBoard(nodesToPlace, context, algorithm)
    try { console.log('[reorganizeSubtree] result', { placements: result.placements.length, success: result.success }) } catch {}

    if (result.success && result.placements.length > 0) {
      const updatedNodes = freshNodes.map(node => {
        if (!descendants.has(node.id)) return node
        const placement = result.placements.find(p => p.node.id === node.id)
        if (placement) {
          return { ...node, position: placement.position }
        }
        return node
      })
      setNodes(updatedNodes)
      // Force edges/handles to refresh for updated nodes
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      try {
        const updateNodeInternals = (rfApi as any)?.updateNodeInternals
        if (typeof updateNodeInternals === 'function') {
          const ids = Array.from(descendants)
          ids.forEach((id) => updateNodeInternals(id))
        }
      } catch {}
      try { console.log('[reorganizeSubtree] applied updates to', updatedNodes.length, 'nodes') } catch {}
      return result
    }

    // Fallback deterministic tiered placement under parent
    try { console.log('[reorganizeSubtree] fallback tiered placement') } catch {}
    const parentNode = measuredNodes.find(n => n.id === parentNodeId)
    if (!parentNode) {
      return { placements: [], connections: [], metadata: { algorithm, strategy: LayoutAlgorithm.GRID as any, totalNodes: 0, collisionsAvoided: 0, executionTime: 0, bounds: { minX:0,minY:0,maxX:0,maxY:0 }, qualityScore: 1 }, success: false, warnings: ['parent not found'] }
    }

    const cellWidth = 300
    const cellHeight = 300
    const padding = 60

    // Build children lists for only descendant ids
    const childrenMap = new Map<string, string[]>()
    measuredNodes.forEach(n => { childrenMap.set(n.id, []) })
    freshEdges.forEach((e: any) => {
      const s = e?.source as string
      const t = e?.target as string
      if (descendants.has(t) && (s === parentNodeId || descendants.has(s))) {
        const arr = childrenMap.get(s) || []
        arr.push(t)
        childrenMap.set(s, arr)
      }
    })

    // Order children by current x to preserve relative order
    const nodeById = new Map<string, any>(measuredNodes.map(n => [n.id, n]))
    Array.from(childrenMap.keys()).forEach(pid => {
      const arr = childrenMap.get(pid) || []
      arr.sort((a, b) => (nodeById.get(a)?.position?.x || 0) - (nodeById.get(b)?.position?.x || 0))
      childrenMap.set(pid, arr)
    })

    // BFS levels
    const depth = new Map<string, number>()
    const levelQueue: string[] = []
    ;(childrenMap.get(parentNodeId) || []).forEach(id => { depth.set(id, 1); levelQueue.push(id) })
    while (levelQueue.length) {
      const cur = levelQueue.shift()!
      const d = depth.get(cur) || 1
      const kids = childrenMap.get(cur) || []
      kids.forEach(k => { if (!depth.has(k)) { depth.set(k, d + 1); levelQueue.push(k) } })
    }

    // Group by depth
    const idsByDepth = new Map<number, string[]>()
    depth.forEach((d, id) => {
      const arr = idsByDepth.get(d) || []
      arr.push(id)
      idsByDepth.set(d, arr)
    })

    const updates = new Map<string, { x: number; y: number }>()
    for (const [d, ids] of Array.from(idsByDepth.entries()).sort((a, b) => a[0] - b[0])) {
      const y = parentNode.position.y + d * (cellHeight + padding)
      // Place per parent group centered under that parent
      const parentsAtPrevDepth = new Set<string>()
      ids.forEach(id => { const p = parentOf[id]; if (p) parentsAtPrevDepth.add(p) })
      const orderedParents = Array.from(parentsAtPrevDepth)
      orderedParents.forEach(pid => {
        const children = (childrenMap.get(pid) || []).filter(id => depth.get(id) === d)
        if (children.length === 0) return
        const parentX = nodeById.get(pid)?.position?.x || parentNode.position.x
        const groupWidth = (children.length * cellWidth) + Math.max(0, children.length - 1) * padding
        let startX = parentX - groupWidth / 2 + cellWidth / 2
        children.forEach((cid) => {
          updates.set(cid, { x: startX, y })
          startX += cellWidth + padding
        })
      })
    }

    const updatedNodes = freshNodes.map(n => updates.has(n.id) ? ({ ...n, position: updates.get(n.id)! }) : n)
    setNodes(updatedNodes)
    try { console.log('[reorganizeSubtree] fallback applied to', updates.size, 'nodes') } catch {}
    return { placements: [], connections: [], metadata: { algorithm, strategy: LayoutAlgorithm.GRID as any, totalNodes: updates.size, collisionsAvoided: 0, executionTime: 0, bounds: { minX:0,minY:0,maxX:0,maxY:0 }, qualityScore: 1 }, success: true, warnings: [] }
  }, [createPlacementContext, setNodes])

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
    reorganizeSubtree,
    
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
    generatedNodes: NodeToPlace[],
    parentNodeId?: string,
    constraints?: Partial<PlacementConstraints>
  ): Promise<PlacementResult> => {
    const effectiveParent = parentNodeId ?? (selectedNodeIds.length > 0 ? selectedNodeIds[0] : undefined)
    return placeAINodes(generatedNodes, effectiveParent, {
      minDistance: 40,
      preferredDirection: 'down',
      ...constraints
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
