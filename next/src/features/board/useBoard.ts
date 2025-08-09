'use client'

import { useCallback } from 'react'
import { Node, Edge, useReactFlow } from '@xyflow/react'
import { v4 as uuidv4 } from 'uuid'

export function useBoard() {
  const { getViewport, screenToFlowPosition } = useReactFlow()

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
    try {
      const viewport = getViewport()
      const rect = document.querySelector('.react-flow')?.getBoundingClientRect()
      
      if (rect) {
        // Calculate the center of the visible viewport in screen coordinates
        const screenCenter = {
          x: rect.width / 2,
          y: rect.height / 2
        }
        
        // Convert to flow coordinates
        const flowCenter = screenToFlowPosition(screenCenter)
        return flowCenter
      }
      
      // Fallback: calculate center based on viewport transform
      return {
        x: -viewport.x / viewport.zoom + (window.innerWidth / 2) / viewport.zoom,
        y: -viewport.y / viewport.zoom + (window.innerHeight / 2) / viewport.zoom
      }
    } catch (error) {
      console.warn('Failed to get viewport center, using fallback:', error)
      // Ultimate fallback
      return { x: 400, y: 300 }
    }
  }, [getViewport, screenToFlowPosition])

  return {
    addNode,
    addNodeToStore,
    getViewportCenter,
  }
} 