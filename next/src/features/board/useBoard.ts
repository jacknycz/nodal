'use client'

import { useCallback } from 'react'
import { Node, Edge } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'

export function useBoard() {
  const addNode = useCallback((title: string, position: { x: number; y: number }) => {
    const newNode: Node = {
      id: uuidv4(),
      type: 'default',
      position,
      data: { label: title },
    }
    return newNode
  }, [])

  const addNodeToStore = useCallback((node: Node) => {
    // This would typically update a Zustand store
    // For now, we'll just return the node
    return node
  }, [])

  const getViewportCenter = useCallback(() => {
    // Default center position
    return { x: 400, y: 300 }
  }, [])

  return {
    addNode,
    addNodeToStore,
    getViewportCenter,
  }
} 