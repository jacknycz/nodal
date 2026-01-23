import type { BoardNode, BoardEdge } from './boardTypes'

// ===============================
// CORE PLACEMENT SYSTEM TYPES
// ===============================

export interface Position {
  x: number
  y: number
}

export interface Bounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface NodeDimensions {
  width: number
  height: number
}

// ===============================
// PLACEMENT REQUEST & RESULT
// ===============================

export interface NodeToPlace {
  id?: string
  title: string
  content?: string
  // Must match XYFlow node "type" values used in the board.
  // Keep this union broad so the placement engine can place any node kind.
  type?: 'default' | 'document' | 'input' | 'output' | 'image' | 'video' | 'link' | 'spotify' | 'task' | 'headline'
  data?: Partial<BoardNode['data']>
  preferredPosition?: Position
  parentId?: string
  relationships?: string[] // IDs of related nodes
  priority?: number // Higher priority nodes get better positions
}

export interface NodePlacement {
  node: BoardNode
  position: Position
  reason: string // Why this position was chosen
  confidence: number // 0-1, how confident we are in this placement
}

export interface EdgePlacement {
  edge: BoardEdge
  reason: string
}

export interface PlacementResult {
  placements: NodePlacement[]
  connections: EdgePlacement[]
  metadata: PlacementMetadata
  success: boolean
  warnings: string[]
}

export interface PlacementMetadata {
  algorithm: LayoutAlgorithm
  strategy: PlacementStrategy
  totalNodes: number
  collisionsAvoided: number
  executionTime: number
  bounds: Bounds
  qualityScore: number // 0-1, overall quality of placement
}

// ===============================
// PLACEMENT CONTEXT
// ===============================

export interface PlacementContext {
  existingNodes: BoardNode[]
  existingEdges: BoardEdge[]
  viewport: {
    x: number
    y: number
    zoom: number
    width: number
    height: number
  }
  selectedNodeIds: string[]
  focusNode?: BoardNode // Primary node to place relative to
  availableSpace?: Bounds
  constraints?: PlacementConstraints
  userPreferences?: UserPlacementPreferences
}

export interface PlacementConstraints {
  minDistance: number // Minimum distance between nodes
  maxDistance?: number // Maximum distance from focus node
  avoidOverlap: boolean
  respectBounds?: Bounds
  preferredDirection?: 'up' | 'down' | 'left' | 'right' | 'radial' | 'auto'
  gridSnap?: number // Snap to grid
  preserveExistingLayout?: boolean // Don't move existing nodes
  maxIterations?: number // For force-directed algorithms
}

export interface UserPlacementPreferences {
  preferredSpacing: 'tight' | 'normal' | 'loose'
  layoutStyle: 'organic' | 'structured' | 'minimal'
  connectionStyle: 'minimal' | 'explicit' | 'hierarchical'
}

// ===============================
// LAYOUT ALGORITHMS & STRATEGIES
// ===============================

export enum LayoutAlgorithm {
  FAN = 'fan',
  GRID = 'grid', 
  RADIAL = 'radial',
  LINEAR = 'linear',
  SPIRAL = 'spiral',
  CLUSTER = 'cluster',
  HIERARCHY = 'hierarchy',
  FORCE_DIRECTED = 'force-directed',
  SMART_AUTO = 'smart-auto' // Automatically choose best algorithm
}

export enum PlacementStrategy {
  AI_GENERATION = 'ai-generation', // For AI-generated nodes
  BOARD_CREATION = 'board-creation', // For initial board setup
  MANUAL_ADD = 'manual-add', // For manually added nodes
  DOCUMENT_UPLOAD = 'document-upload', // For uploaded documents
  REORGANIZE = 'reorganize', // For board reorganization
  SMART_AUTO = 'smart-auto' // Automatically choose best strategy
}

// ===============================
// MAIN PLACEMENT REQUEST
// ===============================

export interface PlacementRequest {
  nodes: NodeToPlace[]
  context: PlacementContext
  strategy: PlacementStrategy
  algorithm?: LayoutAlgorithm // Override automatic algorithm selection
  constraints?: PlacementConstraints
  options?: Partial<LayoutOptions> // Algorithm-specific options
}

// ===============================
// SPATIAL ANALYSIS TYPES
// ===============================

export interface SpatialRegion {
  bounds: Bounds
  density: number // Number of nodes per unit area
  centerOfMass: Position
  isEmpty: boolean
  quality: number // 0-1, how good this region is for placement
}

export interface CollisionInfo {
  hasCollision: boolean
  collidingNodes: string[]
  suggestedPosition?: Position
  severity: 'none' | 'minor' | 'major' | 'blocking'
}

export interface SpaceAnalysis {
  regions: SpatialRegion[]
  bestRegion?: SpatialRegion
  congestionLevel: number // 0-1, overall board congestion
  recommendedDirection: 'up' | 'down' | 'left' | 'right' | 'radial'
}

// ===============================
// LAYOUT-SPECIFIC OPTIONS
// ===============================

export interface FanLayoutOptions {
  radius: number
  angleSpan: number // In radians
  angleCenter: number // Center angle in radians (-π/2 = downward)
  minDistance: number
  maxDistance: number
  verticalOffset: number
  adaptiveRadius: boolean // Adjust radius based on node content
  preventOverlap: boolean
}

export interface GridLayoutOptions {
  columns: number
  rows?: number
  cellWidth: number
  cellHeight: number
  padding: number
  alignment: 'start' | 'center' | 'end'
  fillDirection: 'row' | 'column'
}

export interface RadialLayoutOptions {
  centerNode?: string
  innerRadius: number
  outerRadius: number
  layers: number
  angleOffset: number // Starting angle
  clockwise: boolean
}

export interface LinearLayoutOptions {
  direction: 'horizontal' | 'vertical' | 'diagonal'
  spacing: number
  alignment: 'start' | 'center' | 'end'
  curve?: number // For curved lines
}

export interface SpiralLayoutOptions {
  centerPosition: Position
  initialRadius: number
  radiusGrowth: number
  angleStep: number
  clockwise: boolean
}

export interface ClusterLayoutOptions {
  clusterCount: number
  clusterRadius: number
  interClusterDistance: number
  clusterAlgorithm: 'kmeans' | 'hierarchical' | 'density'
}

export interface ElkLayoutOptions {
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
  layerSpacing: number
  nodeSpacing: number
}

// Union type for all layout options
export type LayoutOptions = 
  | FanLayoutOptions 
  | GridLayoutOptions 
  | RadialLayoutOptions 
  | LinearLayoutOptions
  | SpiralLayoutOptions
  | ClusterLayoutOptions
  | ElkLayoutOptions

// ===============================
// UTILITY TYPES
// ===============================

export interface LayoutQualityMetrics {
  overlapScore: number // 0-1, lower is better
  distributionScore: number // 0-1, higher is better
  readabilityScore: number // 0-1, higher is better
  aestheticScore: number // 0-1, higher is better
  overallScore: number // 0-1, weighted combination
}

export interface PlacementAnimation {
  duration: number
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  stagger: number // Delay between node animations
}
