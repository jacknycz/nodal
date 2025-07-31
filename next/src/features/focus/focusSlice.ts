import { create } from 'zustand'

interface FocusNode {
  id: string
  children?: FocusNode[]
}

interface FocusState {
  focusedNodeId: string | null
  focusTree: FocusNode[]
  enterFocusMode: (nodeId: string) => void
  exitFocusMode: () => void
  setFocusTree: (tree: FocusNode[]) => void
}

export const useFocusStore = create<FocusState>((set) => ({
  focusedNodeId: null,
  focusTree: [],
  enterFocusMode: (nodeId: string) => set({ focusedNodeId: nodeId }),
  exitFocusMode: () => set({ focusedNodeId: null }),
  setFocusTree: (tree: FocusNode[]) => set({ focusTree: tree }),
})) 