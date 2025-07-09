import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { BoardState, BoardActions, BoardNode, BoardEdge } from './boardTypes'

const initialState: BoardState = {
  nodes: [],
  edges: [],
  selectedNodeId: null,
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
}

export const useBoardStore = create<BoardState & BoardActions>((set, get) => ({
  ...initialState,

  addNode: (node) => {
    const newNode: BoardNode = {
      ...node,
      id: uuidv4(),
    }
    set((state) => ({
      nodes: [...state.nodes, newNode],
    }))
  },

  updateNode: (id, updates) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, ...updates } : node
      ),
    }))
  },

  deleteNode: (id) => {
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter(
        (edge) => edge.source !== id && edge.target !== id
      ),
    }))
  },

  setNodes: (nodes) => {
    set({ nodes })
  },

  addEdge: (edge) => {
    const newEdge: BoardEdge = {
      ...edge,
      id: uuidv4(),
    }
    set((state) => ({
      edges: [...state.edges, newEdge],
    }))
  },

  deleteEdge: (id) => {
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
    }))
  },

  setEdges: (edges) => {
    set({ edges })
  },

  setSelectedNode: (id) => {
    set({ selectedNodeId: id })
  },

  updateViewport: (viewport) => {
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    }))
  },

  clearBoard: () => {
    set(initialState)
  },
})) 