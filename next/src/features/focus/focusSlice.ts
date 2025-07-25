import { create } from 'zustand'

interface FocusState {
  focusedNodeId: string | null
  focusTree: any[]
  enterFocusMode: (nodeId: string) => void
  exitFocusMode: () => void
  setFocusTree: (tree: any[]) => void
}

export const useFocusStore = create<FocusState>((set) => ({
  focusedNodeId: null,
  focusTree: [],
  enterFocusMode: (nodeId: string) => set({ focusedNodeId: nodeId }),
  exitFocusMode: () => set({ focusedNodeId: null }),
  setFocusTree: (tree: any[]) => set({ focusTree: tree }),
})) 