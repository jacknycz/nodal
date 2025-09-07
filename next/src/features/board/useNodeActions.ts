import { useCallback } from 'react'
import type { Node, Edge } from '@xyflow/react'

interface UseNodeActionsParams {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>
}

export function useNodeActions({ setNodes, setEdges }: UseNodeActionsParams) {
  const addNode = useCallback((node: Node) => {
    setNodes((nds: any) => (Array.isArray(nds) ? [...nds, node] : [node]))
  }, [setNodes])

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds: any) => nds.filter((n: any) => n.id !== nodeId))
    setEdges((eds: any) => eds.filter((e: any) => e.source !== nodeId && e.target !== nodeId))
  }, [setNodes, setEdges])

  const updateNode = useCallback((nodeId: string, updates: Record<string, any>) => {
    setNodes((nds: any) => nds.map((n: any) => n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n))
  }, [setNodes])

  return { addNode, deleteNode, updateNode }
}

export default useNodeActions


