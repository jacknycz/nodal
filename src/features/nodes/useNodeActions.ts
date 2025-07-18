import { useCallback } from 'react'
import { useBoard } from '../board/useBoard'
import { useBoardStore } from '../board/boardSlice'

export function useNodeActions(nodeId: string) {
  const { deleteNode, selectNode } = useBoard()
  const updateNode = useBoardStore((state) => state.updateNode)

  const updateNodeLabel = useCallback(
    (title: string) => {
      const nodes = useBoardStore.getState().nodes
      const node = nodes.find(n => n.id === nodeId)
      if (node) {
        updateNode(nodeId, {
          data: { ...node.data, title }
        })
      }
    },
    [nodeId, updateNode]
  )

  const updateNodeContent = useCallback(
    (content: string, mediaOrExtractedText?: string[] | string) => {
      const nodes = useBoardStore.getState().nodes
      const node = nodes.find(n => n.id === nodeId)
      if (node) {
        let newData = { ...node.data, content };
        if (Array.isArray(mediaOrExtractedText)) {
          newData.media = mediaOrExtractedText;
        } else if (node.data.type === 'document') {
          // Update status and extractedText for document nodes
          newData = {
            ...newData,
            extractedText: mediaOrExtractedText !== undefined ? mediaOrExtractedText : node.data.extractedText || '',
            status: content && !content.startsWith('[Error') ? 'ready' : (content.startsWith('[Error') ? 'error' : 'processing'),
          };
        }
        updateNode(nodeId, {
          data: newData
        });
      }
    },
    [nodeId, updateNode]
  )

  const toggleNodeExpanded = useCallback(() => {
    const nodes = useBoardStore.getState().nodes
    const node = nodes.find(n => n.id === nodeId)
    if (node) {
      updateNode(nodeId, { 
        data: { ...node.data, expanded: !node.data.expanded } 
      })
    }
  }, [nodeId, updateNode])

  const markAsAIGenerated = useCallback(() => {
    const nodes = useBoardStore.getState().nodes
    const node = nodes.find(n => n.id === nodeId)
    if (node) {
      updateNode(nodeId, { 
        data: { ...node.data, aiGenerated: true } 
      })
    }
  }, [nodeId, updateNode])

  const removeNode = useCallback(() => {
    deleteNode(nodeId)
  }, [nodeId, deleteNode])

  const selectThisNode = useCallback(() => {
    selectNode(nodeId)
  }, [nodeId, selectNode])

  return {
    updateNodeLabel,
    updateNodeContent,
    toggleNodeExpanded,
    markAsAIGenerated,
    removeNode,
    selectThisNode,
  }
} 