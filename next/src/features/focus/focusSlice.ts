import { create } from 'zustand'

interface FocusNode {
  id: string
  children?: FocusNode[]
}

type FocusMode = 'neighbors' | 'group'

interface FocusState {
  // Legacy fields (kept for backward compatibility)
  focusedNodeId: string | null
  focusTree: FocusNode[]
  enterFocusMode: (nodeId: string) => void
  exitFocusMode: () => void
  setFocusTree: (tree: FocusNode[]) => void

  // New focus model
  mode: FocusMode | null
  focusedRootIds: string[]
  focusedIds: Set<string>
  setFocus: (
    roots: string[],
    mode: FocusMode,
    edges: { source: string; target: string }[]
  ) => void
  focusNeighborhood: (
    roots: string[],
    edges: { source: string; target: string }[]
  ) => void
  focusGroup: (
    roots: string[],
    edges: { source: string; target: string }[]
  ) => void
  clearFocus: () => void
}

function buildAdjacency(
  edges: { source: string; target: string }[]
): Map<string, Set<string>> {
  const adjacency = new Map<string, Set<string>>()
  const add = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set())
    adjacency.get(a)!.add(b)
  }
  for (const e of edges) {
    if (!e.source || !e.target) continue
    add(e.source, e.target)
    add(e.target, e.source)
  }
  return adjacency
}

function bfsReach(
  adjacency: Map<string, Set<string>>,
  startIds: string[],
  depth: number
): Set<string> {
  const visited = new Set<string>(startIds)
  if (depth <= 0 || startIds.length === 0) return visited
  let frontier = [...startIds]
  let currentDepth = 0
  while (frontier.length > 0 && currentDepth < depth) {
    const next: string[] = []
    for (const nodeId of frontier) {
      const neighbors = adjacency.get(nodeId)
      if (!neighbors) continue
      for (const n of neighbors) {
        if (!visited.has(n)) {
          visited.add(n)
          next.push(n)
        }
      }
    }
    frontier = next
    currentDepth += 1
    if (depth === Infinity) {
      // if Infinity, continue until no more frontier
      currentDepth = 0 // keep loop running solely on frontier length
      if (frontier.length === 0) break
      // To avoid infinite loop, but frontier will eventually empty
    }
  }
  return visited
}

export const useFocusStore = create<FocusState>((set) => ({
  // Legacy
  focusedNodeId: null,
  focusTree: [],
  enterFocusMode: (nodeId: string) => set({ focusedNodeId: nodeId }),
  exitFocusMode: () => set({ focusedNodeId: null }),
  setFocusTree: (tree: FocusNode[]) => set({ focusTree: tree }),

  // New model
  mode: null,
  focusedRootIds: [],
  focusedIds: new Set<string>(),
  setFocus: (roots, mode, edges) => {
    const adjacency = buildAdjacency(edges)
    const depth = mode === 'neighbors' ? 1 : (Number.POSITIVE_INFINITY as unknown as number)
    const reached = bfsReach(adjacency, roots, depth)
    set({ mode, focusedRootIds: roots, focusedIds: reached })
  },
  focusNeighborhood: (roots, edges) => {
    const adjacency = buildAdjacency(edges)
    const reached = bfsReach(adjacency, roots, 1)
    set({ mode: 'neighbors', focusedRootIds: roots, focusedIds: reached })
  },
  focusGroup: (roots, edges) => {
    const adjacency = buildAdjacency(edges)
    // Use a very large depth by treating as Infinity
    const reached = bfsReach(adjacency, roots, Number.POSITIVE_INFINITY as unknown as number)
    set({ mode: 'group', focusedRootIds: roots, focusedIds: reached })
  },
  clearFocus: () => set({ mode: null, focusedRootIds: [], focusedIds: new Set<string>() }),
}))