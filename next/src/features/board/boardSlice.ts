import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type { BoardState, BoardActions, BoardNode, BoardEdge, BoardBrief, DocumentEmbedding, Colorgory } from './boardTypes'
import { COLORGORY_DEFS, registerColorgoriesGetter } from './colorgoryColors'
import type { AIStyleKey } from '../ai/aiStyle'

const ALLOWED_BOARD_THEME_KEYS = new Set(['default', 'red', 'presentation', 'education', 'creative', 'technical', 'scifi'])
function normalizeBoardThemeKey(key: string): string {
  const k = String(key || 'default').toLowerCase()
  return ALLOWED_BOARD_THEME_KEYS.has(k) ? k : 'default'
}

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
  connectingSourceId: null,
  colorgories: COLORGORY_DEFS.map((d, idx) => ({ id: d.id, color: d.id, name: d.name, order: idx, visible: true })),
  edgeType: 'floating',
  aiStyle: 'balanced' as AIStyleKey,
  hoveredEdgeId: null,
  demoMode: false,
  boardTheme: 'default',
  boardUiMode: null,
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
  setEdges: (edges: BoardEdge[]) => void
  setConnectingSource: (id: string | null) => void
  // Colorgories actions
  setColorgories: (c: Colorgory[]) => void
  addColorgory: (c: Colorgory) => void
  renameColorgory: (id: string, name: string) => void
  removeColorgory: (id: string) => void
  reorderColorgories: (idsInOrder: string[]) => void
  setColorgoryVisible: (id: string, visible: boolean) => void
  assignNodeColorgory: (nodeId: string, colorgoryId: string) => void
  unassignNodeColorgory: (nodeId: string, colorgoryId: string) => void
  setHoveredEdgeId: (id: string | null) => void
  setAIStyle: (style: AIStyleKey) => void
  setDemoMode: (demo: boolean) => void
  setBoardTheme: (theme: string) => void
  setBoardUiMode: (mode: BoardState['boardUiMode']) => void
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
    const deleteFunction = (window as Window & { __deleteNodeFromBoard?: (id: string) => void }).__deleteNodeFromBoard
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
  setConnectingSource: (id) => set({ connectingSourceId: id }),
  setEdgeType: (t) => set({ edgeType: t || 'floating' }),
  setHoveredEdgeId: (id) => set({ hoveredEdgeId: id }),
  setAIStyle: (style) => set({ aiStyle: (style || 'balanced') as AIStyleKey }),
  setDemoMode: (demo) => set({ demoMode: !!demo }),
  setBoardTheme: (theme) => set({ boardTheme: normalizeBoardThemeKey(String(theme || 'default')) }),
  setBoardUiMode: (mode) => set({ boardUiMode: (mode === 'light' || mode === 'dark') ? mode : null }),

  // Colorgories
  setColorgories: (c) => set({ colorgories: c }),
  addColorgory: (c) => set((state) => ({ colorgories: [...(state.colorgories || []), c] })),
  renameColorgory: (id, name) => set((state) => ({ colorgories: (state.colorgories || []).map(c => c.id === id ? { ...c, name } : c) })),
  removeColorgory: (id) => set((state) => ({ colorgories: (state.colorgories || []).filter(c => c.id !== id) })),
  reorderColorgories: (idsInOrder) => set((state) => {
    const map = new Map((state.colorgories || []).map(c => [c.id, c]))
    const next = idsInOrder.map((id, idx) => ({ ...(map.get(id) as any), order: idx }))
    return { colorgories: next }
  }),
  setColorgoryVisible: (id, visible) => set((state) => ({ colorgories: (state.colorgories || []).map(c => c.id === id ? { ...c, visible } : c) })),
  assignNodeColorgory: (nodeId, colorgoryId) => set((state) => ({
    nodes: (state.nodes || []).map(n => n.id === nodeId ? ({
      ...n,
      data: { ...n.data, colorgoryIds: Array.from(new Set([...(n.data.colorgoryIds || []), colorgoryId])) }
    }) : n)
  })),
  unassignNodeColorgory: (nodeId, colorgoryId) => set((state) => ({
    nodes: (state.nodes || []).map(n => n.id === nodeId ? ({
      ...n,
      data: { ...n.data, colorgoryIds: (n.data.colorgoryIds || []).filter(id => id !== colorgoryId) }
    }) : n)
  })),
})) 

// Register a getter so utilities can read current colorgories without importing the store directly
try {
  registerColorgoriesGetter(() => (useBoardStore.getState().colorgories || []) as any)
} catch {}