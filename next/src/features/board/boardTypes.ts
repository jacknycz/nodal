import type { Node, Edge } from '@xyflow/react'
import type { AIStyleKey } from '../ai/aiStyle'

export interface BoardNode extends Node {
  dragHandle?: string
  data: {
    // New node structure
    title?: string
    content?: string // HTML or TipTap JSON (to be determined)
    media?: string[] // Array of DocumentNode IDs
    type?: 'default' | 'input' | 'output' | 'document'
    expanded?: boolean
    aiGenerated?: boolean
    // Document-specific fields
    documentId?: string
    fileName?: string
    fileType?: string
    fileSize?: number
    uploadedAt?: number
    extractedText?: string
    previewUrl?: string
    // Document processing status: 'processing', 'ready', 'error'
    status?: 'processing' | 'ready' | 'error'
    // Colorgories (category tags) referenced by ID
    colorgoryIds?: string[]
  }
}

export interface BoardEdge extends Edge {
  data?: {
    label?: string
    type?: 'default' | 'focus' | 'ai'
  }
}

export interface Colorgory {
  id: string
  color: string // e.g., 'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'pink'
  name: string // default to color, editable by user
  order?: number
  visible?: boolean
}

export interface BoardBrief {
  id: string // Unique board ID
  boardName: string
  boardTopic: string
  description: string
  startWithAI: boolean
  starterNodes?: string[]
  generateDescriptionsForStarter?: boolean
  generateMediaNodes?: boolean
}

// Embedding info for a document
export interface DocumentEmbedding {
  documentId: string
  fileName: string
  text: string
  embedding: number[]
}

export interface Task {
  id: string
  text: string
  completed: boolean
}

export interface BoardState {
  nodes: BoardNode[]
  edges: BoardEdge[]
  selectedNodeIds: string[] // Change from selectedNodeId to selectedNodeIds
  viewport: {
    x: number
    y: number
    zoom: number
  }
  topic: string | null
  boardBrief?: BoardBrief
  embeddings?: DocumentEmbedding[]
  currentBoardId?: string
  tasks?: Task[]
  freeChatMode?: boolean
  topbarHeight: number
  // When dragging from a handle, source id indicates connection mode
  connectingSourceId?: string | null
  // Global colorgories for the board
  colorgories?: Colorgory[]
  // Board-wide edge type preference
  edgeType?: 'floating' | 'bezier' | 'straight' | 'step' | 'smoothstep'
  // Board-wide AI behavior style (persisted as boards.ai_style in DB)
  aiStyle?: AIStyleKey
  // UI hovered edge id (optional UI-only state)
  hoveredEdgeId?: string | null
  // Demo boards: allow "pro-like" UI without persistence
  demoMode?: boolean
}

export interface BoardActions {
  addNode: (node: Omit<BoardNode, 'id'>) => void
  updateNode: (id: string, updates: Partial<BoardNode>) => void
  deleteNode: (id: string) => void
  deleteNodeFromBoard: (id: string) => void
  setNodes: (nodes: BoardNode[]) => void
  addEdge: (edge: Omit<BoardEdge, 'id'>) => void
  deleteEdge: (id: string) => void
  setEdges: (edges: BoardEdge[]) => void
  setSelectedNode: (id: string | null) => void
  updateViewport: (viewport: Partial<BoardState['viewport']>) => void
  clearBoard: () => void
  setTopic: (topic: string | null) => void
  setBoardBrief: (brief: BoardBrief) => void
  setCurrentBoardId: (id: string | undefined) => void // Add this action
  setSelectedNodes: (ids: string[]) => void
  addSelectedNode: (id: string) => void
  removeSelectedNode: (id: string) => void
  clearSelectedNodes: () => void
  setConnectingSource: (id: string | null) => void
  setEdgeType?: (t: BoardState['edgeType']) => void
  setAIStyle?: (style: BoardState['aiStyle']) => void
  setDemoMode?: (demo: boolean) => void
} 