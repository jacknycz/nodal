import type { Node, Edge } from '@xyflow/react'

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
  }
}

export interface BoardEdge extends Edge {
  data?: {
    label?: string
    type?: 'default' | 'focus' | 'ai'
  }
}

export interface BoardBrief {
  topic: string
  ramble: string // Add the new ramble field
  goal: string
  audience: string
  resources: string[]
  aiHelpPreferences: string[]
  notes?: string
  isReady?: boolean
  preSessionChat?: { role: 'user' | 'ai', content: string }[]
}

// Embedding info for a document
export interface DocumentEmbedding {
  documentId: string
  fileName: string
  text: string
  embedding: number[]
}

export interface BoardState {
  nodes: BoardNode[]
  edges: BoardEdge[]
  selectedNodeId: string | null
  viewport: {
    x: number
    y: number
    zoom: number
  }
  topic: string | null
  boardBrief?: BoardBrief
  embeddings?: DocumentEmbedding[]
  currentBoardId?: string // Add this field
}

export interface BoardActions {
  addNode: (node: Omit<BoardNode, 'id'>) => void
  updateNode: (id: string, updates: Partial<BoardNode>) => void
  deleteNode: (id: string) => void
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
} 