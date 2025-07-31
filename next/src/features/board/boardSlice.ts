import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { BoardState, BoardActions, BoardNode, BoardEdge, BoardBrief, DocumentEmbedding } from './boardTypes'

const initialState: BoardState = {
  nodes: [],
  edges: [],
  selectedNodeIds: [], // Change from selectedNodeId to selectedNodeIds array
  viewport: {
    x: 0,
    y: 0,
    zoom: 1,
  },
  topic: null,
  boardBrief: undefined,
  embeddings: [],
  currentBoardId: undefined,
  tasks: [],
  freeChatMode: false, // Add default value
  topbarHeight: 49, // Default, can be updated dynamically
}

export const useBoardStore = create<BoardState & BoardActions & {
  setEmbeddings: (embeddings: DocumentEmbedding[]) => void
  clearEmbeddings: () => void
  addTask: (text: string) => void
  toggleTask: (id: string) => void
  removeTask: (id: string) => void
  setTasks: (tasks: { id: string; text: string; completed: boolean }[]) => void
  setFreeChatMode: (free: boolean) => void
  setTopbarHeight: (height: number) => void
  setSelectedNodes: (ids: string[]) => void
  addSelectedNode: (id: string) => void
  removeSelectedNode: (id: string) => void
  clearSelectedNodes: () => void
}>((set, _get) => ({
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

  // Global delete function that can be called from anywhere
  deleteNodeFromBoard: (id: string) => {
    // This will be set by the BoardComponent
    const deleteFunction = (window as any).__deleteNodeFromBoard
    if (deleteFunction) {
      deleteFunction(id)
    }
  },

  setNodes: (nodes) => {
    set({ nodes })
  },

  addEdge: (edge) => {
    const newEdge: BoardEdge = {
      ...edge,
      id: uuidv4(),
    }
    set((state) => {
      const newEdges = [...state.edges, newEdge]
      return { edges: newEdges }
    })
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
    set({ selectedNodeIds: id ? [id] : [] })
  },

  setSelectedNodes: (ids) => {
    set({ selectedNodeIds: ids })
  },

  addSelectedNode: (id) => {
    set((state) => ({
      selectedNodeIds: state.selectedNodeIds.includes(id) 
        ? state.selectedNodeIds 
        : [...state.selectedNodeIds, id]
    }))
  },

  removeSelectedNode: (id) => {
    set((state) => ({
      selectedNodeIds: state.selectedNodeIds.filter(nodeId => nodeId !== id)
    }))
  },

  clearSelectedNodes: () => {
    set({ selectedNodeIds: [] })
  },

  updateViewport: (viewport) => {
    set((state) => ({
      viewport: { ...state.viewport, ...viewport },
    }))
  },

  clearBoard: () => {
    set(initialState)
  },

  setTopic: (topic) => {
    set({ topic })
  },

  setBoardBrief: (brief: BoardBrief) => set({ boardBrief: brief }),

  setCurrentBoardId: (id: string | undefined) => set({ currentBoardId: id }),

  setEmbeddings: (embeddings) => {
    set({ embeddings })
  },
  clearEmbeddings: () => {
    set({ embeddings: [] })
  },
  addTask: (text) => {
    const newTask = { id: uuidv4(), text, completed: false }
    set((state) => ({ tasks: [...(state.tasks || []), newTask] }))
  },
  toggleTask: (id) => {
    set((state) => ({
      tasks: (state.tasks || []).map(task =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    }))
  },
  removeTask: (id) => {
    set((state) => ({
      tasks: (state.tasks || []).filter(task => task.id !== id)
    }))
  },
  setTasks: (tasks) => {
    set({ tasks })
  },
  setFreeChatMode: (free) => set({ freeChatMode: free }),
  setTopbarHeight: (height) => set({ topbarHeight: height }),
})) 