import type { Node, Edge } from '@xyflow/react'

export interface BoardNode extends Node {
  dragHandle?: string
  data: {
    label: string
    content?: string
    type?: 'default' | 'input' | 'output'
    expanded?: boolean
    aiGenerated?: boolean
  }
}

export interface BoardEdge extends Edge {
  data?: {
    label?: string
    type?: 'default' | 'focus' | 'ai'
  }
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
} 