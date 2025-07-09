import { create } from 'zustand'
import type { BoardNode, BoardEdge } from '../board/boardTypes'

interface FocusState {
  focusedNodeId: string | null
  focusTree: string[] // Array of node IDs in focus tree
  isFocusMode: boolean
}

interface FocusActions {
  setFocusedNode: (nodeId: string | null) => void
  setFocusTree: (tree: string[]) => void
  toggleFocusMode: () => void
  enterFocusMode: (nodeId: string) => void
  exitFocusMode: () => void
}

export const useFocusStore = create<FocusState & FocusActions>((set, get) => ({
  focusedNodeId: null,
  focusTree: [],
  isFocusMode: false,

  setFocusedNode: (nodeId) => {
    set({ focusedNodeId: nodeId })
  },

  setFocusTree: (tree) => {
    set({ focusTree: tree })
  },

  toggleFocusMode: () => {
    set((state) => ({ isFocusMode: !state.isFocusMode }))
  },

  enterFocusMode: (nodeId) => {
    set({ 
      focusedNodeId: nodeId, 
      isFocusMode: true,
      focusTree: [nodeId] // Start with just the focused node
    })
  },

  exitFocusMode: () => {
    set({ 
      focusedNodeId: null, 
      isFocusMode: false,
      focusTree: []
    })
  },
})) 